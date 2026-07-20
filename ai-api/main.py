"""
TutorMina AI API — HuggingFace Spaces Deployment
Real AI-powered endpoints using Gemini 2.0 Flash.

Deployment: HuggingFace Space (Docker SDK, CPU Basic Free)
Production URL: https://<username>-tutormina-ai.hf.space
"""

import os
import io
import asyncio
import json
import logging
import tempfile
import base64
import smtplib
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import Optional

from fastapi import (
    FastAPI, UploadFile, File, Form, HTTPException, Request,
    Depends, WebSocket, WebSocketDisconnect,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("tutormina-ai")

# ---------------------------------------------------------------------------
# Environment
# ---------------------------------------------------------------------------
_main_dir = os.path.dirname(os.path.abspath(__file__))
_parent_env = os.path.join(os.path.dirname(_main_dir), ".env")

if os.path.exists(".env"):
    load_dotenv(".env")
elif os.path.exists("../.env"):
    load_dotenv("../.env")
elif os.path.exists(_parent_env):
    load_dotenv(_parent_env)
else:
    load_dotenv()

# Core credentials
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")

# SMTP (local dev only — production uses Supabase email or a real provider)
SMTP_HOST = os.getenv("SMTP_HOST", "127.0.0.1")
SMTP_PORT = int(os.getenv("SMTP_PORT", "54325"))
EMAIL_FROM = os.getenv("EMAIL_FROM", "no-reply@tutormina.local")

# Origins
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,https://tutormina.netlify.app",
    ).split(",")
    if o.strip()
]

MAX_LIVESTREAM_SECONDS = int(os.getenv("MAX_LIVESTREAM_SECONDS", "5400"))

# ---------------------------------------------------------------------------
# Client Initialisation
# ---------------------------------------------------------------------------
gemini_client = None
if GEMINI_API_KEY:
    try:
        from google import genai
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
        logger.info("Gemini client initialised (model: gemini-2.0-flash).")
    except Exception as exc:
        logger.error("Failed to initialise Gemini client: %s", exc)

deepgram_client = None
if DEEPGRAM_API_KEY:
    try:
        from deepgram import DeepgramClient
        deepgram_client = DeepgramClient(DEEPGRAM_API_KEY)
        logger.info("Deepgram client initialised.")
    except Exception as exc:
        logger.error("Failed to initialise Deepgram client: %s", exc)

supabase = None
if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY:
    try:
        from supabase import create_client
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("Supabase client initialised.")
    except Exception as exc:
        logger.error("Failed to initialise Supabase client: %s", exc)

# ---------------------------------------------------------------------------
# FastAPI App
# ---------------------------------------------------------------------------
app = FastAPI(
    title="TutorMina AI API",
    description="AI services for the TutorMina LMS platform — powered by Gemini 2.0 Flash.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Auth ---
security = HTTPBearer(auto_error=False)


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Extract and verify Supabase JWT token from Authorization header."""
    if not credentials or not supabase:
        return None
    try:
        token = credentials.credentials
        user_response = supabase.auth.get_user(token)
        if user_response and user_response.user:
            return user_response.user
    except Exception as exc:
        logger.warning("Failed to authenticate user token: %s", exc)
    return None


# ---------------------------------------------------------------------------
# AI Helpers
# ---------------------------------------------------------------------------
GEMINI_MODEL = "gemini-2.0-flash"


async def _call_gemini(system_prompt: str, user_prompt: str, max_tokens: int = 4096) -> str:
    """Call Gemini 2.0 Flash for text generation."""
    if not gemini_client:
        raise HTTPException(
            status_code=503,
            detail="AI service not configured. Set GEMINI_API_KEY in environment.",
        )

    from google.genai import types

    response = await asyncio.to_thread(
        gemini_client.models.generate_content,
        model=GEMINI_MODEL,
        contents=user_prompt,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt,
            max_output_tokens=max_tokens,
            temperature=0.3,
        ),
    )
    return response.text


CHUNK_WORD_LIMIT = int(os.getenv("CHUNK_WORD_LIMIT", "5000"))


def _split_text_into_chunks(text: str, max_words: int = CHUNK_WORD_LIMIT) -> list[str]:
    """Split text into chunks of approximately max_words, splitting on paragraph boundaries."""
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = []
    current_word_count = 0

    for para in paragraphs:
        para_words = len(para.split())
        if current_word_count + para_words > max_words and current_chunk:
            chunks.append("\n\n".join(current_chunk))
            current_chunk = [para]
            current_word_count = para_words
        else:
            current_chunk.append(para)
            current_word_count += para_words

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    return chunks if chunks else [text]


async def _call_gemini_chunked(system_prompt: str, text: str, synthesis_prompt: str = "") -> str:
    """Process potentially long text through Gemini in chunks, then synthesize."""
    word_count = len(text.split())

    if word_count <= CHUNK_WORD_LIMIT:
        return await _call_gemini(system_prompt, text)

    chunks = _split_text_into_chunks(text)
    logger.info("Chunking text: %d words -> %d chunks", word_count, len(chunks))

    chunk_results = []
    for i, chunk in enumerate(chunks):
        chunk_header = f"[Chunk {i + 1} of {len(chunks)}]\n\n"
        result = await _call_gemini(system_prompt, chunk_header + chunk)
        chunk_results.append(f"--- Chunk {i + 1}/{len(chunks)} ---\n{result}")

    combined = "\n\n".join(chunk_results)
    merge_system = (
        synthesis_prompt or
        "You are a document editor. Merge the following partial analyses into a single, "
        "cohesive, deduplicated document. Remove redundant headers. Preserve all unique information. "
        "Output clean, well-structured markdown."
    )
    return await _call_gemini(merge_system, combined)


# ---------------------------------------------------------------------------
# Pydantic Models
# ---------------------------------------------------------------------------
class TextInput(BaseModel):
    text: str


class SummaryResponse(BaseModel):
    summary: str
    key_points: list[str]


class TopicsResponse(BaseModel):
    key_topics: list[str]


class InsightsResponse(BaseModel):
    summary: str
    insights: list[str]
    key_topics: list[str]


class AudioResponse(BaseModel):
    transcript: str
    summary: str
    insights: list[str]


class FactCheckRequest(BaseModel):
    transcript: str
    claims: Optional[list] = None
    use_uploaded_resources: Optional[bool] = False
    resource_context: Optional[str] = None


class ScrapeRequest(BaseModel):
    url: str
    summarise: Optional[bool] = False


class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-US-JennyNeural"


class ApplicationEmailInput(BaseModel):
    to: str
    subject: str
    body: str


class SessionSummaryRequest(BaseModel):
    transcript: str
    ai_notes: Optional[str] = None
    fact_check_results: Optional[list] = None
    duration_seconds: Optional[int] = None
    booking_topic: Optional[str] = None


class LivestreamAINotesRequest(BaseModel):
    transcript: str
    context: Optional[dict] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def read_root():
    return {
        "status": "ok",
        "service": "TutorMina AI API",
        "version": "1.0.0",
        "ai_provider": "Gemini 2.0 Flash" if gemini_client else "not configured",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/health")
def health_check():
    return {"status": "healthy"}


# ---- Text Summarisation ----

@app.post("/summarise-text", response_model=SummaryResponse)
async def summarise_text(input: TextInput):
    """Summarise the given text using Gemini 2.0 Flash."""
    system_prompt = (
        "You are an expert educational assistant. Summarise the provided text concisely. "
        "Return your response as a JSON object with two keys:\n"
        '  "summary": a concise paragraph summary\n'
        '  "key_points": an array of 3-5 key points\n'
        "Return ONLY the JSON object, no other text."
    )

    try:
        result = await _call_gemini_chunked(system_prompt, input.text)
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(result)
        return SummaryResponse(
            summary=data.get("summary", result),
            key_points=data.get("key_points", ["See summary above"]),
        )
    except json.JSONDecodeError:
        return SummaryResponse(summary=result, key_points=["See summary above"])
    except Exception as exc:
        logger.exception("Summarisation error")
        raise HTTPException(status_code=503, detail=f"AI service error: {exc}")


# ---- File Summarisation ----

@app.post("/summarise-file", response_model=InsightsResponse)
async def summarise_file(file: UploadFile = File(...)):
    """Upload a document (PDF, DOC, TXT) and get an AI-generated summary."""
    file_bytes = await file.read()
    filename = file.filename or "document"

    # Extract text based on file type
    text = ""
    if filename.lower().endswith(".pdf"):
        text = _extract_pdf_text(file_bytes)
    elif filename.lower().endswith((".txt", ".md", ".csv")):
        text = file_bytes.decode("utf-8", errors="replace")
    else:
        text = file_bytes.decode("utf-8", errors="replace")

    if not text.strip():
        raise HTTPException(status_code=400, detail="Could not extract text from the uploaded file.")

    system_prompt = (
        "You are an expert educational assistant. Analyse the following document content and return "
        "a JSON object with:\n"
        '  "summary": a concise summary of the document\n'
        '  "insights": an array of 3-5 educational insights\n'
        '  "key_topics": an array of key topics covered\n'
        "Return ONLY the JSON object."
    )

    try:
        result = await _call_gemini_chunked(system_prompt, f"Document: {filename}\n\n{text}")
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(result)
        return InsightsResponse(
            summary=data.get("summary", ""),
            insights=data.get("insights", []),
            key_topics=data.get("key_topics", []),
        )
    except json.JSONDecodeError:
        return InsightsResponse(summary=result, insights=[], key_topics=[])
    except Exception as exc:
        logger.exception("File summarisation error")
        raise HTTPException(status_code=503, detail=f"AI service error: {exc}")


# ---- Key Topic Extraction ----

@app.post("/extract-key-topics", response_model=TopicsResponse)
async def extract_key_topics(input: TextInput):
    """Extract key topics and concepts from the given text."""
    system_prompt = (
        "You are an expert at identifying key topics and concepts in educational content. "
        "Extract the most important topics from the provided text. "
        "Return a JSON object with a single key:\n"
        '  "key_topics": an array of 5-8 key topics as strings\n'
        "Return ONLY the JSON object."
    )

    try:
        result = await _call_gemini(system_prompt, input.text)
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(result)
        return TopicsResponse(key_topics=data.get("key_topics", []))
    except json.JSONDecodeError:
        return TopicsResponse(key_topics=[result])
    except Exception as exc:
        logger.exception("Topic extraction error")
        raise HTTPException(status_code=503, detail=f"AI service error: {exc}")


# ---- Generate Insights ----

@app.post("/generate-insights", response_model=InsightsResponse)
async def generate_insights(input: TextInput):
    """Analyse text and generate educational insights."""
    system_prompt = (
        "You are an expert educational analyst. Analyse the provided content and generate insights. "
        "Return a JSON object with:\n"
        '  "summary": a concise analysis summary\n'
        '  "insights": an array of 4-6 actionable insights\n'
        '  "key_topics": an array of key topics\n'
        "Return ONLY the JSON object."
    )

    try:
        result = await _call_gemini_chunked(system_prompt, input.text)
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        data = json.loads(result)
        return InsightsResponse(
            summary=data.get("summary", ""),
            insights=data.get("insights", []),
            key_topics=data.get("key_topics", []),
        )
    except json.JSONDecodeError:
        return InsightsResponse(summary=result, insights=[], key_topics=[])
    except Exception as exc:
        logger.exception("Insights generation error")
        raise HTTPException(status_code=503, detail=f"AI service error: {exc}")


# ---- PDF Parsing ----

def _extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from a PDF file using pdfplumber (preferred) or PyPDF2 fallback."""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:
                    pages.append(text)
            return "\n\n".join(pages)
    except ImportError:
        pass

    try:
        import PyPDF2
        reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        pages = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                pages.append(text)
        return "\n\n".join(pages)
    except ImportError:
        pass

    return ""


@app.post("/parse-pdf")
async def parse_pdf(file: UploadFile = File(...)):
    """Extract text content from a PDF file."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="File must be a PDF.")

    file_bytes = await file.read()
    text = _extract_pdf_text(file_bytes)

    if not text.strip():
        raise HTTPException(status_code=422, detail="Could not extract text from PDF. It may be image-only.")

    return {
        "filename": file.filename,
        "text": text,
        "page_count": text.count("\n\n") + 1,
        "word_count": len(text.split()),
    }


# ---- Image Scanning / OCR via Gemini Vision ----

@app.post("/extract-image")
async def extract_image_text(file: UploadFile = File(...)):
    """Scan an image and extract text using Gemini's vision capabilities."""
    if not gemini_client:
        raise HTTPException(status_code=503, detail="AI service not configured.")

    file_bytes = await file.read()
    mime_type = file.content_type or "image/png"

    from google.genai import types

    try:
        response = await asyncio.to_thread(
            gemini_client.models.generate_content,
            model=GEMINI_MODEL,
            contents=[
                types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                "Extract ALL text visible in this image. Include any handwritten text, "
                "printed text, numbers, formulas, diagrams with labels, and table contents. "
                "Preserve the layout structure as much as possible using markdown formatting. "
                "If there are mathematical formulas, represent them in LaTeX notation.",
            ],
            config=types.GenerateContentConfig(
                max_output_tokens=4096,
                temperature=0.1,
            ),
        )
        return {
            "filename": file.filename,
            "extracted_text": response.text,
            "mime_type": mime_type,
        }
    except Exception as exc:
        logger.exception("Image extraction error")
        raise HTTPException(status_code=503, detail=f"Image processing failed: {exc}")


# ---- URL Scraping ----

@app.post("/scrape-url")
async def scrape_url(request: ScrapeRequest):
    """Scrape a URL, extract text, and optionally summarise."""
    import httpx
    from bs4 import BeautifulSoup

    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(request.url, headers={
                "User-Agent": "Mozilla/5.0 (TutorMina Educational Platform)"
            })
            resp.raise_for_status()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not fetch URL: {exc}")

    soup = BeautifulSoup(resp.text, "html.parser")

    # Remove scripts, styles, nav, footer
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    title = soup.title.string if soup.title else ""

    # Trim to reasonable length
    if len(text) > 50000:
        text = text[:50000] + "\n\n[Content truncated — original page was very long]"

    result = {
        "url": request.url,
        "title": title,
        "text": text,
        "word_count": len(text.split()),
    }

    if request.summarise and text.strip():
        try:
            summary = await _call_gemini_chunked(
                "You are an expert summariser. Summarise the following web page content concisely. "
                "Focus on the most important information. Use markdown formatting.",
                f"URL: {request.url}\nTitle: {title}\n\nContent:\n{text}",
            )
            result["summary"] = summary
        except Exception as exc:
            logger.warning("URL summarisation failed: %s", exc)
            result["summary"] = None

    return result


# ---- Speech-to-Text (Audio Upload) ----

@app.post("/speech-to-text")
async def speech_to_text(file: UploadFile = File(...)):
    """Transcribe audio using Gemini's audio understanding or Deepgram."""
    file_bytes = await file.read()
    mime_type = file.content_type or "audio/wav"

    # Try Gemini first (multimodal audio understanding)
    if gemini_client:
        from google.genai import types
        try:
            response = await asyncio.to_thread(
                gemini_client.models.generate_content,
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(data=file_bytes, mime_type=mime_type),
                    "Transcribe this audio recording accurately. Include speaker labels if "
                    "multiple speakers are present (e.g., 'Speaker 1:', 'Speaker 2:'). "
                    "Include timestamps where possible. Preserve filler words and pauses. "
                    "Output the transcript as clean text.",
                ],
                config=types.GenerateContentConfig(
                    max_output_tokens=8192,
                    temperature=0.1,
                ),
            )
            return {
                "transcript": response.text,
                "method": "gemini",
                "filename": file.filename,
            }
        except Exception as exc:
            logger.warning("Gemini STT failed, trying Deepgram: %s", exc)

    # Fallback: Deepgram
    if deepgram_client:
        from deepgram import PrerecordedOptions
        import httpx as hx

        try:
            options = PrerecordedOptions(
                model="nova-2",
                smart_format=True,
                diarize=True,
                punctuate=True,
            )
            payload = {"buffer": file_bytes}
            response = await asyncio.to_thread(
                deepgram_client.listen.prerecorded.v("1").transcribe_file,
                payload,
                options,
                timeout=hx.Timeout(300.0, connect=30.0),
            )
            response_dict = response.to_dict() if hasattr(response, "to_dict") else response
            channels = response_dict.get("results", {}).get("channels", [])
            transcript = ""
            if channels:
                alts = channels[0].get("alternatives", [])
                if alts:
                    transcript = alts[0].get("transcript", "")
            return {
                "transcript": transcript,
                "method": "deepgram",
                "filename": file.filename,
            }
        except Exception as exc:
            logger.warning("Deepgram STT failed: %s", exc)

    raise HTTPException(status_code=503, detail="No transcription service available.")


# ---- Text-to-Speech ----

@app.post("/text-to-speech")
async def text_to_speech(payload: TTSRequest):
    """Convert text to speech using edge-tts (free, high quality)."""
    if not payload.text.strip():
        raise HTTPException(status_code=400, detail="Text is empty.")

    import edge_tts

    fd, temp_path = tempfile.mkstemp(suffix=".mp3")
    os.close(fd)

    try:
        communicate = edge_tts.Communicate(payload.text, payload.voice)
        await communicate.save(temp_path)
        return FileResponse(
            path=temp_path,
            media_type="audio/mpeg",
            filename="tutormina_speech.mp3",
        )
    except Exception as exc:
        logger.exception("TTS generation failed")
        raise HTTPException(status_code=500, detail=f"TTS generation failed: {exc}")


# ---- Audio Processing (Transcribe + Summarise) ----

@app.post("/process-audio", response_model=AudioResponse)
async def process_audio(file: UploadFile = File(...)):
    """Process an audio/video recording: transcribe and summarise."""
    # First transcribe
    file_bytes = await file.read()

    # Create a fake UploadFile for reuse
    transcript_result = ""
    if gemini_client:
        from google.genai import types
        try:
            response = await asyncio.to_thread(
                gemini_client.models.generate_content,
                model=GEMINI_MODEL,
                contents=[
                    types.Part.from_bytes(
                        data=file_bytes,
                        mime_type=file.content_type or "audio/wav",
                    ),
                    "Transcribe this audio recording accurately with speaker labels.",
                ],
                config=types.GenerateContentConfig(
                    max_output_tokens=8192,
                    temperature=0.1,
                ),
            )
            transcript_result = response.text
        except Exception as exc:
            logger.warning("Gemini audio processing failed: %s", exc)

    if not transcript_result:
        transcript_result = "[Transcription unavailable — configure Gemini or Deepgram API key]"

    # Then summarise the transcript
    summary = ""
    insights = []
    if transcript_result and gemini_client:
        try:
            result = await _call_gemini(
                "You are an expert educational assistant. Summarise this session transcript. "
                "Return a JSON object with:\n"
                '  "summary": concise summary\n'
                '  "insights": array of 3-5 key insights\n'
                "Return ONLY the JSON object.",
                transcript_result,
            )
            result = result.strip()
            if result.startswith("```"):
                result = result.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            data = json.loads(result)
            summary = data.get("summary", "")
            insights = data.get("insights", [])
        except Exception:
            summary = "Summary generation failed."

    return AudioResponse(
        transcript=transcript_result,
        summary=summary,
        insights=insights,
    )


# ---- Fact-Checking Pipeline (matching RelaxnTakeNotes pattern) ----

@app.post("/fact-check")
async def fact_check(payload: FactCheckRequest, user=Depends(get_current_user)):
    """Verify factual claims using web search (Serper) + Gemini evaluation.

    Pipeline:
    1. Detect checkable claims from transcript (if not provided)
    2. For each claim, search the web for evidence (via Serper API)
    3. Cross-reference against uploaded resources if provided
    4. Feed claim + evidence to Gemini for evaluation
    5. Return verdict: TRUE, FALSE, MISLEADING, UNVERIFIABLE
    """
    if not payload.claims and not payload.transcript:
        raise HTTPException(status_code=400, detail="No claims or transcript provided.")

    # Step 1: Detect claims if not pre-extracted
    claims_to_check = payload.claims or []
    if not claims_to_check and payload.transcript:
        detect_result = await _detect_claims(payload.transcript)
        claims_to_check = detect_result

    if not claims_to_check:
        return {"results": [], "message": "No verifiable claims detected."}

    # Step 2: Check each claim
    import requests as req

    results = []
    for claim_obj in claims_to_check:
        claim_text = claim_obj.get("claim", "") if isinstance(claim_obj, dict) else str(claim_obj)
        if not claim_text.strip():
            continue

        # Search for evidence
        evidence = ""
        sources = []
        if SERPER_API_KEY:
            try:
                search_resp = await asyncio.to_thread(
                    req.post,
                    "https://google.serper.dev/search",
                    headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                    json={"q": claim_text, "num": 5},
                    timeout=10.0,
                )
                if search_resp.status_code == 200:
                    search_data = search_resp.json()
                    for item in search_data.get("organic", [])[:5]:
                        title = item.get("title", "")
                        snippet = item.get("snippet", "")
                        link = item.get("link", "")
                        evidence += f"Source: {title}\n{snippet}\nURL: {link}\n\n"
                        sources.append({"title": title, "url": link, "snippet": snippet})
                    kg = search_data.get("knowledgeGraph", {})
                    if kg:
                        evidence += f"Knowledge Graph: {kg.get('title', '')} — {kg.get('description', '')}\n"
            except Exception as search_err:
                logger.warning("Serper search failed: %s", search_err)

        # AI evaluation
        eval_system = (
            "You are a rigorous fact-checker. Evaluate the following claim against the provided evidence. "
            "You MUST return a JSON object with:\n"
            '{"verdict": "TRUE|FALSE|MISLEADING|UNVERIFIABLE", '
            '"confidence": 0.0-1.0, '
            '"explanation": "brief explanation", '
            '"key_evidence": "the most relevant piece of evidence"}\n\n'
            "RULES:\n"
            "- TRUE: Factually correct based on evidence\n"
            "- FALSE: Demonstrably incorrect\n"
            "- MISLEADING: Contains partial truth but presented misleadingly\n"
            "- UNVERIFIABLE: Insufficient evidence\n"
            "Return ONLY the JSON object."
        )

        eval_prompt = f"Claim: {claim_text}\n\n"
        if evidence:
            eval_prompt += f"Web Evidence:\n{evidence}\n"
        if payload.resource_context:
            eval_prompt += f"Uploaded Resource Context:\n{payload.resource_context}\n"
        if not evidence and not payload.resource_context:
            eval_prompt += "No external evidence available. Use your knowledge base only.\n"

        try:
            eval_result = await _call_gemini(eval_system, eval_prompt)
            eval_result = eval_result.strip()
            if eval_result.startswith("```"):
                eval_result = eval_result.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            verdict_data = json.loads(eval_result)
            results.append({
                "claim": claim_text,
                "speaker": claim_obj.get("speaker", "") if isinstance(claim_obj, dict) else "",
                "category": claim_obj.get("category", "") if isinstance(claim_obj, dict) else "",
                "verdict": verdict_data.get("verdict", "UNVERIFIABLE"),
                "confidence": verdict_data.get("confidence", 0.5),
                "explanation": verdict_data.get("explanation", ""),
                "key_evidence": verdict_data.get("key_evidence", ""),
                "sources": sources,
                "used_web_search": bool(evidence),
            })
        except Exception as eval_err:
            logger.warning("Fact-check evaluation failed: %s", eval_err)
            results.append({
                "claim": claim_text,
                "speaker": claim_obj.get("speaker", "") if isinstance(claim_obj, dict) else "",
                "verdict": "UNVERIFIABLE",
                "confidence": 0.0,
                "explanation": "Evaluation failed.",
                "sources": sources,
                "used_web_search": bool(evidence),
            })

    return {"results": results}


async def _detect_claims(transcript: str) -> list[dict]:
    """Detect factual claims from a transcript segment using Gemini."""
    system_prompt = (
        "You are a fact-check analyst. Identify SPECIFIC, VERIFIABLE factual claims "
        "in a transcript — statistics, dates, events, scientific facts, policy details.\n\n"
        "RULES:\n"
        "- ONLY extract claims that are specific and verifiable\n"
        "- SKIP opinions, predictions, subjective statements\n"
        "- Each claim should be self-contained\n\n"
        "Return a JSON array of objects:\n"
        '  [{"claim": "the claim", "speaker": "Speaker X", '
        '"severity": "high|medium|low", "category": "statistic|date|event|science|policy"}]\n'
        "If no verifiable claims found, return: []\n"
        "Return ONLY the JSON array."
    )

    try:
        result = await _call_gemini_chunked(
            system_prompt, transcript,
            synthesis_prompt=(
                "Merge these partial claim extractions into a single JSON array. "
                "Deduplicate claims. Return ONLY the merged JSON array."
            ),
        )
        result = result.strip()
        if result.startswith("```"):
            result = result.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
        return json.loads(result)
    except Exception:
        return []


# ---- Session Summary (Post-Session) ----

@app.post("/summarise-session")
async def summarise_session(payload: SessionSummaryRequest):
    """Generate a comprehensive post-session summary with insights and action items."""
    system_prompt = (
        "You are an expert educational session analyst. Generate a comprehensive meeting package "
        "from this tutoring/coaching session. Include:\n\n"
        "# Session Summary\n"
        "## 1. Executive Summary\n"
        "A concise 2-3 paragraph overview.\n\n"
        "## 2. Key Topics Covered\n"
        "Main subjects discussed with bullet points.\n\n"
        "## 3. Key Insights\n"
        "Important takeaways and observations.\n\n"
        "## 4. Action Items\n"
        "Specific tasks with owners if mentioned.\n\n"
        "## 5. Areas for Improvement\n"
        "Suggestions for the student's development.\n\n"
        "## 6. Verified Claims\n"
        "If fact-check results are provided, include them.\n\n"
        "## 7. Next Steps\n"
        "Recommendations for follow-up sessions.\n\n"
        "Use clean, professional markdown."
    )

    content = f"Session Transcript:\n{payload.transcript}\n\n"
    if payload.booking_topic:
        content += f"Session Topic: {payload.booking_topic}\n\n"
    if payload.duration_seconds:
        mins = payload.duration_seconds // 60
        content += f"Session Duration: {mins} minutes\n\n"
    if payload.ai_notes:
        content += f"AI-Generated Notes:\n{payload.ai_notes}\n\n"
    if payload.fact_check_results:
        content += "Fact-Check Results:\n"
        for r in payload.fact_check_results:
            if isinstance(r, dict):
                content += f"- Claim: {r.get('claim', 'N/A')} → {r.get('verdict', 'N/A')} ({r.get('confidence', 'N/A')})\n"
        content += "\n"

    try:
        result = await _call_gemini_chunked(system_prompt, content)
        return {"summary": result}
    except Exception as exc:
        logger.exception("Session summary error")
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable.")


# ---- LiveStream AI Notes ----

@app.post("/livestream/ai-notes")
async def generate_livestream_notes(payload: LivestreamAINotesRequest):
    """Generate real-time AI notes from a live transcript."""
    if not payload.transcript.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty.")

    system_prompt = (
        "You are an expert real-time session assistant for an educational tutoring platform. "
        "Analyze the live transcript and generate structured notes:\n"
        "1. **Key Topics** — Main subjects discussed\n"
        "2. **Important Points** — Key concepts explained\n"
        "3. **Action Items** — Tasks or homework mentioned\n"
        "4. **Questions Raised** — Questions asked by the student\n"
        "5. **Summary** — Brief running summary\n\n"
        "Format using clean markdown. Be concise but comprehensive."
    )

    context_str = ""
    if payload.context:
        context_str = "\nContext: " + "\n".join(f"{k}: {v}" for k, v in payload.context.items() if v)

    full_text = f"Live Session Transcript:{context_str}\n\n{payload.transcript}"

    try:
        result = await _call_gemini_chunked(
            system_prompt, full_text,
            synthesis_prompt=(
                "Merge these partial note sets from the same session into a single cohesive set. "
                "Deduplicate items. Output clean markdown."
            ),
        )
        return {"result": result}
    except Exception as exc:
        logger.exception("LiveStream AI notes error")
        raise HTTPException(status_code=503, detail="AI service temporarily unavailable.")


# ---- LiveStream WebSocket (Real-Time Transcription via Deepgram) ----

@app.websocket("/ws/livestream")
async def livestream_websocket(websocket: WebSocket):
    """WebSocket endpoint for real-time audio transcription via Deepgram.

    Protocol:
    - Client sends binary audio chunks (PCM from browser AudioContext)
    - Server streams back JSON messages:
      {"type": "transcript", "is_final": bool, "text": str, "speaker": int}
      {"type": "status", "message": str}
      {"type": "error", "message": str}
    """
    await websocket.accept()
    logger.info("LiveStream WebSocket connected")

    if not deepgram_client:
        await websocket.send_json({
            "type": "error",
            "message": "Real-time transcription not configured. Set DEEPGRAM_API_KEY.",
        })
        await websocket.close()
        return

    from deepgram import LiveOptions, LiveTranscriptionEvents

    dg_connection = None
    is_closing = False

    try:
        dg_connection = deepgram_client.listen.websocket.v("1")

        async def on_message(self, result, **kwargs):
            try:
                channel = result.channel
                if channel and channel.alternatives and len(channel.alternatives) > 0:
                    alt = channel.alternatives[0]
                    transcript_text = alt.transcript
                    if transcript_text.strip():
                        speaker = 0
                        if alt.words and len(alt.words) > 0:
                            speaker = getattr(alt.words[0], "speaker", 0) or 0

                        msg = {
                            "type": "transcript",
                            "is_final": result.is_final,
                            "text": transcript_text,
                            "speaker": speaker,
                            "start": getattr(result, "start", 0.0),
                            "end": getattr(result, "start", 0.0) + getattr(result, "duration", 0.0),
                            "speech_final": getattr(result, "speech_final", False),
                        }
                        if not is_closing:
                            await websocket.send_json(msg)
            except Exception as e:
                logger.warning("Error sending transcript: %s", e)

        async def on_error(self, error, **kwargs):
            logger.error("Deepgram error: %s", error)
            try:
                if not is_closing:
                    await websocket.send_json({"type": "error", "message": str(error)})
            except Exception:
                pass

        async def on_close(self, close, **kwargs):
            logger.info("Deepgram connection closed")

        async def on_open(self, open, **kwargs):
            logger.info("Deepgram connection opened")
            try:
                if not is_closing:
                    await websocket.send_json({"type": "status", "message": "Connected. Listening..."})
            except Exception:
                pass

        dg_connection.on(LiveTranscriptionEvents.Transcript, on_message)
        dg_connection.on(LiveTranscriptionEvents.Error, on_error)
        dg_connection.on(LiveTranscriptionEvents.Close, on_close)
        dg_connection.on(LiveTranscriptionEvents.Open, on_open)

        options = LiveOptions(
            model="nova-2",
            language="en",
            smart_format=True,
            punctuate=True,
            diarize=True,
            interim_results=True,
            utterance_end_ms="1500",
            vad_events=True,
            encoding="linear16",
            sample_rate=16000,
            channels=1,
        )

        started = dg_connection.start(options)
        if not started:
            await websocket.send_json({"type": "error", "message": "Failed to start transcription."})
            await websocket.close()
            return

        await websocket.send_json({"type": "status", "message": "Ready to receive audio."})

        while True:
            try:
                data = await websocket.receive()
                if "bytes" in data:
                    dg_connection.send(data["bytes"])
                elif "text" in data:
                    try:
                        control = json.loads(data["text"])
                        if control.get("type") == "stop":
                            logger.info("Client requested stop")
                            break
                    except json.JSONDecodeError:
                        pass
            except WebSocketDisconnect:
                logger.info("WebSocket disconnected")
                break
            except Exception as recv_err:
                logger.warning("WebSocket receive error: %s", recv_err)
                break

    except Exception as exc:
        logger.exception("LiveStream WebSocket error")
        try:
            if not is_closing:
                await websocket.send_json({"type": "error", "message": str(exc)})
        except Exception:
            pass
    finally:
        is_closing = True
        if dg_connection:
            try:
                dg_connection.finish()
            except Exception:
                pass
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("LiveStream WebSocket cleanup complete")


# ---- Email (Existing feature) ----

@app.post("/send-application-email")
async def send_application_email(input: ApplicationEmailInput):
    """Send a professional-application status email."""
    message = MIMEText(input.body)
    message["Subject"] = input.subject
    message["From"] = EMAIL_FROM
    message["To"] = input.to

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=5) as server:
            server.send_message(message)
    except OSError as exc:
        raise HTTPException(status_code=502, detail=f"Could not send email: {exc}") from exc

    return {"status": "sent"}
