import { useState, useEffect, useCallback, useRef } from 'react';

import { saveSessionNote, getSessionNotes, deleteSessionNote, type AiSessionNote } from '../../lib/aiNotes';
import { summariseText, extractKeyTopics, parsePdf, extractImageText, scrapeUrl, speechToText, textToSpeech } from '../../lib/aiApi';
import { FileText, Image as ImageIcon, Globe, Mic, Volume2, Sparkles, Video, Search, FileJson } from 'lucide-react';
import '../../styles/shared-drive.css';
import '../../styles/messaging.css';

type ToolTab = 'text' | 'pdf' | 'image' | 'web' | 'stt' | 'tts';

export default function AIInsights() {
  const [activeTab, setActiveTab] = useState<ToolTab>('text');

  // Input states
  const [textInput, setTextInput] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Result states
  const [summary, setSummary] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [savedNotes, setSavedNotes] = useState<AiSessionNote[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadNotes = useCallback(() => {
    getSessionNotes().then(setSavedNotes).catch(() => {});
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 70)}px`;
  }, [textInput]);

  const clearResults = () => {
    setSummary(null);
    setTopics([]);
    setExtractedText(null);
    setAudioUrl(null);
    setError(null);
  };

  const handleTabChange = (tab: ToolTab) => {
    setActiveTab(tab);
    clearResults();
    setSelectedFile(null);
  };

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    try {
      await saveSessionNote({ 
        title: noteTitle.trim(), 
        transcript: extractedText || textInput || '', 
        summary: summary ?? undefined, 
        key_topics: topics 
      });
      setNoteTitle('');
      loadNotes();
    } catch {
      // Non-fatal
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await deleteSessionNote(id);
    setSavedNotes((prev) => prev.filter((n) => n.id !== id));
  };

  // --- Handlers ---
  const handleSummariseText = async () => {
    if (!textInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const res = await summariseText(textInput);
      setSummary(res.summary);
      setTopics(res.key_points || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to summarise text');
    } finally { setLoading(false); }
  };

  const handleExtractTopics = async () => {
    if (!textInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const res = await extractKeyTopics(textInput);
      setTopics(res.key_topics || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract topics');
    } finally { setLoading(false); }
  };

  const handleParsePdf = async () => {
    if (!selectedFile) return;
    setLoading(true); clearResults();
    try {
      const res = await parsePdf(selectedFile);
      setExtractedText(res.text);
      setSummary(`Extracted ${res.word_count} words from a ${res.page_count} page PDF.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse PDF');
    } finally { setLoading(false); }
  };

  const handleExtractImage = async () => {
    if (!selectedFile) return;
    setLoading(true); clearResults();
    try {
      const res = await extractImageText(selectedFile);
      setExtractedText(res.extracted_text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract text from image');
    } finally { setLoading(false); }
  };

  const handleScrapeUrl = async () => {
    if (!urlInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const res = await scrapeUrl(urlInput, true);
      setExtractedText(res.text);
      setSummary(res.summary || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to scrape URL');
    } finally { setLoading(false); }
  };

  const handleSpeechToText = async () => {
    if (!selectedFile) return;
    setLoading(true); clearResults();
    try {
      const res = await speechToText(selectedFile);
      setExtractedText(res.transcript);
      setSummary(`Transcribed via ${res.method}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to transcribe audio');
    } finally { setLoading(false); }
  };

  const handleTextToSpeech = async () => {
    if (!textInput.trim()) return;
    setLoading(true); clearResults();
    try {
      const url = await textToSpeech(textInput);
      setAudioUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate speech');
    } finally { setLoading(false); }
  };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">✨ AI Insights</h1>
        <p className="dashboard-page-subtitle">
          Use the full suite of TutorMina AI tools to analyse, transcribe, and summarise your materials.
        </p>
      </div>

      <div style={{
        background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
        border: '1px solid rgba(124, 58, 237, 0.15)',
        borderRadius: '12px',
        padding: '1.25rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem',
      }}>
        <div style={{ background: '#7c3aed', color: 'white', padding: '0.75rem', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Sparkles size={24} />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#5b21b6', marginBottom: '0.2rem' }}>
            Powered by the latest in AI technology
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            Experience lightning-fast processing for texts, images, and audio.
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <div className="content-panel">
          <div className="content-panel-body" style={{ textAlign: 'center', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <FileText size={32} />
            </div>
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Summarise Documents</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Upload PDFs or paste text to get concise AI-generated summaries.
            </div>
          </div>
        </div>
        <div className="content-panel">
          <div className="content-panel-body" style={{ textAlign: 'center', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <Video size={32} />
            </div>
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Analyse Recordings</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Get transcripts and key takeaways from session recordings.
            </div>
          </div>
        </div>
        <div className="content-panel">
          <div className="content-panel-body" style={{ textAlign: 'center', padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed', padding: '1rem', borderRadius: '50%', marginBottom: '1rem' }}>
              <Search size={32} />
            </div>
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Extract Key Topics</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Identify the core concepts and themes across your materials.
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="ai-tools-tabs" style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '4px' }}>
        <div className={`ai-tools-tab ${activeTab === 'text' ? 'active' : ''}`} onClick={() => handleTabChange('text')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileText size={16} /> Text Tools
        </div>
        <div className={`ai-tools-tab ${activeTab === 'pdf' ? 'active' : ''}`} onClick={() => handleTabChange('pdf')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <FileJson size={16} /> PDF Parser
        </div>
        <div className={`ai-tools-tab ${activeTab === 'image' ? 'active' : ''}`} onClick={() => handleTabChange('image')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ImageIcon size={16} /> Image OCR
        </div>
        <div className={`ai-tools-tab ${activeTab === 'web' ? 'active' : ''}`} onClick={() => handleTabChange('web')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Globe size={16} /> Web Scraper
        </div>
        <div className={`ai-tools-tab ${activeTab === 'stt' ? 'active' : ''}`} onClick={() => handleTabChange('stt')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Mic size={16} /> Speech to Text
        </div>
        <div className={`ai-tools-tab ${activeTab === 'tts' ? 'active' : ''}`} onClick={() => handleTabChange('tts')} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Volume2 size={16} /> Text to Speech
        </div>
      </div>

      {/* Inputs */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-body">
          {error && (
            <div style={{ background: '#fce8e6', color: '#c5221f', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {activeTab === 'text' && (
            <>
              <textarea
                ref={textareaRef}
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Paste text here to summarise or extract topics..."
                style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', resize: 'none' }}
              />
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={handleSummariseText} disabled={loading || !textInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={16} /> {loading ? 'Processing...' : 'Summarise'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={handleExtractTopics} disabled={loading || !textInput.trim()} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Search size={16} /> Extract Topics
                </button>
              </div>
            </>
          )}

          {activeTab === 'pdf' && (
            <>
              <input type="file" accept=".pdf" onChange={e => setSelectedFile(e.target.files?.[0] || null)} style={{ marginBottom: '1rem' }} />
              <div>
                <button className="btn btn-primary btn-sm" onClick={handleParsePdf} disabled={loading || !selectedFile}>
                  {loading ? 'Parsing...' : '📄 Parse PDF'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'image' && (
            <>
              <input type="file" accept="image/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} style={{ marginBottom: '1rem' }} />
              <div>
                <button className="btn btn-primary btn-sm" onClick={handleExtractImage} disabled={loading || !selectedFile}>
                  {loading ? 'Extracting...' : '🖼️ Extract Text'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'web' && (
            <>
              <input
                type="url"
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                placeholder="https://example.com/article"
                style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '1rem' }}
              />
              <div>
                <button className="btn btn-primary btn-sm" onClick={handleScrapeUrl} disabled={loading || !urlInput.trim()}>
                  {loading ? 'Scraping...' : '🌐 Scrape & Summarise'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'stt' && (
            <>
              <input type="file" accept="audio/*" onChange={e => setSelectedFile(e.target.files?.[0] || null)} style={{ marginBottom: '1rem' }} />
              <div>
                <button className="btn btn-primary btn-sm" onClick={handleSpeechToText} disabled={loading || !selectedFile}>
                  {loading ? 'Transcribing...' : '🎙️ Transcribe Audio'}
                </button>
              </div>
            </>
          )}

          {activeTab === 'tts' && (
            <>
              <textarea
                value={textInput}
                onChange={e => setTextInput(e.target.value)}
                placeholder="Enter text to convert to speech..."
                rows={4}
                style={{ width: '100%', padding: '0.85rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div style={{ marginTop: '1rem' }}>
                <button className="btn btn-primary btn-sm" onClick={handleTextToSpeech} disabled={loading || !textInput.trim()}>
                  {loading ? 'Generating...' : '🔊 Generate Audio'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Results */}
      {(summary || topics.length > 0 || extractedText || audioUrl) && (
        <div className="ai-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="ai-panel-header">
            <span className="ai-panel-icon">✨</span>
            <span className="ai-panel-title">AI Results</span>
          </div>

          {audioUrl && (
            <div style={{ marginBottom: '1rem' }}>
              <audio controls src={audioUrl} className="ai-audio-player" style={{ width: '100%' }} />
            </div>
          )}

          {summary && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem', color: '#5b21b6' }}>Summary</div>
              <div className="ai-panel-content">{summary}</div>
            </div>
          )}

          {topics.length > 0 && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem', color: '#5b21b6' }}>Key Topics</div>
              <div className="ai-panel-topics">
                {topics.map((topic, i) => <span key={i} className="ai-topic-tag">{topic}</span>)}
              </div>
            </div>
          )}

          {extractedText && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem', color: '#5b21b6' }}>Content</div>
              <div className="ai-panel-content" style={{ whiteSpace: 'pre-wrap', maxHeight: '400px', overflowY: 'auto' }}>
                {extractedText}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title this session note..."
              style={{ flex: 1, minWidth: '200px', padding: '0.55rem 0.75rem', borderRadius: '8px', border: '1px solid rgba(0,0,0,0.12)' }}
            />
            <button className="btn btn-primary btn-sm" onClick={handleSaveNote} disabled={savingNote || !noteTitle.trim()}>
              {savingNote ? 'Saving...' : '💾 Save as session note'}
            </button>
          </div>
        </div>
      )}

      {/* Saved Notes */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header">
          <h3 className="content-panel-title">📚 Your Saved Notes</h3>
        </div>
        <div className="content-panel-body">
          {savedNotes.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              No saved session notes yet. Use the tools above and save the results.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {savedNotes.map((note) => (
                <div key={note.id} style={{ padding: '0.85rem', border: '1px solid rgba(0,0,0,0.08)', borderRadius: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{note.title}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{new Date(note.created_at).toLocaleString()}</div>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note.id)}
                      style={{ border: 'none', background: 'none', color: '#c62828', cursor: 'pointer', fontSize: '0.8rem' }}
                    >
                      Delete
                    </button>
                  </div>
                  {note.summary && <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>{note.summary}</p>}
                  {note.key_topics && note.key_topics.length > 0 && (
                    <div className="ai-panel-topics" style={{ marginTop: '0.5rem' }}>
                      {note.key_topics.map((t, i) => <span key={i} className="ai-topic-tag">{t}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
