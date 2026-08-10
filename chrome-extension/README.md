# TutorMina Chommie (browser extension)

Captures a Google Meet / Microsoft Teams / Zoom-web call locally in the browser — tab audio
mixed with your mic — and feeds the recording into TutorMina's existing AI pipeline
(transcription + fact-check) once you stop. Results show up on the Session Recordings page
and in the student's Learning Zone.

This is a manual-invite, local-capture companion, not an autonomous bot: one participant has
to click "Start Chommie" while already in the call. See the "Session Recordings" plan/context
in the main app for why (zero-budget rollout — no paid meeting-bot vendor).

## Setup (pilot / unpacked install)

1. Edit `config.js` with your Supabase project URL + anon key (same values as
   `frontend/.env.local`) and your `ai-api` URL.
2. Open `chrome://extensions`, enable **Developer mode**.
3. Click **Load unpacked** and select this `chrome-extension/` folder.
4. Click the extension icon while on a Meet/Teams/Zoom tab, sign in with your TutorMina
   account, check the consent box, and click **Start Chommie**.

## How it works

- `popup.js` — login + start/stop UI, detects the platform from the active tab's URL.
- `background.js` — service worker; creates the offscreen document, relays start/stop
  commands, tracks state in `chrome.storage.session` so it survives the service worker being
  killed mid-recording (offscreen documents are not subject to the same lifetime limits).
- `offscreen.js` — does the actual work: `chrome.tabCapture` + mic `getUserMedia`, mixed via
  `AudioContext`, recorded with `MediaRecorder`. On stop, uploads the recording to the
  `session-recordings` Supabase Storage bucket, inserts a `session_recordings` row, then calls
  the existing `/process-audio` and `/fact-check` endpoints on `ai-api` directly.
- `supabaseRest.js` — minimal fetch-based Supabase client (auth, table insert/update, storage
  upload). No `@supabase/supabase-js` bundling here since this is a plain, build-tool-free MV3
  extension.

## Known limitations (v1)

- Chrome only (uses `chrome.tabCapture`, not available as a cross-browser API).
- The tab must stay open and active in the capturing browser for the whole call.
- Not published to the Chrome Web Store yet — side-loaded ("Load unpacked") for pilot users.
- No live in-call insights; notes/fact-check appear after you click "Stop & Upload".
