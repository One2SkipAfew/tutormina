/**
 * LiveSession — Full live session page with real-time transcription,
 * AI notes generation, and fact-checking.
 *
 * Adapted from RelaxnTakeNotes' LiveStreamView for TutorMina's platform.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeTranscript } from '../../lib/useRealtimeTranscript';
import { useFactChecker } from '../../lib/useFactChecker';
import { generateLiveNotes, summariseSession } from '../../lib/aiApi';
import { supabase } from '../../lib/supabaseClient';
import { saveSessionNote } from '../../lib/aiNotes';
import { Radio, Mic, Play, Pause, Square, FileText, Sparkles, Loader, RefreshCw, Shield, Search, Package, Save, CheckCircle, XCircle, AlertTriangle, HelpCircle } from 'lucide-react';
import '../../styles/live-session.css';

const formatTime = (secs: number): string => {
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const remainingSecs = secs % 60;
  if (hrs > 0) {
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${remainingSecs.toString().padStart(2, '0')}`;
};

const MAX_DURATION = 5400;
const WARN_BEFORE = 300;

const VERDICT_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  TRUE: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'TRUE' },
  FALSE: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'FALSE' },
  MISLEADING: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'MISLEADING' },
  UNVERIFIABLE: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', label: 'UNVERIFIABLE' },
};

export default function LiveSession() {
  const { bookingId } = useParams<{ bookingId?: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Transcription
  const transcript = useRealtimeTranscript();

  // Fact checking
  const factChecker = useFactChecker();

  // AI Notes
  const [aiNotes, setAiNotes] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Session Summary
  const [sessionSummary, setSessionSummary] = useState('');
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // UI State
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.transcriptEntries, transcript.interimText]);

  // --- AI Notes Generation ---
  const generateNotes = useCallback(async () => {
    const fullTranscript = transcript.getFullTranscript();
    if (!fullTranscript.trim() || fullTranscript.split(/\s+/).length < 20) return;

    setIsGeneratingNotes(true);
    try {
      const response = await generateLiveNotes(fullTranscript);
      setAiNotes(response.result);
    } catch (err) {
      console.error('AI notes error:', err);
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [transcript]);

  // --- Fact Check ---
  const runFactCheck = useCallback(async () => {
    const fullTranscript = transcript.getFullTranscript();
    if (!fullTranscript.trim()) return;
    await factChecker.checkTranscript(fullTranscript);
  }, [transcript, factChecker]);

  // --- End & Summarise ---
  const endAndSummarise = useCallback(async () => {
    transcript.stop();
    const fullTranscript = transcript.getFullTranscript();
    if (!fullTranscript.trim()) return;

    setIsGeneratingSummary(true);
    try {
      const response = await summariseSession({
        transcript: fullTranscript,
        aiNotes,
        factCheckResults: factChecker.results,
        durationSeconds: transcript.duration,
      });
      setSessionSummary(response.summary);
      setShowSummaryModal(true);
    } catch (err) {
      console.error('Summary error:', err);
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [transcript, aiNotes, factChecker.results]);

  // --- Save Session ---
  const saveSession = useCallback(async () => {
    if (!profile) return;
    setIsSaving(true);

    try {
      // Save to live_sessions table
      const { error } = await supabase.from('live_sessions').insert({
        user_id: profile.id,
        title: `Live Session — ${new Date().toLocaleString()}`,
        transcript_text: transcript.getFullTranscript(),
        ai_notes: aiNotes,
        meeting_package: sessionSummary,
        duration_seconds: transcript.duration,
      });
      if (error) throw error;

      // Also save as an AI session note
      await saveSessionNote({
        title: `Live Session — ${new Date().toLocaleDateString()}`,
        transcript: transcript.getFullTranscript(),
        summary: sessionSummary || aiNotes,
        key_topics: [],
      });

      setSaved(true);
    } catch (err) {
      console.error('Save error:', err);
      alert('Failed to save session.');
    } finally {
      setIsSaving(false);
    }
  }, [profile, transcript, aiNotes, sessionSummary]);

  // --- Simple Markdown Renderer ---
  const renderMarkdown = (md: string): string => {
    if (!md) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/\n/g, '<br />');
    return html;
  };

  // --- Status Badge ---
  const StatusBadge = () => {
    const configs: Record<string, { color: string; text: string }> = {
      disconnected: { color: '#6b7280', text: 'Disconnected' },
      connecting: { color: '#f59e0b', text: 'Connecting...' },
      connected: { color: '#22c55e', text: 'Live' },
      error: { color: '#ef4444', text: 'Error' },
    };
    const cfg = configs[transcript.connectionStatus] || configs.disconnected;
    return (
      <div className="ls-status-badge" style={{ '--badge-color': cfg.color } as React.CSSProperties}>
        <span className="ls-status-dot" />
        <span>{cfg.text}</span>
      </div>
    );
  };

  return (
    <div className="ls-container">
      {/* Header */}
      <header className="ls-header">
        <div className="ls-header-left">
          <div className="ls-header-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="ls-radio-icon"><Radio size={24} /></span>
            <h2>Live Session</h2>
          </div>
          <StatusBadge />
          {transcript.method !== 'none' && (
            <span style={{ fontSize: '0.6rem', color: '#94a3b8', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px' }}>
              {transcript.method === 'deepgram' ? '🎯 Deepgram' : '🌐 Web Speech'}
            </span>
          )}
        </div>

        <div className="ls-header-right">
          <div className={`ls-timer ${transcript.isListening && (MAX_DURATION - transcript.duration) <= WARN_BEFORE ? 'ls-timer-warning' : ''}`}>
            🕐 <span>{formatTime(transcript.duration)}</span>
            {transcript.isListening && (
              <span className="ls-timer-remaining">/ {formatTime(MAX_DURATION - transcript.duration)} left</span>
            )}
          </div>

          {!transcript.isListening ? (
            <button className="ls-btn ls-btn-start" onClick={transcript.start} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Mic size={16} /> Start Recording
            </button>
          ) : (
            <div className="ls-controls">
              <button className={`ls-btn ls-btn-pause ${transcript.isPaused ? 'paused' : ''}`} onClick={transcript.togglePause} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {transcript.isPaused ? <><Play size={16} /> Resume</> : <><Pause size={16} /> Pause</>}
              </button>
              <button className="ls-btn ls-btn-stop" onClick={endAndSummarise} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Square size={16} /> End & Summarise
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Waveform */}
      {transcript.isListening && (
        <div className="ls-waveform-bar">
          {Array.from({ length: 40 }).map((_, i) => (
            <span
              key={i}
              className="ls-wave-bar"
              style={{
                animationDelay: `${i * 0.05}s`,
                opacity: transcript.isPaused ? 0.2 : 1,
              }}
            />
          ))}
        </div>
      )}

      {/* Three-Panel Layout */}
      <div className="ls-panels">
        {/* LEFT: Live Transcript */}
        <div className="ls-panel ls-panel-transcript">
          <div className="ls-panel-header">
            <div className="ls-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileText size={18} /> <span>Live Transcript</span>
            </div>
            <span className="ls-panel-count">{transcript.transcriptEntries.length} segments</span>
          </div>
          <div className="ls-transcript-body">
            {transcript.transcriptEntries.length === 0 && !transcript.interimText ? (
              <div className="ls-transcript-empty">
                <span className="ls-empty-icon"><Mic size={48} /></span>
                <p>Start recording to see your live transcript here.</p>
                <p className="ls-empty-hint">Speech will be transcribed in real-time with speaker identification.</p>
              </div>
            ) : (
              <>
                {transcript.transcriptEntries.map((entry) => (
                  <div key={entry.id} className="ls-transcript-entry ls-entry-final">
                    <div className="ls-entry-meta">
                      <span className="ls-speaker-badge">Speaker {entry.speaker}</span>
                      <span className="ls-entry-time">{formatTime(Math.floor(entry.start))}</span>
                    </div>
                    <p className="ls-entry-text">{entry.text}</p>
                  </div>
                ))}
                {transcript.interimText && (
                  <div className="ls-transcript-entry ls-entry-interim">
                    <div className="ls-entry-meta">
                      <span className="ls-speaker-badge interim">Speaker {transcript.interimSpeaker}</span>
                    </div>
                    <p className="ls-entry-text interim">{transcript.interimText}</p>
                  </div>
                )}
                <div ref={transcriptEndRef} />
              </>
            )}
          </div>
        </div>

        {/* CENTER: AI Notes */}
        <div className="ls-panel ls-panel-notes">
          <div className="ls-panel-header">
            <div className="ls-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Sparkles size={18} /> <span>AI Notes</span>
            </div>
            <button
              className="ls-btn ls-btn-sm"
              onClick={generateNotes}
              disabled={isGeneratingNotes || transcript.transcriptEntries.length === 0}
              style={{ background: 'rgba(0,0,0,0.04)', color: '#334155', border: '1px solid rgba(0,0,0,0.08)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {isGeneratingNotes ? <><Loader size={14} className="spin" /> Generating...</> : <><RefreshCw size={14} /> Generate</>}
            </button>
          </div>
          <div className="ls-notes-body">
            {aiNotes ? (
              <div className="ls-notes-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(aiNotes) }} />
            ) : (
              <div className="ls-notes-empty">
                <span className="ls-empty-icon"><Sparkles size={48} /></span>
                <p>AI-generated notes will appear here.</p>
                <p className="ls-empty-hint">Click Generate to create notes from the transcript.</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Fact Check */}
        <div className="ls-panel ls-panel-factcheck">
          <div className="ls-panel-header">
            <div className="ls-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Shield size={18} /> <span>Fact Check</span>
            </div>
            <button
              className="ls-btn ls-btn-sm ls-btn-factcheck"
              onClick={runFactCheck}
              disabled={factChecker.isChecking || transcript.transcriptEntries.length === 0}
              style={{ background: 'rgba(168,85,247,0.08)', color: '#7c3aed', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {factChecker.isChecking ? <><Loader size={14} className="spin" /> Checking...</> : <><Search size={14} /> Check Claims</>}
            </button>
          </div>
          <div className="ls-factcheck-body">
            {factChecker.results.length === 0 ? (
              <div className="ls-factcheck-empty">
                <span className="ls-empty-icon"><Shield size={48} /></span>
                <p>Fact-check results will appear here.</p>
                <p className="ls-empty-hint">Claims are verified against web sources and uploaded resources.</p>
              </div>
            ) : (
              <div className="ls-claims-list">
                {factChecker.results.map((result, idx) => {
                  const verdictCfg = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.UNVERIFIABLE;
                  const isExpanded = expandedClaim === idx;

                  return (
                    <div
                      key={idx}
                      className="ls-claim-card"
                      style={{ '--verdict-color': verdictCfg.color, '--verdict-bg': verdictCfg.bg } as React.CSSProperties}
                      onClick={() => setExpandedClaim(isExpanded ? null : idx)}
                    >
                      <div className="ls-claim-header">
                        <div className="ls-verdict-badge">
                          {result.verdict === 'TRUE' ? <CheckCircle size={14} /> : result.verdict === 'FALSE' ? <XCircle size={14} /> : result.verdict === 'MISLEADING' ? <AlertTriangle size={14} /> : <HelpCircle size={14} />}
                          <span>{verdictCfg.label}</span>
                        </div>
                        <div className="ls-confidence-bar">
                          <div className="ls-confidence-fill" style={{ width: `${(result.confidence || 0) * 100}%` }} />
                          <span>{Math.round((result.confidence || 0) * 100)}%</span>
                        </div>
                        <span>{isExpanded ? '▲' : '▼'}</span>
                      </div>

                      <p className="ls-claim-text">{result.claim}</p>

                      {result.speaker && <span className="ls-claim-speaker">{result.speaker}</span>}

                      {isExpanded && (
                        <div className="ls-claim-details">
                          {result.explanation && (
                            <div className="ls-detail-section">
                              <h4>Explanation</h4>
                              <p>{result.explanation}</p>
                            </div>
                          )}
                          {result.key_evidence && (
                            <div className="ls-detail-section">
                              <h4>Key Evidence</h4>
                              <p>{result.key_evidence}</p>
                            </div>
                          )}
                          {result.sources && result.sources.length > 0 && (
                            <div className="ls-detail-section">
                              <h4>Sources</h4>
                              <ul className="ls-sources-list">
                                {result.sources.map((src, si) => (
                                  <li key={si}>
                                    <a href={src.url} target="_blank" rel="noopener noreferrer">{src.title}</a>
                                    {src.snippet && <p>{src.snippet}</p>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="ls-search-badge">
                            {result.used_web_search ? '✓ Web search verified' : '⚠ AI-only evaluation'}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="ls-bottom-bar">
        {!transcript.isListening && transcript.transcriptEntries.length > 0 && !showSummaryModal && (
          <>
            <button
              className="ls-btn ls-btn-package"
              onClick={endAndSummarise}
              disabled={isGeneratingSummary}
              style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {isGeneratingSummary ? <><Loader size={16} className="spin" /> Generating Summary...</> : <><Package size={16} /> Generate Session Summary</>}
            </button>
            <button
              className="ls-btn ls-btn-save"
              onClick={saveSession}
              disabled={isSaving || saved}
              style={{ background: saved ? '#86efac' : 'linear-gradient(135deg, #22c55e, #16a34a)', color: saved ? '#166534' : '#fff', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              {saved ? <><CheckCircle size={16} /> Saved</> : isSaving ? <><Loader size={16} className="spin" /> Saving...</> : <><Save size={16} /> Save Session</>}
            </button>
          </>
        )}
      </div>

      {/* Summary Modal */}
      {showSummaryModal && sessionSummary && (
        <div className="ls-package-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="ls-package-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ls-package-header">
              <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Package size={24} /> Session Summary</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={saveSession}
                  disabled={isSaving || saved}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                >
                  {saved ? <><CheckCircle size={14} /> Saved</> : isSaving ? <><Loader size={14} className="spin" /> Saving...</> : <><Save size={14} /> Save</>}
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowSummaryModal(false)}>
                  Close
                </button>
              </div>
            </div>
            <div className="ls-package-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(sessionSummary) }} />
          </div>
        </div>
      )}
    </div>
  );
}
