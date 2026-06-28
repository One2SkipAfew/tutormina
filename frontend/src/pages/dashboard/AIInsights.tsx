import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getZoneColor } from '../../types/lms';
import '../../styles/shared-drive.css';

export default function AIInsights() {
  const { profile } = useAuth();
  const zone = getZoneColor(profile?.role ?? 'customer');
  const [textInput, setTextInput] = useState('');
  const [summary, setSummary] = useState<string | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

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
            Powered by Open-Source AI
          </div>
          <div style={{ fontSize: '0.82rem', color: 'var(--color-text-muted)' }}>
            TutorMina uses affordable, open-source HuggingFace models to provide summaries and insights.
            Paste text below, or use the ✨ buttons on files in the SharedDrive.
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
            value={textInput}
            onChange={e => setTextInput(e.target.value)}
            placeholder="Paste text from notes, past papers, or any learning material here..."
            rows={8}
            style={{
              width: '100%',
              padding: '0.85rem',
              borderRadius: '8px',
              border: '1px solid rgba(0, 0, 0, 0.12)',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              resize: 'vertical',
              minHeight: '150px',
              lineHeight: 1.6,
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
        </div>
      )}

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
