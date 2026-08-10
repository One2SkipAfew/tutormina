---
title: TutorMina AI API
emoji: 📚
colorFrom: green
colorTo: yellow
sdk: docker
app_port: 7860
pinned: false
---

# TutorMina AI API

AI-powered backend for the TutorMina LMS platform — text summarisation, transcription,
fact-checking, image OCR, and real-time live session support.

**AI Provider**: [Groq](https://console.groq.com) (open-source models: Llama 3.3 70B, Whisper Large v3, Qwen vision)
**Runtime**: FastAPI + Uvicorn
**Deployment**: HuggingFace Spaces (Docker SDK, CPU Basic Free)

## Quick Start (Local Dev)

```bash
# Create virtual environment
python -m venv venv
venv\Scripts\activate   # Windows
# source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Copy and fill in your API keys
cp .env.example .env

# Run the server
uvicorn main:app --reload --port 8000
```

## Production Deployment (HuggingFace Spaces)

1. **Create a new Space** at [huggingface.co/new-space](https://huggingface.co/new-space):
   - SDK: **Docker**
   - Hardware: **CPU Basic (Free)**

2. **Push the `ai-api/` directory** as the Space's repo:
   ```bash
   cd ai-api
   git init
   git remote add space https://huggingface.co/spaces/<username>/tutormina-ai
   git add .
   git commit -m "Deploy TutorMina AI API"
   git push space main
   ```

3. **Set environment variables** in the Space's Settings → Repository Secrets:

   | Variable | Source | Required |
   |----------|--------|----------|
   | `GROQ_API_KEY` | [console.groq.com/keys](https://console.groq.com/keys) | ✅ |
   | `DEEPGRAM_API_KEY` | [console.deepgram.com](https://console.deepgram.com) | Optional (for real-time WS STT) |
   | `SERPER_API_KEY` | [serper.dev](https://serper.dev) | Optional (for web search fact-checking) |
   | `SUPABASE_URL` | Supabase dashboard | ✅ |
   | `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard | ✅ |
   | `RESEND_API_KEY` | [resend.com](https://resend.com) | Optional (for production emails) |
   | `ENVIRONMENT` | — | Set to `production` |
   | `ALLOWED_ORIGINS` | — | `https://tutormina.netlify.app` |

4. **Verify**: Visit `https://<username>-tutormina-ai.hf.space/health` — should return `{"status": "healthy"}`.

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Service info |
| `/health` | GET | Health check |
| `/summarise-text` | POST | Summarise text |
| `/summarise-file` | POST | Summarise uploaded document |
| `/extract-key-topics` | POST | Extract key topics |
| `/generate-insights` | POST | Generate educational insights |
| `/parse-pdf` | POST | Extract text from PDF |
| `/extract-image` | POST | OCR via Groq vision |
| `/scrape-url` | POST | Scrape URL + optional summary |
| `/speech-to-text` | POST | Transcribe audio (Groq Whisper) |
| `/text-to-speech` | POST | TTS via edge-tts |
| `/process-audio` | POST | Transcribe + summarise audio |
| `/fact-check` | POST | Fact-check claims via web search + AI |
| `/summarise-session` | POST | Post-session summary package |
| `/livestream/ai-notes` | POST | Generate live session notes |
| `/ws/livestream` | WS | Real-time transcription (Deepgram) |
| `/send-application-email` | POST | Send application status email |
