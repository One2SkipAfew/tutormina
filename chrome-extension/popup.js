const PLATFORM_PATTERNS = [
  [/meet\.google\.com/i, 'google_meet', 'Google Meet'],
  [/teams\.microsoft\.com|teams\.live\.com/i, 'microsoft_teams', 'Microsoft Teams'],
  [/zoom\.us/i, 'zoom', 'Zoom'],
];

function detectPlatform(url) {
  for (const [pattern, value, label] of PLATFORM_PATTERNS) {
    if (pattern.test(url)) return { value, label };
  }
  return { value: 'other', label: 'this page' };
}

const els = {
  statusDot: document.getElementById('statusDot'),
  loginView: document.getElementById('loginView'),
  mainView: document.getElementById('mainView'),
  email: document.getElementById('email'),
  password: document.getElementById('password'),
  signInBtn: document.getElementById('signInBtn'),
  loginError: document.getElementById('loginError'),
  platformHint: document.getElementById('platformHint'),
  micSetupNotice: document.getElementById('micSetupNotice'),
  openSetupBtn: document.getElementById('openSetupBtn'),
  idleControls: document.getElementById('idleControls'),
  recordingControls: document.getElementById('recordingControls'),
  processingControls: document.getElementById('processingControls'),
  consentCheckbox: document.getElementById('consentCheckbox'),
  startBtn: document.getElementById('startBtn'),
  stopBtn: document.getElementById('stopBtn'),
  timer: document.getElementById('timer'),
  mainError: document.getElementById('mainError'),
  signOutBtn: document.getElementById('signOutBtn'),
};

let activeTab = null;
let timerInterval = null;

function formatElapsed(startedAt) {
  const secs = Math.floor((Date.now() - startedAt) / 1000);
  const mins = Math.floor(secs / 60);
  const remaining = secs % 60;
  return `${mins.toString().padStart(2, '0')}:${remaining.toString().padStart(2, '0')}`;
}

function renderState(state) {
  if (state.status === 'recording') {
    els.statusDot.classList.add('recording');
    els.idleControls.style.display = 'none';
    els.processingControls.style.display = 'none';
    els.recordingControls.style.display = 'block';
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      els.timer.textContent = formatElapsed(state.startedAt);
    }, 500);
    els.timer.textContent = formatElapsed(state.startedAt);
  } else if (state.status === 'processing') {
    els.statusDot.classList.remove('recording');
    clearInterval(timerInterval);
    els.idleControls.style.display = 'none';
    els.recordingControls.style.display = 'none';
    els.processingControls.style.display = 'block';
  } else {
    els.statusDot.classList.remove('recording');
    clearInterval(timerInterval);
    els.recordingControls.style.display = 'none';
    els.processingControls.style.display = 'none';
    els.idleControls.style.display = 'block';
  }
}

// Extension popups close as soon as they lose focus, and the native mic permission dialog
// steals focus - so requesting getUserMedia from here cancels itself before the user can
// respond, surfacing as "Permission dismissed" with no visible prompt. Granting has to happen
// from setup.html (a normal tab) instead; here we only check whether that grant already exists.
async function checkMicPermission() {
  try {
    const status = await navigator.permissions.query({ name: 'microphone' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'prompt'; // Permissions API doesn't support 'microphone' in some contexts - assume unknown.
  }
}

async function initMainView() {
  els.loginView.style.display = 'none';
  els.mainView.style.display = 'block';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTab = tab;
  const platform = detectPlatform(tab?.url || '');
  els.platformHint.textContent = `Ready to capture on ${platform.label}.`;

  const state = await chrome.runtime.sendMessage({ type: 'GET_STATE' });
  renderState(state || { status: 'idle' });

  const micState = await checkMicPermission();
  if (micState !== 'granted' && (state?.status ?? 'idle') === 'idle') {
    els.micSetupNotice.style.display = 'block';
    els.idleControls.style.display = 'none';
  } else {
    els.micSetupNotice.style.display = 'none';
  }
}

async function init() {
  const session = await getSession();
  if (session) {
    await initMainView();
  } else {
    els.loginView.style.display = 'block';
    els.mainView.style.display = 'none';
  }
}

els.signInBtn.addEventListener('click', async () => {
  els.loginError.textContent = '';
  els.signInBtn.disabled = true;
  try {
    await signInWithPassword(els.email.value.trim(), els.password.value);
    await initMainView();
  } catch (err) {
    els.loginError.textContent = err.message;
  } finally {
    els.signInBtn.disabled = false;
  }
});

els.consentCheckbox.addEventListener('change', () => {
  els.startBtn.disabled = !els.consentCheckbox.checked;
});

els.openSetupBtn.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('setup.html') });
});

els.startBtn.addEventListener('click', async () => {
  els.mainError.textContent = '';
  if (!activeTab) return;
  const platform = detectPlatform(activeTab.url || '');
  try {
    const state = await chrome.runtime.sendMessage({
      type: 'START_CAPTURE',
      tabId: activeTab.id,
      meetingUrl: activeTab.url,
      platform: platform.value,
      title: activeTab.title || `${platform.label} session`,
    });
    if (state?.error) throw new Error(state.error);
    renderState(state);
  } catch (err) {
    els.mainError.textContent = err.message;
  }
});

els.stopBtn.addEventListener('click', async () => {
  els.mainError.textContent = '';
  try {
    const state = await chrome.runtime.sendMessage({ type: 'STOP_CAPTURE' });
    renderState(state);
  } catch (err) {
    els.mainError.textContent = err.message;
  }
});

els.signOutBtn.addEventListener('click', async () => {
  await signOut();
  els.loginView.style.display = 'block';
  els.mainView.style.display = 'none';
});

// Reflect state changes pushed from background (e.g. processing finished while popup was closed).
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'STATE_CHANGED') {
    renderState(message.state);
    if (message.state.status === 'idle' && message.state.error) {
      els.mainError.textContent = message.state.error;
    }
  }
});

init();
