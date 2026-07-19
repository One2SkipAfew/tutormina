import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getZoneColor } from '../../types/lms';
import type { LearningEvent } from '../../types/lms';
import {
  getMyLearningEvents,
  addLearningEvent,
  logEventResult,
  deleteLearningEvent,
  getMyTutors,
  submitFileToProvider,
  getLearningStreak,
  type MyTutor,
} from '../../lib/learningZone';
import { uploadStudentDocument } from '../../lib/studentDetails';

const EVENT_TYPE_LABELS: Record<LearningEvent['event_type'], string> = {
  benchmark: '🎯 Benchmark',
  deadline: '⏰ Deadline',
  submission: '📤 Submission',
  test: '📝 Test',
  exam: '📚 Exam',
};

export default function LearningZone() {
  const { profile } = useAuth();
  const zone = getZoneColor(profile?.role ?? 'customer');
  const zoneColor = 'var(--zone-student)';

  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [eventType, setEventType] = useState<LearningEvent['event_type']>('benchmark');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');

  const [loggingFor, setLoggingFor] = useState<string | null>(null);
  const [resultText, setResultText] = useState('');
  const [resultFile, setResultFile] = useState<File | null>(null);
  const [uploadingResult, setUploadingResult] = useState(false);

  const [tutors, setTutors] = useState<MyTutor[]>([]);
  const [selectedTutor, setSelectedTutor] = useState('');
  const [submissionTitle, setSubmissionTitle] = useState('');
  const [submissionFile, setSubmissionFile] = useState<File | null>(null);
  const [submittingWork, setSubmittingWork] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, tut, s] = await Promise.all([getMyLearningEvents(), getMyTutors(), getLearningStreak()]);
      setEvents(ev);
      setTutors(tut);
      setStreak(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load learning zone');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAddEvent = async () => {
    if (!title.trim()) return;
    try {
      const created = await addLearningEvent({ event_type: eventType, title: title.trim(), description: description.trim() || null, event_date: eventDate || null });
      setEvents((prev) => [...prev, created]);
      setTitle('');
      setDescription('');
      setEventDate('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    }
  };

  const handleDelete = async (id: string) => {
    await deleteLearningEvent(id);
    setEvents((prev) => prev.filter((e) => e.id !== id));
  };

  const handleLogResult = async (event: LearningEvent) => {
    setUploadingResult(true);
    try {
      let resultFileUrl: string | null = null;
      if (resultFile) {
        resultFileUrl = await uploadStudentDocument(resultFile);
      }
      await logEventResult(event.id, resultText, resultFileUrl);
      setEvents((prev) => prev.map((e) => e.id === event.id ? { ...e, status: 'completed', result_text: resultText, result_file_url: resultFileUrl } : e));
      setLoggingFor(null);
      setResultText('');
      setResultFile(null);
      const newStreak = await getLearningStreak();
      setStreak(newStreak);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log result');
    } finally {
      setUploadingResult(false);
    }
  };

  const handleSubmitWork = async () => {
    if (!selectedTutor || !submissionFile || !submissionTitle.trim()) return;
    setSubmittingWork(true);
    setSubmissionSuccess(false);
    try {
      await submitFileToProvider(submissionFile, selectedTutor, submissionTitle.trim());
      setSubmissionSuccess(true);
      setSubmissionTitle('');
      setSubmissionFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit');
    } finally {
      setSubmittingWork(false);
    }
  };

  const upcoming = events.filter((e) => e.status === 'upcoming').sort((a, b) => {
    if (!a.event_date) return 1;
    if (!b.event_date) return -1;
    return a.event_date.localeCompare(b.event_date);
  });
  const completed = events.filter((e) => e.status === 'completed').sort((a, b) => b.created_at.localeCompare(a.created_at));

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #d8dde3',
    fontFamily: 'inherit', fontSize: '0.9rem',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: '#334155' };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">🎯 Learning Zone</h1>
        <p className="dashboard-page-subtitle">Plan your year, track results, and submit work to your tutors and coaches.</p>
      </div>

      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header"><div className={`stat-card-icon ${zone}`}>🔥</div></div>
          <div className="stat-card-value">{loading ? '—' : streak}</div>
          <div className="stat-card-label">Week Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className={`stat-card-icon ${zone}`}>📋</div></div>
          <div className="stat-card-value">{loading ? '—' : upcoming.length}</div>
          <div className="stat-card-label">Upcoming Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className={`stat-card-icon ${zone}`}>✅</div></div>
          <div className="stat-card-value">{loading ? '—' : completed.length}</div>
          <div className="stat-card-label">Logged Results</div>
        </div>
      </div>

      {/* Plan */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header" style={{ display: 'block' }}>
          <h3 className="content-panel-title">📅 Plan Your Year</h3>
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>Add benchmarks, deadlines, submission dates, and test/exam dates.</p>
        </div>
        <div className="content-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 160px', gap: '0.75rem', marginBottom: '0.75rem', maxWidth: '760px' }}>
            <div>
              <label style={labelStyle}>Type</label>
              <select value={eventType} onChange={(e) => setEventType(e.target.value as LearningEvent['event_type'])} style={inputStyle}>
                {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Title</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Algebra unit test" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Date (optional)</label>
              <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} style={inputStyle} />
            </div>
          </div>
          <div style={{ marginBottom: '0.75rem', maxWidth: '760px' }}>
            <label style={labelStyle}>Notes (optional)</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} style={inputStyle} />
          </div>
          <button className="btn btn-primary" onClick={handleAddEvent} disabled={!title.trim()}>Add to plan</button>

          {upcoming.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              {upcoming.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.7rem 0', borderBottom: '1px solid #f2f4f6' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{EVENT_TYPE_LABELS[ev.event_type]} — {ev.title}</div>
                    <div style={{ fontSize: '0.78rem', color: '#666' }}>
                      {ev.event_date ? new Date(ev.event_date + 'T00:00:00').toLocaleDateString(undefined, { dateStyle: 'medium' }) : 'No date set'}
                      {ev.description ? ` • ${ev.description}` : ''}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-outline btn-sm" onClick={() => { setLoggingFor(ev.id); setResultText(''); setResultFile(null); }}>Log result</button>
                    <button onClick={() => handleDelete(ev.id)} style={{ border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer', fontWeight: 700 }}>&times;</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {loggingFor && (() => {
            const ev = events.find((e) => e.id === loggingFor);
            if (!ev) return null;
            return (
              <div style={{ marginTop: '1rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', maxWidth: '500px' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.6rem', fontSize: '0.9rem' }}>Log result for "{ev.title}"</div>
                <div style={{ marginBottom: '0.6rem' }}>
                  <label style={labelStyle}>Score / grade</label>
                  <input type="text" value={resultText} onChange={(e) => setResultText(e.target.value)} placeholder="e.g. 82%" style={inputStyle} />
                </div>
                <div style={{ marginBottom: '0.75rem' }}>
                  <label style={labelStyle}>Upload marked paper (optional)</label>
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" onChange={(e) => setResultFile(e.target.files?.[0] ?? null)} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-primary btn-sm" onClick={() => handleLogResult(ev)} disabled={uploadingResult}>
                    {uploadingResult ? 'Saving...' : 'Save result'}
                  </button>
                  <button className="btn btn-outline btn-sm" onClick={() => setLoggingFor(null)}>Cancel</button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Results */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header">
          <h3 className="content-panel-title">📈 Results &amp; Progress</h3>
        </div>
        <div className="content-panel-body">
          {completed.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No results logged yet. Once you complete a test, exam, or deadline, log the result above to track your progress over time.</p>
          ) : (
            completed.map((ev) => (
              <div key={ev.id} style={{ padding: '0.7rem 0', borderBottom: '1px solid #f2f4f6' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>{EVENT_TYPE_LABELS[ev.event_type]} — {ev.title}</div>
                <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.15rem' }}>
                  {ev.result_text && <strong>{ev.result_text}</strong>}
                  {ev.result_file_url && <> &middot; <a href={ev.result_file_url} target="_blank" rel="noopener noreferrer">View file</a></>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Submit work */}
      <div className="content-panel">
        <div className="content-panel-header" style={{ display: 'block' }}>
          <h3 className="content-panel-title">📤 Submit Work to a Tutor</h3>
          <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem' }}>Only the tutor or coach you choose will be able to see this file.</p>
        </div>
        <div className="content-panel-body">
          {tutors.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>You'll be able to submit work once you've booked a session with a tutor or coach.</p>
          ) : (
            <div style={{ maxWidth: '500px' }}>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Send to</label>
                <select value={selectedTutor} onChange={(e) => setSelectedTutor(e.target.value)} style={inputStyle}>
                  <option value="">Select a tutor or coach...</option>
                  {tutors.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <label style={labelStyle}>Title</label>
                <input type="text" value={submissionTitle} onChange={(e) => setSubmissionTitle(e.target.value)} placeholder="e.g. Essay draft 2" style={inputStyle} />
              </div>
              <div style={{ marginBottom: '0.9rem' }}>
                <label style={labelStyle}>File</label>
                <input type="file" onChange={(e) => setSubmissionFile(e.target.files?.[0] ?? null)} />
              </div>
              <button className="btn btn-primary" style={{ background: zoneColor, borderColor: zoneColor }} onClick={handleSubmitWork} disabled={!selectedTutor || !submissionFile || !submissionTitle.trim() || submittingWork}>
                {submittingWork ? 'Submitting...' : 'Submit'}
              </button>
              {submissionSuccess && <p style={{ color: '#137333', fontSize: '0.85rem', marginTop: '0.5rem' }}>✅ Submitted successfully.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
