// Service worker: relays start/stop commands to the offscreen document (which does the
// actual capture/recording/upload) and tracks state in chrome.storage.session so it survives
// the service worker being killed and restarted mid-recording.
//
// Offscreen documents only get chrome.runtime access (no chrome.storage, no chrome.tabs) -
// https://developer.chrome.com/blog/Offscreen-Documents-in-Manifest-v3 - so this service
// worker reads the auth session itself and hands it to the offscreen document over messaging.
importScripts('config.js', 'supabaseRest.js');

const OFFSCREEN_URL = 'offscreen.html';

async function ensureOffscreenDocument() {
  const has = await chrome.offscreen.hasDocument?.();
  if (has) return;
  await chrome.offscreen.createDocument({
    url: OFFSCREEN_URL,
    reasons: ['USER_MEDIA'],
    justification: 'Capture tab and microphone audio to record a tutoring/coaching session.',
  });
}

async function getState() {
  const { chommieState } = await chrome.storage.session.get('chommieState');
  return chommieState || { status: 'idle' };
}

async function setState(state) {
  await chrome.storage.session.set({ chommieState: state });
  chrome.runtime.sendMessage({ type: 'STATE_CHANGED', state }).catch(() => {});
  return state;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target === 'offscreen') return false; // meant for offscreen.js, not us

  (async () => {
    if (message.type === 'START_CAPTURE') {
      try {
        const current = await getState();
        if (current.status !== 'idle') {
          sendResponse(current);
          return;
        }
        const session = await getValidSession();
        if (!session) throw new Error('Not signed in');
        await ensureOffscreenDocument();
        const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: message.tabId });
        const ack = await chrome.runtime.sendMessage({
          target: 'offscreen',
          type: 'OFFSCREEN_START',
          streamId,
          session,
          meetingUrl: message.meetingUrl,
          platform: message.platform,
          title: message.title,
        });
        if (!ack?.ok) throw new Error(ack?.error || 'Failed to start capture');
        const state = await setState({
          status: 'recording',
          startedAt: Date.now(),
          meetingUrl: message.meetingUrl,
          platform: message.platform,
          title: message.title,
        });
        sendResponse(state);
      } catch (err) {
        sendResponse({ status: 'idle', error: err.message });
      }
      return;
    }

    if (message.type === 'STOP_CAPTURE') {
      try {
        await chrome.runtime.sendMessage({ target: 'offscreen', type: 'OFFSCREEN_STOP' });
        const state = await setState({ status: 'processing' });
        sendResponse(state);
      } catch (err) {
        sendResponse({ status: 'idle', error: err.message });
      }
      return;
    }

    if (message.type === 'GET_STATE') {
      const state = await getState();
      // If we think we're recording/processing but the offscreen document (which does the
      // actual work) is gone, the previous session was orphaned - e.g. the extension was
      // reloaded mid-capture. Recover instead of leaving the popup stuck forever.
      if (state.status !== 'idle' && !(await chrome.offscreen.hasDocument?.())) {
        sendResponse(await setState({ status: 'idle', error: 'Previous session was interrupted. Please try again.' }));
        return;
      }
      sendResponse(state);
      return;
    }

    // Messages coming back from the offscreen document once upload/processing finishes.
    if (message.type === 'CAPTURE_COMPLETE') {
      await setState({ status: 'idle' });
      chrome.offscreen.closeDocument?.().catch(() => {});
      return;
    }

    if (message.type === 'CAPTURE_ERROR') {
      await setState({ status: 'idle', error: message.error });
      chrome.offscreen.closeDocument?.().catch(() => {});
      return;
    }
  })();

  return true; // keep the message channel open for the async sendResponse above
});
