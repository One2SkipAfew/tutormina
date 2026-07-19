import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getZoneColor } from '../../types/lms';
import { saveSessionNote, getSessionNotes, deleteSessionNote, type AiSessionNote } from '../../lib/aiNotes';
import '../../styles/shared-drive.css';
import '../../styles/messaging.css';

export default function AIInsights() {
  const { profile } = useAuth();
  const zone = getZoneColor(profile?.role ?? 'customer');
  const [textInput, setTextInput] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const [savedNotes, setSavedNotes] = useState<AiSessionNote[]>([]);
  const [noteTitle, setNoteTitle] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const loadNotes = useCallback(() => {
    getSessionNotes().then(setSavedNotes).catch(() => {});
  }, []);

  useEffect(() => { loadNotes(); }, [loadNotes]);

  // Auto-grow with content, roll back up to a compact size while blank - keeps the feature
  // cards below visible instead of a permanently tall, mostly-empty box.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 70)}px`;
  }, [textInput]);

  const handleSaveNote = async () => {
    if (!noteTitle.trim()) return;
    setSavingNote(true);
    try {
      await saveSessionNote({ title: noteTitle.trim(), transcript: textInput, summary: summary ?? undefined, key_topics: topics });
      setNoteTitle('');
      loadNotes();
    } catch {
      // Non-fatal - the summary/topics are still visible on screen.
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (id: string) => {
    await deleteSessionNote(id);
    setSavedNotes((prev) => prev.filter((n) => n.id !== id));
  };

  const handleSummarise = async () => {
    if (!textInput.trim()) return;
    setLoading(true);
    setSummary(null);
    setTopics([]);

    try {
      // Call the AI API
      const res = await fetch('/api/summarise-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput }),
      });

      if (res.ok) {
        const data = await res.json();
        setSummary(data.summary);
        setTopics(data.key_topics || []);
      } else {
        // Fallback: demo mode
        setSummary(
          'This is a placeholder summary. The AI API is not currently running. When connected, this will provide an intelligent summary of your input text using an open-source HuggingFace model.'
        );
        setTopics(['Demo Mode', 'AI Summary', 'HuggingFace Integration']);
      }
    } catch {
      // Demo mode fallback
      setSummary(
        'This is a placeholder summary. Connect the AI API (`ai-api/main.py`) to enable real summarisation powered by open-source HuggingFace models.'
      );
      setTopics(['Demo Mode', 'AI Summary', 'HuggingFace Integration']);
    } finally {
      setLoading(false);
    }
  };

  const handleExtractTopics = async () => {
    if (!textInput.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/extract-key-topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: textInput }),
      });

      if (res.ok) {
        const data = await res.json();
        setTopics(data.key_topics || []);
      } else {
        setTopics(['Mathematics', 'Science', 'Problem Solving', 'Critical Thinking', 'Study Techniques']);
      }
    } catch {
      setTopics(['Mathematics', 'Science', 'Problem Solving', 'Critical Thinking', 'Study Techniques']);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">✨ AI Insights</h1>
        <p className="dashboard-page-subtitle">
          Use AI to summarise content, extract key topics, and gain insights from your learning materials.
        </p>
      </div>

      {/* AI Info Banner */}
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
        <span style={{ fontSize: '2rem' }}>🤖</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#5b21b6', marginBottom: '0.2rem' }}>
            Powered by AI
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            TutorMina uses the latest AI technology to provide summaries and insights.
            Paste text below or use the ✨ buttons on files in the SharedDrive.
          </div>
        </div>
      </div>

      {/* Text Input */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header">
          <h3 className="content-panel-title">📝 Text Input</h3>
        </div>
        <div className="content-panel-body">
          <textarea
            ref={textareaRef}
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Paste text from notes, past papers, or any learning material here..."
            rows={3}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              resize: 'none',
              overflow: 'hidden',
              lineHeight: 1.6,
              transition: 'height 0.15s ease-out',
            }}
          />
          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem', flexWrap: 'wrap' }}>
            <button
              className="ai-action-btn"
              onClick={handleSummarise}
              disabled={loading || !textInput.trim()}
              style={{ fontSize: '0.85rem', padding: '0.55rem 1rem' }}
            >
              {loading ? (
                <>
                  <span className="spinner" /> Processing...
                </>
              ) : (
                '✨ Summarise'
              )}
            </button>
            <button
              className="ai-action-btn"
              onClick={handleExtractTopics}
              disabled={loading || !textInput.trim()}
              style={{ fontSize: '0.85rem', padding: '0.55rem 1rem' }}
            >
              🔍 Extract Key Topics
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {(summary || topics.length > 0) && (
        <div className="ai-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="ai-panel-header">
            <span className="ai-panel-icon">✨</span>
            <span className="ai-panel-title">AI Results</span>
          </div>

          {summary && (
            <div style={{ marginBottom: '1rem' }}>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem', color: '#5b21b6' }}>
                Summary
              </div>
              <div className="ai-panel-content">{summary}</div>
            </div>
          )}

          {topics.length > 0 && (
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.82rem', marginBottom: '0.5rem', color: '#5b21b6' }}>
                Key Topics
              </div>
              <div className="ai-panel-topics">
                {topics.map((topic, i) => (
                  <span key={i} className="ai-topic-tag">{topic}</span>
                ))}
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
              No saved session notes yet. Summarise some text above and save it to keep a record.
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

      {/* Feature Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
        <div className="content-panel">
          <div className="content-panel-body" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📄</div>
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Summarise Documents</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Upload PDFs or paste text to get concise AI-generated summaries.
            </div>
          </div>
        </div>
        <div className="content-panel">
          <div className="content-panel-body" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🎬</div>
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Analyse Recordings</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Get transcripts and key takeaways from session recordings.
            </div>
          </div>
        </div>
        <div className="content-panel">
          <div className="content-panel-body" style={{ textAlign: 'center', padding: '1.5rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>🔍</div>
            <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Extract Key Topics</div>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
              Identify the core concepts and themes across your materials.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
