from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="TutorMina AI API", description="AI services for TutorMina LMS platform")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Models ----

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

# ---- Endpoints ----

@app.get("/")
def read_root():
    return {"status": "ok", "service": "TutorMina AI API", "version": "0.2.0"}


@app.post("/summarise-text", response_model=SummaryResponse)
async def summarise_text(input: TextInput):
    """
    Summarise the given text using an open-source HuggingFace model.
    Currently a placeholder — will integrate a lightweight model like
    facebook/bart-large-cnn or philschmid/bart-large-cnn-samsum.
    """
    # TODO: Integrate HuggingFace model
    # from transformers import pipeline
    # summarizer = pipeline("summarization", model="facebook/bart-large-cnn")
    # result = summarizer(input.text, max_length=150, min_length=30)

    text_preview = input.text[:100] + "..." if len(input.text) > 100 else input.text
    return SummaryResponse(
        summary=f"[AI Summary Placeholder] This is a summary of the provided text: '{text_preview}'. When a HuggingFace model is connected, this will provide an accurate, concise summary.",
        key_points=[
            "Key point 1: Main concept from the text",
            "Key point 2: Supporting detail",
            "Key point 3: Conclusion or action item",
        ]
    )


@app.post("/summarise-file", response_model=InsightsResponse)
async def summarise_file(file: UploadFile = File(...)):
    """
    Upload a document (PDF, DOC, TXT) and get an AI-generated summary.
    Currently a placeholder.
    """
    # TODO: Extract text from uploaded file (PyPDF2, python-docx, etc.)
    # TODO: Run through HuggingFace summarization pipeline

    return InsightsResponse(
        summary=f"[AI Summary Placeholder] Summary of uploaded file: {file.filename}. Connect a HuggingFace model to enable real document summarisation.",
        insights=[
            f"File '{file.filename}' contains educational content",
            "The document covers multiple topics suitable for study revision",
            "Key formulas and definitions were identified",
        ],
        key_topics=["Document Analysis", "Content Extraction", "AI Processing"]
    )


@app.post("/extract-key-topics", response_model=TopicsResponse)
async def extract_key_topics(input: TextInput):
    """
    Extract key topics and concepts from the given text.
    Will use a zero-shot classification or NER model from HuggingFace.
    """
    # TODO: Integrate HuggingFace model
    # from transformers import pipeline
    # classifier = pipeline("zero-shot-classification", model="facebook/bart-large-mnli")

    return TopicsResponse(
        key_topics=[
            "Main Topic",
            "Supporting Concept",
            "Key Term 1",
            "Key Term 2",
            "Related Subject Area",
        ]
    )


@app.post("/generate-insights", response_model=InsightsResponse)
async def generate_insights(input: TextInput):
    """
    Analyse text and generate educational insights.
    Designed for analysing session notes, student progress, etc.
    """
    return InsightsResponse(
        summary="[AI Insights Placeholder] Analysis of the provided content shows consistent engagement patterns. Real insights will be generated once a HuggingFace model is connected.",
        insights=[
            "Content complexity is appropriate for the target audience",
            "3 key learning objectives can be extracted",
            "Suggested revision focus areas identified",
            "Content aligns with common curriculum standards",
        ],
        key_topics=["Learning Analytics", "Content Analysis", "Educational Insights"]
    )


@app.post("/process-audio", response_model=AudioResponse)
async def process_audio(file: UploadFile = File(...)):
    """
    Process an audio/video recording: transcribe and summarise.
    Will integrate Whisper (openai/whisper-small or similar open-source model).
    """
    # TODO: Integrate Whisper for transcription
    # from transformers import pipeline
    # transcriber = pipeline("automatic-speech-recognition", model="openai/whisper-small")

    return AudioResponse(
        transcript=f"[Transcript Placeholder] Transcription of '{file.filename}'. Will use Whisper (open-source) for real transcription.",
        summary=f"[Summary Placeholder] Summary of the audio recording '{file.filename}'.",
        insights=[
            "The session covered multiple key topics",
            "Student engagement was noted throughout",
            "Action items were discussed near the end",
        ]
    )
