import { useState, useEffect, useCallback, useRef } from 'react';
import { saveSessionNote, getSessionNotes, deleteSessionNote, type AiSessionNote } from '../../lib/aiNotes';
import {
  summariseText, extractKeyTopics, generateInsights,
  parsePdf, extractImageText, scrapeUrl, speechToText, textToSpeech,
  type InsightsResponse,
} from '../../lib/aiApi';
import {
  FileText, Image as ImageIcon, Globe, Mic, Volume2, Sparkles,
  Search, FileJson, Lightbulb, BookOpen, Tag, ChevronDown,
  ChevronUp, Loader2, CheckCircle2, Copy, Download,
} from 'lucide-react';
import { useModal } from '../../contexts/NotificationContext';
import '../../styles/shared-drive.css';
import '../../styles/messaging.css';

type ToolTab = 'text' | 'pdf' | 'image' | 'web' | 'stt' | 'tts';

interface ToolDef {
  id: ToolTab;
  label: string;
  icon: React.ReactNode;
  color: string;
  description: string;
}

const TOOLS: ToolDef[] = [
  { id: 'text', label: 'Text Tools', icon: <FileText size={24} />, color: '#7c3aed', description: 'Paste any text to get an instant summary, key points and topic analysis.' },
  { id: 'pdf', label: 'PDF Parser', icon: <FileJson size={24} />, color: '#2563eb', description: 'Upload a PDF to extract its full text, ready for AI analysis.' },
  { id: 'image', label: 'Image OCR', icon: <ImageIcon size={24} />, color: '#db2777', description: 'Upload a photo or scan to pull out any text it contains — handwriting included.' },
  { id: 'web', label: 'Web Scraper', icon: <Globe size={24} />, color: '#059669', description: 'Paste a URL to pull in an article or page for analysis.' },
  { id: 'stt', label: 'Speech to Text', icon: <Mic size={24} />, color: '#d97706', description: 'Upload an audio recording to get a full written transcript.' },
  { id: 'tts', label: 'Text to Speech', icon: <Volume2 size={24} />, color: '#0891b2', description: 'Turn any written text into natural-sounding spoken audio.' },
];

interface AnalysisResult {
  extractedText: string | null;
  summary: string | null;
  keyPoints: string[];
  insights: string[];
  keyTopics: string[];
  audioUrl: string | null;
  sourceLabel: string;
  wordCount?: number;
  pageCount?: number;
  transcribedVia?: string;
}

const emptyResult = (): AnalysisResult => ({
  extractedText: null, summary: null, keyPoints: [],
  insights: [], keyTopics: [], audioUrl: null, sourceLabel: '',
});

function copyText(text: string) {
  navigator.clipboard.writeText(text).catch(() => { });
}

// ─── SectionCard ─────────────────────────────────────────────────────────────

function SectionCard({
  icon, title, accent, children, defaultOpen = true,
}: {
  icon: React.ReactNode; title: string; accent: string;
  children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ border: `1px solid ${accent}30`, borderRadius: '12px', overflow: 'hidden', marginBottom: '1rem' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.85rem 1.1rem', background: `${accent}10`, border: 'none', cursor: 'pointer', textAlign: 'left' }}
      >
        <span style={{ color: accent, display: 'flex' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: accent, flex: 1 }}>{title}</span>
        <span style={{ color: accent }}>{open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
      </button>
      {open && <div style={{ padding: '1rem 1.1rem', background: 'white' }}>{children}</div>}
    </div>
  );
}

function InsightItem({ text, index }: { text: string; index: number }) {
  const colors = ['#7c3aed', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
  const color = colors[index % colors.length];
  return (
    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '0.75rem', borderRadius: '8px', background: `${color}08`, border: `1px solid ${color}20`, marginBottom: '0.5rem' }}>
      <div style={{ minWidth: '24px', height: '24px', borderRadius: '50%', background: color, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700 }}>
        {index + 1}
      </div>
      <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.6, color: '#1e293b' }}>{text}</p>
    </div>
  );
}

function KeyPointItem({ text }: { text: string }) {
  return (
    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start', marginBottom: '0.45rem' }}>
      <CheckCircle2 size={15} style={{ color: '#10b981', marginTop: '2px', flexShrink: 0 }} />
      <span style={{ fontSize: '0.87rem', lineHeight: 1.55, color: '#334155' }}>{text}</span>
    </div>
  );
}

function TopicTag({ label }: { label: string }) {
  return (
    <span style={{ display: 'inline-block', padding: '0.3rem 0.75rem', borderRadius: '20px', background: 'linear-gradient(135deg, #ede9fe, #ddd6fe)', color: '#5b21b6', fontSize: '0.78rem', fontWeight: 600, margin: '0.25rem', border: '1px solid #c4b5fd' }}>
      {label}
    </span>
  );
}

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', padding: '2.5rem', color: '#7c3aed' }}>
      <Loader2 size={36} style={{ animation: 'spin 1s linear infinite' }} />
      <p style={{ margin: 0, fontWeight: 600, fontSize: '0.9rem' }}>{label}</p>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ─── Analysis Results Panel ───────────────────────────────────────────────────

function AnalysisResultsPanel({
  result, analysing, onAnalyse,
  noteTitle, setNoteTitle, onSaveNote, savingNote,
}: {
  result: AnalysisResult; analysing: boolean; onAnalyse: () => void;
  noteTitle: string; setNoteTitle: (t: string) => void;
  onSaveNote: () => void; savingNote: boolean;
}) {
  const hasInsights = !!(result.summary || result.insights.length || result.keyPoints.length);
  const hasContent = !!(result.extractedText || result.audioUrl);
  if (!hasContent && !hasInsights) return null;

  return (
    <div style={{ borderRadius: '16px', overflow: 'hidden', border: '1px solid rgba(124,58,237,0.2)', marginBottom: '1.5rem', boxShadow: '0 4px 24px rgba(124,58,237,0.08)' }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg,#7c3aed,#5b21b6)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Sparkles size={20} color="white" />
          <div>
            <div style={{ color: 'white', fontWeight: 700, fontSize: '0.95rem' }}>AI Analysis Results</div>
            {result.sourceLabel && <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.75rem' }}>{result.sourceLabel}</div>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {result.wordCount != null && <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600 }}>{result.wordCount.toLocaleString()} words</span>}
          {result.pageCount != null && <span style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600 }}>{result.pageCount} pages</span>}
        </div>
      </div>

      <div style={{ padding: '1.25rem', background: '#fafbff' }}>
        {result.audioUrl && <div style={{ marginBottom: '1rem' }}><audio controls src={result.audioUrl} style={{ width: '100%' }} /></div>}

        {/* Analyse CTA */}
        {result.extractedText && !hasInsights && !analysing && (
          <div style={{ background: 'linear-gradient(135deg,#f5f3ff,#ede9fe)', border: '1px dashed #c4b5fd', borderRadius: '12px', padding: '1.75rem', textAlign: 'center', marginBottom: '1rem' }}>
            <Sparkles size={28} style={{ color: '#7c3aed', marginBottom: '0.5rem' }} />
            <p style={{ margin: '0 0 0.5rem', color: '#5b21b6', fontWeight: 700, fontSize: '1rem' }}>Content extracted successfully!</p>
            <p style={{ margin: '0 0 1.25rem', color: '#6d28d9', fontSize: '0.85rem' }}>
              Click below to get an AI-generated summary, numbered insights and key topic analysis.
            </p>
            <button className="btn btn-primary" onClick={onAnalyse} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} /> Analyse with AI
            </button>
          </div>
        )}

        {analysing && <LoadingSpinner label="Generating insights…" />}

        {/* Insights */}
        {hasInsights && !analysing && (
          <>
            {result.summary && (
              <SectionCard icon={<BookOpen size={18} />} title="Summary" accent="#7c3aed">
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.5rem' }}>
                  <button onClick={() => copyText(result.summary!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7c3aed', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                    <Copy size={13} /> Copy
                  </button>
                </div>
                <p style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.75, color: '#1e293b' }}>{result.summary}</p>
              </SectionCard>
            )}
            {result.keyPoints.length > 0 && (
              <SectionCard icon={<CheckCircle2 size={18} />} title="Key Points" accent="#0ea5e9">
                {result.keyPoints.map((p, i) => <KeyPointItem key={i} text={p} />)}
              </SectionCard>
            )}
            {result.insights.length > 0 && (
              <SectionCard icon={<Lightbulb size={18} />} title="AI Insights" accent="#f59e0b">
                {result.insights.map((ins, i) => <InsightItem key={i} text={ins} index={i} />)}
              </SectionCard>
            )}
            {result.keyTopics.length > 0 && (
              <SectionCard icon={<Tag size={18} />} title="Key Topics" accent="#10b981" defaultOpen={false}>
                <div style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {result.keyTopics.map((t, i) => <TopicTag key={i} label={t} />)}
                </div>
              </SectionCard>
            )}
          </>
        )}

        {/* Extracted content */}
        {result.extractedText && (
          <SectionCard icon={<FileText size={18} />} title="Extracted Content" accent="#64748b" defaultOpen={!hasInsights}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{result.extractedText.split(/\s+/).length.toLocaleString()} words</span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => copyText(result.extractedText!)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}>
                  <Copy size={13} /> Copy
                </button>
                <button
                  onClick={() => {
                    const blob = new Blob([result.extractedText!], { type: 'text/plain' });
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = 'extracted-content.txt';
                    a.click();
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.3rem', fontSize: '0.78rem' }}
                >
                  <Download size={13} /> Download
                </button>
              </div>
            </div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.85rem', whiteSpace: 'pre-wrap', fontSize: '0.84rem', lineHeight: 1.7, color: '#334155', maxHeight: '320px', overflowY: 'auto' }}>
              {result.extractedText}
            </div>
          </SectionCard>
        )}

        {/* Save note */}
        {(hasInsights || result.extractedText) && (
          <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1rem', padding: '0.85rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#166534', whiteSpace: 'nowrap' }}>Save results</span>
            <input
              type="text"
              value={noteTitle}
              onChange={e => setNoteTitle(e.target.value)}
              placeholder="Give this note a title…"
              style={{ flex: 1, minWidth: '180px', padding: '0.45rem 0.75rem', borderRadius: '8px', border: '1px solid #bbf7d0', fontSize: '0.85rem', background: 'white' }}
            />
            <button className="btn btn-primary btn-sm" onClick={onSaveNote} disabled={savingNote || !noteTitle.trim()}>
              {savingNote ? 'Saving…' : 'Save as session note'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── File drop zone ───────────────────────────────────────────────────────────

function FileDropZone({ accept, label, icon, onChange, file }: {
  accept: string; label: string; icon: React.ReactNode;
  onChange: (f: File | null) => void; file: File | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) onChange(f); }}
      style={{ border: `2px dashed ${dragging ? '#7c3aed' : '#cbd5e1'}`, borderRadius: '12px', padding: '2rem', textAlign: 'center', cursor: 'pointer', background: dragging ? '#f5f3ff' : '#f8fafc', transition: 'all 0.2s', marginBottom: '1rem' }}
    >
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => onChange(e.target.files?.[0] || null)} />
      <div style={{ color: '#7c3aed', marginBottom: '0.5rem', display: 'flex', justifyContent: 'center' }}>{icon}</div>
      {file ? (
        <>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b', marginBottom: '0.25rem' }}>{file.name}</div>
          <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{(file.size / 1024).toFixed(1)} KB · Click to change</div>
        </>
      ) : (
        <>
          <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#475569', marginBottom: '0.25rem' }}>{label}</div>
          <div style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Drag & drop or click to browse</div>
        </>
      )}
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function AIInsights() {
  const [activeTab, setActiveTab] = useState<ToolTab>('text');
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [result, setResult] = useState<AnalysisResult>(emptyResult());
  const [loading, setLoading] = useState(false);
  const [analysing, setAnalysing] = useState(false);

  const [savedNotes, setSavedNotes] = useState<AiSessionNote[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { showModal } = useModal();

  const loadNotes = useCallback(() => {
    getSessionNotes().then(setSavedNotes).catch(() => { });
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 90)}px`;
  }, [textInput]);

  const clearResults = () => setResult(emptyResult());
  const handleTabChange = (tab: ToolTab) => {
    setActiveTab(tab); clearResults(); setSelectedFile(null); setTextInput(''); setUrlInput('');
  };

  const handleError = (err: unknown, context: string) =>
    showModal({ type: 'error', title: `${context} Failed`, message: err instanceof Error ? err.message : `Failed to ${context.toLowerCase()}`, buttons: [{ label: 'Dismiss', variant: 'primary', onClick: 'dismiss' }] });

  const handleAnalyse = async () => {
    const textToAnalyse = result.extractedText || textInput;
    if (!textToAnalyse?.trim()) return;
    setAnalysing(true);
    try {
      const data: InsightsResponse = await generateInsights(textToAnalyse);
      setResult(prev => ({ ...prev, summary: data.summary || null, insights: data.insights || [], keyTopics: data.key_topics || [], keyPoints: [] }));
    } catch (err) { handleError(err, 'Analysis'); }
    finally { setAnalysing(false); }
  };

  const handleSummariseText = async () => {
    if (!textInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const [sum, ins] = await Promise.all([summariseText(textInput), generateInsights(textInput)]);
      setResult({ ...emptyResult(), extractedText: textInput, summary: ins.summary || sum.summary, keyPoints: sum.key_points || [], insights: ins.insights || [], keyTopics: ins.key_topics || [], sourceLabel: 'Text input — summarised' });
    } catch (err) { handleError(err, 'Summarisation'); }
    finally { setLoading(false); }
  };

  const handleExtractTopicsText = async () => {
    if (!textInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const [top, ins] = await Promise.all([extractKeyTopics(textInput), generateInsights(textInput)]);
      setResult({ ...emptyResult(), extractedText: textInput, summary: ins.summary || null, insights: ins.insights || [], keyTopics: [...new Set([...top.key_topics, ...ins.key_topics])], sourceLabel: 'Text input — topic extraction' });
    } catch (err) { handleError(err, 'Topic extraction'); }
    finally { setLoading(false); }
  };

  const handleParsePdf = async () => {
    if (!selectedFile) return;
    setLoading(true); clearResults();
    try {
      const res = await parsePdf(selectedFile);
      setResult({ ...emptyResult(), extractedText: res.text, wordCount: res.word_count, pageCount: res.page_count, sourceLabel: `PDF: ${selectedFile.name}` });
    } catch (err) { handleError(err, 'PDF Parsing'); }
    finally { setLoading(false); }
  };

  const handleExtractImage = async () => {
    if (!selectedFile) return;
    setLoading(true); clearResults();
    try {
      const res = await extractImageText(selectedFile);
      setResult({ ...emptyResult(), extractedText: res.extracted_text, sourceLabel: `Image OCR: ${selectedFile.name}` });
    } catch (err) { handleError(err, 'Image OCR'); }
    finally { setLoading(false); }
  };

  const handleScrapeUrl = async () => {
    if (!urlInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const res = await scrapeUrl(urlInput, false);
      setResult({ ...emptyResult(), extractedText: res.text, wordCount: res.word_count, sourceLabel: `Web: ${res.title || urlInput}` });
    } catch (err) { handleError(err, 'Web Scraping'); }
    finally { setLoading(false); }
  };

  const handleSpeechToText = async () => {
    if (!selectedFile) return;
    setLoading(true); clearResults();
    try {
      const res = await speechToText(selectedFile);
      setResult({ ...emptyResult(), extractedText: res.transcript, transcribedVia: res.method, wordCount: res.transcript.split(/\s+/).length, sourceLabel: `Audio: ${selectedFile.name}` });
    } catch (err) { handleError(err, 'Transcription'); }
    finally { setLoading(false); }
  };

  const handleTextToSpeech = async () => {
    if (!textInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const url = await textToSpeech(textInput);
      setResult({ ...emptyResult(), audioUrl: url, sourceLabel: 'Text-to-speech audio' });
    } catch (err) { handleError(err, 'Audio generation'); }
    finally { setLoading(false); }
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    try {
      await saveSessionNote({ title: noteTitle.trim(), transcript: result.extractedText || textInput || '', summary: result.summary ?? undefined, key_topics: result.keyTopics });
      setNoteTitle('');
      loadNotes();
      showModal({ type: 'success', title: 'Note Saved', message: 'Check your Learning Zone for access to the saved material.', buttons: [{ label: 'Dismiss', variant: 'primary', onClick: 'dismiss' }] });
    } catch (err) {
      handleError(err, 'Saving note');
    }
    finally { setSavingNote(false); }
  };

  const handleDeleteNote = async (id: string) => {
    try {
      await deleteSessionNote(id);
      setSavedNotes(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      handleError(err, 'Deleting note');
    }
  };

  const activeTool = TOOLS.find((t) => t.id === activeTab)!;

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">✨ AI Insights</h1>
        <p className="dashboard-page-subtitle">
          Extract content from any source, then let AI break it down into summaries, insights and topic analysis.
        </p>
      </div>

      {/* Hero banner */}
      <div style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#5b21b6 50%,#4c1d95 100%)', borderRadius: '16px', padding: '1.5rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '1.25rem', boxShadow: '0 8px 32px rgba(124,58,237,0.25)', flexWrap: 'wrap', rowGap: '0.75rem' }}>
        <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: '14px', padding: '0.85rem', display: 'flex', flexShrink: 0 }}>
          <Sparkles size={28} color="white" />
        </div>
        <div style={{ flex: 1, minWidth: '200px' }}>
          <div style={{ fontWeight: 700, fontSize: '1rem', color: 'white', marginBottom: '0.3rem' }}>Powered by the latest in AI technology</div>
          <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.78)', lineHeight: 1.5 }}>
            Parse PDFs, extract image text, scrape websites and transcribe audio — then get rich AI summaries, key points and insights instantly.
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          {['Summary', 'Key Points', 'AI Insights', 'Topics'].map(l => (
            <span key={l} style={{ background: 'rgba(255,255,255,0.15)', color: 'white', padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.72rem', fontWeight: 600 }}>{l}</span>
          ))}
        </div>
      </div>

      {/* Tool tiles — these ARE the features. Pick one to see what it does and use it. */}
      <div
        role="tablist"
        aria-label="AI tools"
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '0.85rem', marginBottom: '1.25rem' }}
      >
        {TOOLS.map((tool) => {
          const active = activeTab === tool.id;
          return (
            <button
              key={tool.id}
              role="tab"
              aria-selected={active}
              onClick={() => handleTabChange(tool.id)}
              className="content-panel"
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                border: active ? `2px solid ${tool.color}` : '1px solid rgba(0,0,0,0.06)',
                boxShadow: active ? `0 4px 20px ${tool.color}30` : 'none',
                background: active ? `${tool.color}08` : '#fff',
                transition: 'all 0.15s',
                padding: 0,
                font: 'inherit',
              }}
            >
              <div style={{ padding: '1.1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem' }}>
                  <div style={{ background: `${tool.color}18`, color: tool.color, padding: '0.6rem', borderRadius: '10px', display: 'flex', flexShrink: 0 }}>
                    {tool.icon}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: '0.95rem', color: active ? tool.color : '#1e293b' }}>{tool.label}</div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', lineHeight: 1.5 }}>{tool.description}</div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Selected-tool intro + input panel */}
      <div className="content-panel" style={{ marginBottom: '1.5rem', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', padding: '0.9rem 1.25rem', background: `${activeTool.color}10`, borderBottom: `1px solid ${activeTool.color}25` }}>
          <span style={{ color: activeTool.color, display: 'flex' }}>{activeTool.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.9rem', color: activeTool.color }}>{activeTool.label}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{activeTool.description}</div>
          </div>
        </div>
        <div className="content-panel-body">
          {activeTab === 'text' && (
            <>
              <textarea ref={textareaRef} value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Paste any text here — articles, notes, transcripts, essays…" style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontFamily: 'inherit', resize: 'none', fontSize: '0.88rem', lineHeight: 1.6, minHeight: '90px' }} />
              <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.85rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary btn-sm" onClick={handleSummariseText} disabled={loading || !textInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Sparkles size={15} /> {loading ? 'Analysing…' : 'Summarise & Analyse'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={handleExtractTopicsText} disabled={loading || !textInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <Search size={15} /> Extract Topics
                </button>
              </div>
            </>
          )}
          {activeTab === 'pdf' && (
            <>
              <FileDropZone accept=".pdf" label="Drop a PDF here" icon={<FileJson size={36} />} onChange={setSelectedFile} file={selectedFile} />
              <button className="btn btn-primary btn-sm" onClick={handleParsePdf} disabled={loading || !selectedFile} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <FileJson size={15} /> {loading ? 'Parsing…' : 'Parse PDF'}
              </button>
            </>
          )}
          {activeTab === 'image' && (
            <>
              <FileDropZone accept="image/*" label="Drop an image (JPG, PNG, WEBP…)" icon={<ImageIcon size={36} />} onChange={setSelectedFile} file={selectedFile} />
              <button className="btn btn-primary btn-sm" onClick={handleExtractImage} disabled={loading || !selectedFile} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ImageIcon size={15} /> {loading ? 'Extracting…' : 'Extract Text (OCR)'}
              </button>
            </>
          )}
          {activeTab === 'web' && (
            <>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151' }}>Website URL</label>
              <input type="url" value={urlInput} onChange={e => setUrlInput(e.target.value)} placeholder="https://example.com/article" style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '0.88rem', marginBottom: '0.85rem' }} />
              <button className="btn btn-primary btn-sm" onClick={handleScrapeUrl} disabled={loading || !urlInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Globe size={15} /> {loading ? 'Scraping…' : 'Scrape Website'}
              </button>
            </>
          )}
          {activeTab === 'stt' && (
            <>
              <FileDropZone accept="audio/*" label="Drop an audio file (MP3, WAV, M4A…)" icon={<Mic size={36} />} onChange={setSelectedFile} file={selectedFile} />
              <button className="btn btn-primary btn-sm" onClick={handleSpeechToText} disabled={loading || !selectedFile} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Mic size={15} /> {loading ? 'Transcribing…' : 'Transcribe Audio'}
              </button>
            </>
          )}
          {activeTab === 'tts' && (
            <>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem', color: '#374151' }}>Text to convert to speech</label>
              <textarea value={textInput} onChange={e => setTextInput(e.target.value)} placeholder="Enter the text you want to hear…" rows={5} style={{ width: '100%', padding: '0.85rem', borderRadius: '10px', border: '1px solid #e2e8f0', fontFamily: 'inherit', resize: 'vertical', fontSize: '0.88rem' }} />
              <div style={{ marginTop: '0.85rem' }}>
                <button className="btn btn-primary btn-sm" onClick={handleTextToSpeech} disabled={loading || !textInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Volume2 size={15} /> {loading ? 'Generating…' : 'Generate Audio'}
                </button>
              </div>
            </>
          )}
          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginTop: '1rem', color: '#7c3aed' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>Processing…</span>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      <AnalysisResultsPanel
        result={result} analysing={analysing} onAnalyse={handleAnalyse}
        noteTitle={noteTitle} setNoteTitle={setNoteTitle}
        onSaveNote={handleSaveNote} savingNote={savingNote}
      />

      {/* Saved sessions */}
      {savedNotes.length > 0 && (
        <div className="content-panel">
          <div className="content-panel-header">
            <h3 className="content-panel-title">Saved Sessions ({savedNotes.length})</h3>
          </div>
          <div className="content-panel-body" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {savedNotes.map((note) => {
              const isOpen = expandedNote === note.id;
              return (
                <div key={note.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden', background: '#fff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 0.9rem', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setExpandedNote(isOpen ? null : note.id)}
                      style={{ flex: 1, minWidth: '160px', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', padding: 0, font: 'inherit' }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>{note.title}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                        {new Date(note.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => setExpandedNote(isOpen ? null : note.id)}
                      aria-expanded={isOpen}
                    >
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      style={{ color: '#c5221f', borderColor: '#f3b3ac' }}
                      onClick={() => handleDeleteNote(note.id)}
                    >
                      Delete
                    </button>
                  </div>
                  {isOpen && (
                    <div style={{ padding: '0 0.9rem 0.9rem', borderTop: '1px solid #f1f5f9' }}>
                      {note.summary && (
                        <p style={{ fontSize: '0.85rem', lineHeight: 1.7, color: '#334155', marginTop: '0.75rem' }}>{note.summary}</p>
                      )}
                      {note.key_topics && note.key_topics.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: '0.5rem' }}>
                          {note.key_topics.map((t, i) => <TopicTag key={i} label={t} />)}
                        </div>
                      )}
                      {note.transcript && (
                        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.75rem', whiteSpace: 'pre-wrap', fontSize: '0.8rem', lineHeight: 1.65, color: '#475569', maxHeight: '240px', overflowY: 'auto', marginTop: '0.75rem' }}>
                          {note.transcript}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
