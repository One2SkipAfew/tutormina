// Runs in the offscreen document so capture/recording survives the service worker being
// killed and restarted. Captures the meeting tab's audio + the user's mic, mixes them,
// records to a webm/opus blob, then uploads and runs it through the existing AI pipeline.
//
// Offscreen documents only get chrome.runtime access - no chrome.storage - so the auth
// session is handed to us by background.js in the OFFSCREEN_START message, not read here.

let mediaRecorder = null;
let chunks = [];
let tabStream = null;
let micStream = null;
let audioContext = null;
let session = null;
let captureMeta = null;
let startedAt = null;

function authedAiApiFetch(path, options = {}) {
  if (!session?.access_token) throw new Error('Not signed in');
  return fetch(`${TUTORMINA_CONFIG.AI_API_URL}${path}`, {
    ...options,
    headers: { Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) },
  });
}

async function startCapture({ streamId, session: sessionArg, meetingUrl, platform, title }) {
  if (!sessionArg) throw new Error('Not signed in');
  session = sessionArg;

  tabStream = await navigator.mediaDevices.getUserMedia({
    audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
    video: false,
  });
  micStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();

  const tabSource = audioContext.createMediaStreamSource(tabStream);
  tabSource.connect(destination);
  tabSource.connect(audioContext.destination); // so the user still hears the meeting

  const micSource = audioContext.createMediaStreamSource(micStream);
  micSource.connect(destination);

  chunks = [];
  mediaRecorder = new MediaRecorder(destination.stream, { mimeType: 'audio/webm;codecs=opus' });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  mediaRecorder.start(1000);

  captureMeta = { meetingUrl, platform, title };
  startedAt = Date.now();
}

function stopRecorder() {
  return new Promise((resolve) => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve();
      return;
    }
    mediaRecorder.onstop = resolve;
    mediaRecorder.stop();
  });
}

function teardownStreams() {
  tabStream?.getTracks().forEach((t) => t.stop());
  micStream?.getTracks().forEach((t) => t.stop());
  audioContext?.close();
  tabStream = null;
  micStream = null;
  audioContext = null;
  mediaRecorder = null;
}

// Fast part: stop the recorder and free the mic/tab streams. Must return quickly - this is
// what the popup's "Stop & Upload" click is waiting on for its response.
async function stopRecording() {
  await stopRecorder();
  const durationSeconds = Math.round((Date.now() - startedAt) / 1000);
  const blob = new Blob(chunks, { type: 'audio/webm' });
  teardownStreams();
  return { blob, durationSeconds };
}

// Slow part: upload + transcribe + fact-check. Deliberately NOT awaited by the message
// response above - MV3 service workers can be torn down while awaiting a long-running
// message reply, which would otherwise strand the popup in "processing" forever. This runs
// independently and reports back via a separate CAPTURE_COMPLETE/CAPTURE_ERROR message.
async function uploadAndProcess(blob, durationSeconds) {
  const { platform, title } = captureMeta;
  const userId = session.user_id;
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.webm`;

  // Recording + upload + transcribe + fact-check can outlast the 1h access token lifetime,
  // and offscreen has no chrome.storage to rely on background.js refreshing it beforehand -
  // so refresh in-memory here if needed. Not persisted back to storage; the next START_CAPTURE
  // call refreshes and persists via background.js's getValidSession() regardless.
  if (isExpiringSoon(session.access_token)) {
    session = await refreshSession(session.refresh_token);
  }
  const token = session.access_token;

  await uploadObject('session-recordings', path, blob, token);

  const recording = await insertRow('session_recordings', {
    owner_id: userId,
    title,
    capture_method: 'extension_capture',
    platform,
    audio_path: path,
    consent_confirmed: true,
    status: 'processing',
    duration_seconds: durationSeconds,
  }, token);

  try {
    const formData = new FormData();
    formData.append('file', blob, 'recording.webm');
    const processRes = await authedAiApiFetch('/process-audio', { method: 'POST', body: formData });
    const processData = await processRes.json();
    if (!processRes.ok) throw new Error(processData.detail || 'Transcription failed');

    await updateRow('session_recordings', recording.id, {
      transcript_text: processData.transcript,
      status: 'ready',
      completed_at: new Date().toISOString(),
    }, token);

    if (processData.transcript?.trim()) {
      try {
        const factCheckRes = await authedAiApiFetch('/fact-check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: processData.transcript }),
        });
        const factCheckData = await factCheckRes.json();
        const claims = factCheckData.results || [];
        for (const claim of claims) {
          await insertRow('session_recording_claims', {
            session_recording_id: recording.id,
            claim_text: claim.claim,
            speaker: claim.speaker || null,
            category: claim.category || null,
            verdict: claim.verdict,
            confidence_score: claim.confidence,
            explanation: claim.explanation || null,
            key_evidence: claim.key_evidence || null,
            source_urls: (claim.sources || []).map((s) => s.url).filter(Boolean),
            used_web_search: claim.used_web_search,
          }, token);
        }
      } catch (factCheckErr) {
        console.warn('Fact-check failed, continuing without it:', factCheckErr);
      }
    }
  } catch (err) {
    await updateRow('session_recordings', recording.id, { status: 'failed' }, token);
    throw err;
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.target !== 'offscreen') return false;

  if (message.type === 'OFFSCREEN_START') {
    // background.js awaits this response directly and reports failure to the popup itself,
    // so no separate CAPTURE_ERROR broadcast is needed here (unlike OFFSCREEN_STOP's
    // fire-and-forget upload, this whole call is synchronous from background's perspective).
    startCapture(message)
      .then(() => sendResponse({ ok: true }))
      .catch((err) => {
        teardownStreams();
        sendResponse({ ok: false, error: err.message });
      });
    return true;
  }

  if (message.type === 'OFFSCREEN_STOP') {
    stopRecording()
      .then(({ blob, durationSeconds }) => {
        sendResponse({ ok: true });
        // Deliberately not awaited - see uploadAndProcess() comment.
        uploadAndProcess(blob, durationSeconds).then(
          () => chrome.runtime.sendMessage({ type: 'CAPTURE_COMPLETE' }),
          (err) => chrome.runtime.sendMessage({ type: 'CAPTURE_ERROR', error: err.message })
        );
      })
      .catch((err) => sendResponse({ ok: false, error: err.message }));
    return true;
  }

  return false;
});
