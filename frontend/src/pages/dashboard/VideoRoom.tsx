/**
 * VideoRoom — In-house video conferencing using Daily.co
 *
 * Embeds a Daily.co prebuilt video call iframe, with a sidebar for
 * real-time transcription, AI notes, and fact-checking.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useRealtimeTranscript } from '../../lib/useRealtimeTranscript';
import { useFactChecker } from '../../lib/useFactChecker';
import { generateLiveNotes, summariseSession } from '../../lib/aiApi';
import { supabase } from '../../lib/supabaseClient';
import { provisionVideoRoom, getVideoRoomToken, buildRoomUrl } from '../../lib/videoRooms';
import { useModal } from '../../contexts/NotificationContext';
import '../../styles/live-session.css';

const formatTime = (secs: number): string => {
  const hrs = Math.floor(secs / 3600);
  const mins = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (hrs > 0) return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${mins.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const VERDICT_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  TRUE: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)', label: 'TRUE' },
  FALSE: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)', label: 'FALSE' },
  MISLEADING: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)', label: 'MISLEADING' },
  UNVERIFIABLE: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)', label: 'UNVERIFIABLE' },
};

type SidebarTab = 'transcript' | 'notes' | 'factcheck';

export default function VideoRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();

  // Room info
  const [room, setRoom] = useState<{
    id: string;
    room_name: string;
    daily_room_url: string | null;
    status: string;
    booking_id: string | null;
    host_id: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const { showModal } = useModal();

  // Sidebar
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<SidebarTab>('transcript');
  const [expandedClaim, setExpandedClaim] = useState<number | null>(null);

  // Transcription
  const transcript = useRealtimeTranscript();

  // Fact checking
  const factChecker = useFactChecker();

  // AI Notes
  const [aiNotes, setAiNotes] = useState('');
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);

  // Session Summary
  const [sessionSummary, setSessionSummary] = useState('');
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);

  // Automated room provisioning (replaces the old manual "paste your room URL" flow)
  const [isProvisioning, setIsProvisioning] = useState(false);
  const provisionAttempted = useRef(false);

  // Signed iframe URL. Rooms are private, so the room URL on its own won't admit anyone —
  // this holds the URL with a short-lived per-user join token attached.
  const [joinUrl, setJoinUrl] = useState<string | null>(null);
  const tokenRequestedFor = useRef<string | null>(null);

  const provisionRoom = useCallback(async () => {
    if (!room || !room.booking_id || room.daily_room_url || provisionAttempted.current) return;
    provisionAttempted.current = true;
    setIsProvisioning(true);
    try {
      const vr = await provisionVideoRoom(room.booking_id);
      setRoom(prev => prev ? { ...prev, daily_room_url: vr.daily_room_url, status: vr.status } : prev);
    } catch (err) {
      showModal({
        type: 'error',
        title: 'Room Setup Failed',
        message: err instanceof Error ? err.message : 'Could not set up the video room. Please try again.',
        buttons: [{ label: 'Retry', variant: 'primary', onClick: () => { provisionAttempted.current = false; provisionRoom(); } }, { label: 'Close', variant: 'outline', onClick: 'dismiss' }],
      });
    } finally {
      setIsProvisioning(false);
    }
  }, [room, showModal]);

  useEffect(() => { provisionRoom(); }, [provisionRoom]);

  // Once the room has a URL, exchange it for a signed join URL.
  useEffect(() => {
    if (!room?.daily_room_url || !roomId || tokenRequestedFor.current === roomId) return;
    tokenRequestedFor.current = roomId;

    let cancelled = false;
    getVideoRoomToken(roomId)
      .then((token) => {
        if (!cancelled && room.daily_room_url) setJoinUrl(buildRoomUrl(room.daily_room_url, token));
      })
      .catch((err) => {
        if (cancelled) return;
        tokenRequestedFor.current = null;
        showModal({
          type: 'error',
          title: 'Could Not Join Room',
          message: err instanceof Error ? err.message : 'We could not get you into the video room.',
          buttons: [{ label: 'Back to Bookings', variant: 'primary', onClick: () => navigate('/dashboard/bookings') }, { label: 'Close', variant: 'outline', onClick: 'dismiss' }],
        });
      });

    return () => { cancelled = true; };
  }, [room?.daily_room_url, roomId, showModal, navigate]);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Load room data
  useEffect(() => {
    if (!roomId) return;

    const loadRoom = async () => {
      setLoading(true);
      const { data, error: err } = await supabase
        .from('video_rooms')
        .select('*')
        .eq('id', roomId)
        .single();

      if (err || !data) {
        setLoading(false);
        showModal({ 
          type: 'error', 
          title: 'Room Not Found', 
          message: 'This video room does not exist or you do not have access.', 
          buttons: [{ label: 'Back to Bookings', variant: 'primary', onClick: () => navigate('/dashboard/bookings') }] 
        });
        return;
      }

      setRoom(data);
      setLoading(false);
    };

    loadRoom();
  }, [roomId]);

  // Auto-scroll
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript.transcriptEntries, transcript.interimText]);

  // Generate AI notes
  const generateNotes = useCallback(async () => {
    const fullTranscript = transcript.getFullTranscript();
    if (!fullTranscript.trim()) return;
    setIsGeneratingNotes(true);
    try {
      const response = await generateLiveNotes(fullTranscript);
      setAiNotes(response.result);
    } catch (err) {
      console.error('AI notes error:', err);
      showModal({ type: 'error', title: 'AI Notes Failed', message: err instanceof Error ? err.message : 'Could not generate AI notes right now. Please try again.', buttons: [{ label: 'OK', variant: 'primary', onClick: 'dismiss' }] });
    } finally {
      setIsGeneratingNotes(false);
    }
  }, [transcript, showModal]);

  // Run fact check
  const runFactCheck = useCallback(async () => {
    const fullTranscript = transcript.getFullTranscript();
    if (!fullTranscript.trim()) return;
    await factChecker.checkTranscript(fullTranscript);
  }, [transcript, factChecker]);

  // End session and summarise
  const endSession = useCallback(async () => {
    transcript.stop();
    const fullTranscript = transcript.getFullTranscript();

    // Update room status
    if (roomId) {
      await supabase.from('video_rooms').update({
        status: 'ended',
        ended_at: new Date().toISOString(),
      }).eq('id', roomId);
    }

    if (!fullTranscript.trim()) {
      navigate('/dashboard/bookings');
      return;
    }

    // Persist the raw transcript first and independently of the AI call — if the summary
    // request fails (cold start, rate limit), the session's actual record must still survive.
    const finalEntries = transcript.transcriptEntries.filter((e) => e.isFinal && e.text.trim());
    if (roomId && finalEntries.length > 0) {
      const { error: transcriptError } = await supabase.from('session_transcripts').insert(
        finalEntries.map((entry) => ({
          video_room_id: roomId,
          booking_id: room?.booking_id ?? null,
          speaker_label: `Speaker ${entry.speaker}`,
          text: entry.text,
          start_time: entry.start,
          end_time: entry.end,
          is_final: true,
        }))
      );
      if (transcriptError) console.error('Failed to save session transcript:', transcriptError);
    }

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

      // Save summary to database
      if (profile) {
        await supabase.from('session_summaries').insert({
          video_room_id: roomId,
          booking_id: room?.booking_id,
          created_by: profile.id,
          summary_text: response.summary,
          duration_seconds: transcript.duration,
          transcript_word_count: fullTranscript.split(/\s+/).length,
        });
      }
    } catch (err) {
      console.error('Summary error:', err);
      showModal({ type: 'error', title: 'Summary Failed', message: err instanceof Error ? err.message : 'Could not generate the session summary right now.', buttons: [{ label: 'Back to Bookings', variant: 'primary', onClick: () => navigate('/dashboard/bookings') }, { label: 'Close', variant: 'outline', onClick: 'dismiss' }] });
    } finally {
      setIsGeneratingSummary(false);
    }
  }, [transcript, aiNotes, factChecker.results, roomId, room, profile, navigate, showModal]);

  // Surface fact-checker failures as a modal instead of leaving them silent in the console.
  useEffect(() => {
    if (factChecker.error) {
      showModal({ type: 'error', title: 'Fact Check Failed', message: factChecker.error, buttons: [{ label: 'OK', variant: 'primary', onClick: 'dismiss' }] });
      factChecker.clearError();
    }
  }, [factChecker.error, factChecker.clearError, showModal]);

  // Render markdown
  const renderMarkdown = (md: string): string => {
    if (!md) return '';
    let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<li>$1</li>');
    html = html.replace(/\n/g, '<br />');
    return html;
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="spinner" />
        <span style={{ marginLeft: '1rem', color: '#64748b' }}>Loading video room...</span>
      </div>
    );
  }

  if (!room) {
    return null;
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)', gap: '1px', background: 'rgba(0,0,0,0.06)', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Main Video Area */}
      <div style={{ flex: sidebarOpen ? '2' : '1', display: 'flex', flexDirection: 'column', background: '#000', position: 'relative' }}>
        {/* Video Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', background: 'rgba(26,26,46,0.95)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.65rem', background: (room.status === 'active' || !!room.daily_room_url) && room.status !== 'ended' ? 'rgba(34,197,94,0.2)' : 'rgba(245,158,11,0.2)', color: (room.status === 'active' || !!room.daily_room_url) && room.status !== 'ended' ? '#22c55e' : '#f59e0b', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>
              {(room.status === 'active' || !!room.daily_room_url) && room.status !== 'ended' ? '🟢 LIVE' : room.status === 'ended' ? '🔴 ENDED' : '🟡 WAITING'}
            </span>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700 }}>{room.room_name}</h3>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              🕐 {formatTime(transcript.duration)}
            </span>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '6px', color: '#e2e8f0', padding: '4px 10px', cursor: 'pointer', fontSize: '0.75rem' }}
            >
              {sidebarOpen ? '← Hide Panel' : '→ Show Panel'}
            </button>
            <button
              onClick={endSession}
              disabled={isGeneratingSummary}
              style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '6px', color: '#fca5a5', padding: '6px 14px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}
            >
              {isGeneratingSummary ? '⏳ Ending...' : '⏹️ End Session'}
            </button>
          </div>
        </div>

        {/* Daily.co iframe */}
        {joinUrl ? (
          <iframe
            ref={iframeRef}
            src={joinUrl}
            style={{ flex: 1, border: 'none', background: '#000' }}
            allow="camera; microphone; fullscreen; speaker; display-capture"
            title="Video Conference"
          />
        ) : room.daily_room_url ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: '1rem', background: '#1a1a2e' }}>
            <div className="spinner" />
            <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>Joining your session…</p>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', flexDirection: 'column', gap: '1rem', background: '#1a1a2e' }}>
            <span style={{ fontSize: '3rem' }}>📹</span>
            <h3 style={{ color: '#e2e8f0', margin: 0 }}>{isProvisioning ? 'Setting Up Your Room...' : 'Room Not Ready'}</h3>
            <p style={{ fontSize: '0.85rem', color: '#94a3b8', maxWidth: '400px', textAlign: 'center' }}>
              {isProvisioning
                ? 'This only takes a moment.'
                : 'We couldn\'t set up the video room automatically. Please refresh to try again.'}
            </p>
            {isProvisioning && <div className="spinner" />}
          </div>
        )}

        {/* Start Transcription Bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '8px 16px', background: 'rgba(26,26,46,0.95)', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          {!transcript.isListening ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <button className="ls-btn ls-btn-start" onClick={() => transcript.start({ captureTabAudio: true })} style={{ fontSize: '0.78rem', padding: '6px 16px' }}>
                🎙️ Start Transcription (Share Tab Audio)
              </button>
              <div style={{ fontSize: '0.75rem', color: '#f59e0b', maxWidth: '350px', lineHeight: 1.3 }}>
                <strong>Important:</strong> When prompted, you MUST select <strong>This Tab</strong> and check <strong>Share tab audio</strong> to capture both voices.
              </div>
            </div>
          ) : (
            <>
              <div className="ls-status-badge" style={{ '--badge-color': '#22c55e' } as React.CSSProperties}>
                <span className="ls-status-dot" />
                <span>Transcribing ({transcript.method})</span>
              </div>
              <button className="ls-btn ls-btn-pause" onClick={transcript.togglePause} style={{ fontSize: '0.72rem', padding: '4px 10px' }}>
                {transcript.isPaused ? '▶️ Resume' : '⏸️ Pause'}
              </button>
              <button className="ls-btn ls-btn-sm" onClick={generateNotes} disabled={isGeneratingNotes} style={{ fontSize: '0.72rem', background: 'rgba(255,255,255,0.08)', color: '#e2e8f0' }}>
                {isGeneratingNotes ? '⏳' : '✨'} Notes
              </button>
              <button className="ls-btn ls-btn-sm ls-btn-factcheck" onClick={runFactCheck} disabled={factChecker.isChecking} style={{ fontSize: '0.72rem' }}>
                {factChecker.isChecking ? '⏳' : '🛡️'} Fact Check
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sidebar Panel */}
      {sidebarOpen && (
        <div style={{ width: '380px', display: 'flex', flexDirection: 'column', background: '#fff', overflow: 'hidden' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.06)', flexShrink: 0 }}>
            {(['transcript', 'notes', 'factcheck'] as SidebarTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  border: 'none',
                  background: activeTab === tab ? '#fff' : '#fafbfc',
                  borderBottom: activeTab === tab ? '2px solid var(--color-primary, #4ecdc4)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: activeTab === tab ? 700 : 500,
                  color: activeTab === tab ? '#1a1a2e' : '#64748b',
                }}
              >
                {tab === 'transcript' ? `📝 Transcript (${transcript.transcriptEntries.length})` :
                 tab === 'notes' ? '✨ AI Notes' :
                 `🛡️ Facts (${factChecker.results.length})`}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px' }}>
            {activeTab === 'transcript' && (
              <>
                {transcript.transcriptEntries.length === 0 && !transcript.interimText ? (
                  <div className="ls-transcript-empty">
                    <span style={{ fontSize: '2rem' }}>🎙️</span>
                    <p>Start transcription to see the live transcript.</p>
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
              </>
            )}

            {activeTab === 'notes' && (
              <>
                {aiNotes ? (
                  <div className="ls-notes-content" dangerouslySetInnerHTML={{ __html: renderMarkdown(aiNotes) }} />
                ) : (
                  <div className="ls-notes-empty">
                    <span style={{ fontSize: '2rem' }}>✨</span>
                    <p>Click 'Notes' in the toolbar to generate AI notes from the transcript.</p>
                  </div>
                )}
              </>
            )}

            {activeTab === 'factcheck' && (
              <>
                {factChecker.results.length === 0 ? (
                  <div className="ls-factcheck-empty">
                    <span style={{ fontSize: '2rem' }}>🛡️</span>
                    <p>Click 'Fact Check' to verify claims from the transcript.</p>
                  </div>
                ) : (
                  <div className="ls-claims-list">
                    {factChecker.results.map((result, idx) => {
                      const cfg = VERDICT_CONFIG[result.verdict] || VERDICT_CONFIG.UNVERIFIABLE;
                      const isExpanded = expandedClaim === idx;
                      return (
                        <div
                          key={idx}
                          className="ls-claim-card"
                          style={{ '--verdict-color': cfg.color, '--verdict-bg': cfg.bg } as React.CSSProperties}
                          onClick={() => setExpandedClaim(isExpanded ? null : idx)}
                        >
                          <div className="ls-claim-header">
                            <div className="ls-verdict-badge">
                              {result.verdict === 'TRUE' ? '✅' : result.verdict === 'FALSE' ? '❌' : result.verdict === 'MISLEADING' ? '⚠️' : '❓'}
                              <span>{cfg.label}</span>
                            </div>
                            <div className="ls-confidence-bar">
                              <div className="ls-confidence-fill" style={{ width: `${(result.confidence || 0) * 100}%` }} />
                              <span>{Math.round((result.confidence || 0) * 100)}%</span>
                            </div>
                          </div>
                          <p className="ls-claim-text">{result.claim}</p>
                          {isExpanded && (
                            <div className="ls-claim-details">
                              {result.explanation && (
                                <div className="ls-detail-section"><h4>Explanation</h4><p>{result.explanation}</p></div>
                              )}
                              {result.key_evidence && (
                                <div className="ls-detail-section"><h4>Evidence</h4><p>{result.key_evidence}</p></div>
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
              </>
            )}
          </div>
        </div>
      )}

      {/* Session Summary Modal */}
      {showSummaryModal && sessionSummary && (
        <div className="ls-package-overlay" onClick={() => setShowSummaryModal(false)}>
          <div className="ls-package-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ls-package-header">
              <h2>📦 Session Summary</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn btn-primary btn-sm" onClick={() => navigate('/dashboard/bookings')}>
                  Done
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
