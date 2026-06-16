from fastapi import FastAPI, UploadFile, File
from pydantic import BaseModel

app = FastAPI(title="TutorMina AI API", description="AI services for TutorMina platform")

class SummaryResponse(BaseModel):
    transcript: str
    summary: str
    insights: list[str]

@app.get("/")
def read_root():
    return {"status": "ok", "service": "TutorMina AI API"}

@app.post("/process-audio", response_model=SummaryResponse)
async def process_audio(file: UploadFile = File(...)):
    # Placeholder for Whisper and Summarization models integration
    # In production, this would stream the file or read from Supabase storage
    return SummaryResponse(
        transcript="This is a placeholder transcript. We will integrate a lightweight HuggingFace model.",
        summary="This is a placeholder summary.",
        insights=["Placeholder insight 1", "Placeholder insight 2"]
    )
