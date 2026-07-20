/**
 * TutorMina AI API Client
 *
 * Centralised API client for all AI-powered endpoints.
 * Points to HuggingFace Space in production, localhost:8000 in development.
 */

const getAiApiBaseUrl = (): string => {
  // Explicit env var takes precedence
  if (import.meta.env.VITE_AI_API_URL) return import.meta.env.VITE_AI_API_URL;
  // Local development
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:8000';
  }
  // Fallback — same origin (Netlify redirect or proxy)
  return '';
};

const AI_API_BASE = getAiApiBaseUrl();

/** Derive WebSocket URL from the API base. */
export const getWsUrl = (path: string = '/ws/livestream'): string => {
  const base = AI_API_BASE || window.location.origin;
  const wsProtocol = base.startsWith('https') ? 'wss' : 'ws';
  const host = base.replace(/^https?:\/\//, '');
  return `${wsProtocol}://${host}${path}`;
};

// ---- Types ----

export interface SummaryResponse {
  summary: string;
  key_points: string[];
}

export interface InsightsResponse {
  summary: string;
  insights: string[];
  key_topics: string[];
}

export interface TopicsResponse {
  key_topics: string[];
}

export interface AudioResponse {
  transcript: string;
  summary: string;
  insights: string[];
}

export interface FactCheckResult {
  claim: string;
  speaker: string;
  category: string;
  verdict: 'TRUE' | 'FALSE' | 'MISLEADING' | 'UNVERIFIABLE';
  confidence: number;
  explanation: string;
  key_evidence: string;
  sources: { title: string; url: string; snippet: string }[];
  used_web_search: boolean;
}

export interface FactCheckResponse {
  results: FactCheckResult[];
  message?: string;
}

export interface ScrapeResponse {
  url: string;
  title: string;
  text: string;
  word_count: number;
  summary?: string;
}

export interface ParsedPdf {
  filename: string;
  text: string;
  page_count: number;
  word_count: number;
}

export interface ExtractedImage {
  filename: string;
  extracted_text: string;
  mime_type: string;
}

export interface SpeechToTextResponse {
  transcript: string;
  method: string;
  filename: string;
}

export interface SessionSummaryResponse {
  summary: string;
}

export interface LiveNotesResponse {
  result: string;
}

// ---- Helper ----

async function aiApiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${AI_API_BASE}${path}`;
  const response = await fetch(url, options);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => 'Unknown error');
    throw new Error(`AI API error (${response.status}): ${errorBody}`);
  }

  return response.json();
}

// ---- API Functions ----

/** Summarise text using Gemini. */
export async function summariseText(text: string): Promise<SummaryResponse> {
  return aiApiFetch<SummaryResponse>('/summarise-text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

/** Summarise an uploaded file. */
export async function summariseFile(file: File): Promise<InsightsResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return aiApiFetch<InsightsResponse>('/summarise-file', {
    method: 'POST',
    body: formData,
  });
}

/** Extract key topics from text. */
export async function extractKeyTopics(text: string): Promise<TopicsResponse> {
  return aiApiFetch<TopicsResponse>('/extract-key-topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

/** Generate educational insights from text. */
export async function generateInsights(text: string): Promise<InsightsResponse> {
  return aiApiFetch<InsightsResponse>('/generate-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
}

/** Parse a PDF and extract text. */
export async function parsePdf(file: File): Promise<ParsedPdf> {
  const formData = new FormData();
  formData.append('file', file);
  return aiApiFetch<ParsedPdf>('/parse-pdf', {
    method: 'POST',
    body: formData,
  });
}

/** Scan an image and extract text via Gemini vision. */
export async function extractImageText(file: File): Promise<ExtractedImage> {
  const formData = new FormData();
  formData.append('file', file);
  return aiApiFetch<ExtractedImage>('/extract-image', {
    method: 'POST',
    body: formData,
  });
}

/** Scrape a URL and optionally summarise. */
export async function scrapeUrl(url: string, summarise: boolean = false): Promise<ScrapeResponse> {
  return aiApiFetch<ScrapeResponse>('/scrape-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, summarise }),
  });
}

/** Convert audio file to text. */
export async function speechToText(file: File): Promise<SpeechToTextResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return aiApiFetch<SpeechToTextResponse>('/speech-to-text', {
    method: 'POST',
    body: formData,
  });
}

/** Convert text to speech — returns audio blob URL. */
export async function textToSpeech(text: string, voice?: string): Promise<string> {
  const url = `${AI_API_BASE}/text-to-speech`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, voice }),
  });
  if (!response.ok) throw new Error('Text-to-speech failed');
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

/** Process audio file — transcribe + summarise. */
export async function processAudio(file: File): Promise<AudioResponse> {
  const formData = new FormData();
  formData.append('file', file);
  return aiApiFetch<AudioResponse>('/process-audio', {
    method: 'POST',
    body: formData,
  });
}

/** Run fact-check on claims or transcript. */
export async function factCheck(
  transcript: string,
  options?: { claims?: unknown[]; resourceContext?: string }
): Promise<FactCheckResponse> {
  return aiApiFetch<FactCheckResponse>('/fact-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript,
      claims: options?.claims,
      resource_context: options?.resourceContext,
    }),
  });
}

/** Generate post-session summary. */
export async function summariseSession(data: {
  transcript: string;
  aiNotes?: string;
  factCheckResults?: FactCheckResult[];
  durationSeconds?: number;
  bookingTopic?: string;
}): Promise<SessionSummaryResponse> {
  return aiApiFetch<SessionSummaryResponse>('/summarise-session', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transcript: data.transcript,
      ai_notes: data.aiNotes,
      fact_check_results: data.factCheckResults,
      duration_seconds: data.durationSeconds,
      booking_topic: data.bookingTopic,
    }),
  });
}

/** Generate live session AI notes. */
export async function generateLiveNotes(
  transcript: string,
  context?: Record<string, string>
): Promise<LiveNotesResponse> {
  return aiApiFetch<LiveNotesResponse>('/livestream/ai-notes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript, context }),
  });
}
