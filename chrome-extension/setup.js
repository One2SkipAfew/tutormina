const btn = document.getElementById('grantBtn');
const status = document.getElementById('status');

btn.addEventListener('click', async () => {
  status.textContent = '';
  status.className = '';
  btn.disabled = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
    status.textContent = 'Microphone access granted. You can close this tab now.';
    status.className = 'ok';
  } catch (err) {
    status.textContent = 'Failed: ' + err.message;
    status.className = 'err';
  } finally {
    btn.disabled = false;
  }
});
