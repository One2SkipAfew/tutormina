import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import {
  listRecordings,
  uploadRecording,
  processRecording,
  getRecordingClaims,
} from '../../lib/sessionRecordings';
import type { SessionRecording, SessionRecordingClaim } from '../../types/lms';
import {
  Upload,
  Puzzle,
  FileText,
  Shield,
  Loader,
  CheckCircle,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Clock,
} from 'lucide-react';

const VERDICT_CONFIG: Record<string, { color: string; bg: string }> = {
  TRUE: { color: '#22c55e', bg: 'rgba(34, 197, 94, 0.1)' },
  FALSE: { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  MISLEADING: { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.1)' },
  UNVERIFIABLE: { color: '#6b7280', bg: 'rgba(107, 114, 128, 0.1)' },
};

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  pending: { color: '#6b7280', label: 'Pending' },
  processing: { color: '#f59e0b', label: 'Processing…' },
  ready: { color: '#22c55e', label: 'Ready' },
  failed: { color: '#ef4444', label: 'Failed' },
};

const PLATFORM_LABEL: Record<string, string> = {
  google_meet: 'Google Meet',
  microsoft_teams: 'Microsoft Teams',
  zoom: 'Zoom',
  other: 'Other',
};

function formatDuration(secs: number | null): string {
  if (!secs) return '—';
  const mins = Math.floor(secs / 60);
  const remaining = secs % 60;
  return `${mins}:${remaining.toString().padStart(2, '0')}`;
}

export default function SessionRecordings() {
  const { profile } = useAuth();
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<SessionRecording | null>(null);
  const [claims, setClaims] = useState<SessionRecordingClaim[]>([]);
  const [claimsLoading, setClaimsLoading] = useState(false);

  const [showExtensionInfo, setShowExtensionInfo] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadConsent, setUploadConsent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadRecordings = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const data = await listRecordings(profile.id);
      setRecordings(data);
    } catch (err) {
      console.error('Failed to load session recordings:', err);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadRecordings();
  }, [loadRecordings]);

  const openRecording = async (recording: SessionRecording) => {
    setSelected(recording);
    setClaims([]);
    if (recording.status === 'ready') {
      setClaimsLoading(true);
      try {
        setClaims(await getRecordingClaims(recording.id));
      } catch (err) {
        console.error('Failed to load fact-check claims:', err);
      } finally {
        setClaimsLoading(false);
      }
    }
  };

  const handleUpload = async () => {
    const file = fileInputRef.current?.files?.[0];
    if (!file || !profile || !uploadConsent) return;

    setUploading(true);
    setUploadError(null);
    try {
      const recording = await uploadRecording(file, profile.id, {
        title: uploadTitle.trim() || file.name,
        captureMethod: 'upload',
        consentConfirmed: uploadConsent,
      });
      setShowUploadModal(false);
      setUploadTitle('');
      setUploadConsent(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await loadRecordings();
      processRecording(recording.id)
        .then(() => loadRecordings())
        .catch((err) => {
          console.error('Processing failed:', err);
          loadRecordings();
        });
    } catch (err: any) {
      console.error('Upload failed:', err);
      setUploadError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1100px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={22} /> Session Recordings
          </h2>
          <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.9rem' }}>
            Upload a recording from OBS or any tool, or capture a Meet/Teams/Zoom call live with the Chommie browser extension.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            className="btn btn-outline"
            onClick={() => setShowExtensionInfo(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Puzzle size={16} /> Get Chommie extension
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setShowUploadModal(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <Upload size={16} /> Upload Recording
          </button>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280' }}>
          <Loader size={16} className="spin" /> Loading recordings…
        </div>
      ) : recordings.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem 1rem', color: '#6b7280', border: '1px dashed #e5e7eb', borderRadius: '12px' }}>
          <FileText size={40} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
          <p>No session recordings yet.</p>
          <p style={{ fontSize: '0.85rem' }}>Upload a file or use the Chommie extension during your next call.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          {recordings.map((rec) => {
            const status = STATUS_CONFIG[rec.status] || STATUS_CONFIG.pending;
            return (
              <div
                key={rec.id}
                onClick={() => openRecording(rec)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '1rem',
                  border: '1px solid #e5e7eb',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: '#fff',
                }}
              >
                <div>
                  <div style={{ fontWeight: 600 }}>{rec.title || 'Untitled recording'}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6b7280', display: 'flex', gap: '0.75rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                    <span>{new Date(rec.created_at).toLocaleString()}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={12} /> {formatDuration(rec.duration_seconds)}
                    </span>
                    {rec.platform && <span>{PLATFORM_LABEL[rec.platform]}</span>}
                    <span>{rec.capture_method === 'extension_capture' ? 'Chommie capture' : 'Uploaded'}</span>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: status.color,
                    background: `${status.color}1a`,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '999px',
                  }}
                >
                  {status.label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Extension Info Modal */}
      {showExtensionInfo && (
        <div
          onClick={() => setShowExtensionInfo(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '440px', maxWidth: '90vw' }}>
            <h3 style={{ marginTop: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Puzzle size={20} /> Install Chommie
            </h3>
            <p style={{ fontSize: '0.9rem', color: '#374151' }}>
              Chommie is a browser extension that captures Google Meet, Microsoft Teams, or Zoom calls
              directly from your browser tab so notes land here automatically. It's in pilot, so it isn't
              on the Chrome Web Store yet — install it manually:
            </p>
            <ol style={{ fontSize: '0.85rem', color: '#374151', paddingLeft: '1.1rem' }}>
              <li>Download the extension folder from your TutorMina admin/coach resources.</li>
              <li>Open <code>chrome://extensions</code>, enable Developer mode.</li>
              <li>Click "Load unpacked" and select the extension folder.</li>
              <li>Sign in with your TutorMina account from the extension popup.</li>
            </ol>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-outline" onClick={() => setShowExtensionInfo(false)}>
                Got it
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div
          onClick={() => !uploading && setShowUploadModal(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '420px', maxWidth: '90vw' }}>
            <h3 style={{ marginTop: 0 }}>Upload Recording</h3>
            <input
              type="file"
              accept="audio/*,video/*"
              ref={fileInputRef}
              style={{ marginBottom: '0.75rem', width: '100%' }}
            />
            <input
              type="text"
              placeholder="Title (optional)"
              value={uploadTitle}
              onChange={(e) => setUploadTitle(e.target.value)}
              style={{ width: '100%', padding: '0.5rem', marginBottom: '0.75rem', border: '1px solid #e5e7eb', borderRadius: '6px' }}
            />
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', fontSize: '0.85rem', color: '#374151', marginBottom: '1rem' }}>
              <input type="checkbox" checked={uploadConsent} onChange={(e) => setUploadConsent(e.target.checked)} style={{ marginTop: '0.2rem' }} />
              I have permission to record and process this session, and (if applicable) other participants were informed.
            </label>
            {uploadError && <p style={{ color: '#ef4444', fontSize: '0.85rem' }}>{uploadError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button className="btn btn-outline" onClick={() => setShowUploadModal(false)} disabled={uploading}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleUpload} disabled={uploading || !uploadConsent}>
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div
          onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', width: '700px', maxWidth: '92vw', maxHeight: '85vh', overflowY: 'auto' }}
          >
            <h3 style={{ marginTop: 0 }}>{selected.title || 'Untitled recording'}</h3>

            {selected.status === 'processing' || selected.status === 'pending' ? (
              <p style={{ color: '#6b7280', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Loader size={16} className="spin" /> Transcribing and fact-checking…
              </p>
            ) : selected.status === 'failed' ? (
              <p style={{ color: '#ef4444' }}>Processing failed for this recording.</p>
            ) : (
              <>
                <div style={{ marginBottom: '1rem' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <FileText size={16} /> Transcript
                  </h4>
                  <div style={{ maxHeight: '200px', overflowY: 'auto', fontSize: '0.85rem', color: '#374151', whiteSpace: 'pre-wrap', background: '#f9fafb', padding: '0.75rem', borderRadius: '8px' }}>
                    {selected.transcript_text || 'No transcript available.'}
                  </div>
                </div>

                <div>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.5rem' }}>
                    <Shield size={16} /> Fact Check
                  </h4>
                  {claimsLoading ? (
                    <p style={{ color: '#6b7280' }}>Loading claims…</p>
                  ) : claims.length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.85rem' }}>No verifiable claims detected.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {claims.map((claim) => {
                        const cfg = VERDICT_CONFIG[claim.verdict] || VERDICT_CONFIG.UNVERIFIABLE;
                        return (
                          <div key={claim.id} style={{ border: `1px solid ${cfg.color}33`, background: cfg.bg, borderRadius: '8px', padding: '0.6rem 0.75rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '0.8rem', color: cfg.color }}>
                              {claim.verdict === 'TRUE' ? <CheckCircle size={14} /> : claim.verdict === 'FALSE' ? <XCircle size={14} /> : claim.verdict === 'MISLEADING' ? <AlertTriangle size={14} /> : <HelpCircle size={14} />}
                              {claim.verdict}
                            </div>
                            <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>{claim.claim_text}</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
