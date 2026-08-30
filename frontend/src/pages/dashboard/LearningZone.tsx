import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getZoneColor } from '../../types/lms';
import type { LearningEvent, SessionRecording } from '../../types/lms';
import {
  getMyLearningEvents,
  addLearningEvent,
  logEventResult,
  deleteLearningEvent,
  getMyTutors,
  submitFileToProvider,
  getLearningStreak,
  getMyRecentRecordings,
  type MyTutor,
} from '../../lib/learningZone';
import { uploadStudentDocument } from '../../lib/studentDetails';
import { getSessionNotes, deleteSessionNote, type AiSessionNote } from '../../lib/aiNotes';
import { useModal } from '../../contexts/NotificationContext';
import { Target, Calendar as CalendarIcon, Upload, BookOpen, Clock, FileText, Flame, ClipboardList, CheckCircle, TrendingUp, Send, Mic, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

const EVENT_TYPE_LABELS: Record<LearningEvent['event_type'], string> = {
  benchmark: 'Benchmark',
  deadline: 'Deadline',
  submission: 'Submission',
  test: 'Test',
  exam: 'Exam',
};

const getEventIcon = (type: LearningEvent['event_type'], size = 16) => {
  switch (type) {
    case 'benchmark': return <Target size={size} />;
    case 'deadline': return <Clock size={size} />;
    case 'submission': return <Upload size={size} />;
    case 'test': return <FileText size={size} />;
    case 'exam': return <BookOpen size={size} />;
  }
};

export default function LearningZone() {
  const { profile } = useAuth();
  const zone = getZoneColor(profile?.role ?? 'customer');
  const zoneColor = 'var(--zone-student)';

  const [events, setEvents] = useState<LearningEvent[]>([]);
  const [recordings, setRecordings] = useState<SessionRecording[]>([]);
  const [aiNotes, setAiNotes] = useState<AiSessionNote[]>([]);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);
  const { showModal } = useModal();

  const [notesFilter, setNotesFilter] = useState<'all' | 'ai' | 'live'>('all');
  const [expandedNote, setExpandedNote] = useState<string | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ev, tut, s, rec, ain] = await Promise.all([
        getMyLearningEvents(),
        getMyTutors(),
        getLearningStreak(),
        getMyRecentRecordings(),
        getSessionNotes(),
      ]);
      setEvents(ev);
      setTutors(tut);
      setStreak(s);
      setRecordings(rec);
      setAiNotes(ain);
    } catch (err) {
      showModal({ type: 'error', title: 'Load Failed', message: err instanceof Error ? err.message : 'Failed to load learning zone', buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }] });
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
      showModal({ type: 'error', title: 'Add Failed', message: err instanceof Error ? err.message : 'Failed to add', buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }] });
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
      showModal({ type: 'error', title: 'Save Failed', message: err instanceof Error ? err.message : 'Failed to log result', buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }] });
    } finally {
      setUploadingResult(false);
    }
  };

  const handleSubmitWork = async () => {
    if (!selectedTutor || !submissionFile || !submissionTitle.trim()) return;
    setSubmittingWork(true);
    try {
      await submitFileToProvider(submissionFile, selectedTutor, submissionTitle.trim());
      showModal({ type: 'success', title: 'Submitted', message: 'Work submitted successfully.', buttons: [{ label: 'Done', variant: 'primary', onClick: 'dismiss' }] });
      setSubmissionTitle('');
      setSubmissionFile(null);
    } catch (err) {
      showModal({ type: 'error', title: 'Submission Failed', message: err instanceof Error ? err.message : 'Failed to submit', buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }] });
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

  const handleDeleteAiNote = async (id: string) => {
    try {
      await deleteSessionNote(id);
      setAiNotes((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      showModal({ type: 'error', title: 'Delete Failed', message: 'Failed to delete note', buttons: [{ label: 'Dismiss', variant: 'primary', onClick: 'dismiss' }] });
    }
  };

  type UnifiedNote = { id: string; type: 'ai' | 'live'; title: string; date: string; data: any };
  const unifiedNotes: UnifiedNote[] = [
    ...recordings.map(r => ({ id: `rec_${r.id}`, type: 'live' as const, title: r.title || 'Untitled recording', date: r.completed_at || r.created_at, data: r })),
    ...aiNotes.map(n => ({ id: `ai_${n.id}`, type: 'ai' as const, title: n.title, date: n.created_at, data: n }))
  ].sort((a, b) => b.date.localeCompare(a.date))
   .filter(n => notesFilter === 'all' || n.type === notesFilter);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #d8dde3',
    fontFamily: 'inherit', fontSize: '0.9rem',
  };
  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.35rem', color: '#334155' };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Target size={32} color="#2196F3" /> Learning Zone
        </h1>
        <p className="dashboard-page-subtitle">Plan your year, track results, and submit work to your tutors and coaches.</p>
      </div>



      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header"><div className={`stat-card-icon ${zone}`}><Flame size={24} /></div></div>
          <div className="stat-card-value">{loading ? '—' : streak}</div>
          <div className="stat-card-label">Week Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className={`stat-card-icon ${zone}`}><ClipboardList size={24} /></div></div>
          <div className="stat-card-value">{loading ? '—' : upcoming.length}</div>
          <div className="stat-card-label">Upcoming Items</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header"><div className={`stat-card-icon ${zone}`}><CheckCircle size={24} /></div></div>
          <div className="stat-card-value">{loading ? '—' : completed.length}</div>
          <div className="stat-card-label">Logged Results</div>
        </div>
      </div>

      {/* Plan */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header" style={{ display: 'block' }}>
          <h3 className="content-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CalendarIcon size={20} /> Plan Your Year</h3>
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
                    <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      {getEventIcon(ev.event_type)} {EVENT_TYPE_LABELS[ev.event_type]} — {ev.title}
                    </div>
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
          <h3 className="content-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={20} /> Results &amp; Progress</h3>
        </div>
        <div className="content-panel-body">
          {completed.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>No results logged yet. Once you complete a test, exam, or deadline, log the result above to track your progress over time.</p>
          ) : (
            completed.map((ev) => (
              <div key={ev.id} style={{ padding: '0.7rem 0', borderBottom: '1px solid #f2f4f6' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {getEventIcon(ev.event_type)} {EVENT_TYPE_LABELS[ev.event_type]} — {ev.title}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#334155', marginTop: '0.15rem' }}>
                  {ev.result_text && <strong>{ev.result_text}</strong>}
                  {ev.result_file_url && <> &middot; <a href={ev.result_file_url} target="_blank" rel="noopener noreferrer">View file</a></>}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Session Notes (from uploaded recordings / Chommie captures / AI Insights) */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h3 className="content-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mic size={20} /> Session Notes</h3>
            <p style={{ fontSize: '0.8rem', color: '#666', marginTop: '0.25rem', marginBottom: 0 }}>Transcripts, fact-checks, and insights from your sessions and materials.</p>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.3rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => setNotesFilter('all')}
              style={{ border: 'none', background: notesFilter === 'all' ? '#fff' : 'transparent', boxShadow: notesFilter === 'all' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, color: notesFilter === 'all' ? '#334155' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              All Notes
            </button>
            <button
              onClick={() => setNotesFilter('live')}
              style={{ border: 'none', background: notesFilter === 'live' ? '#fff' : 'transparent', boxShadow: notesFilter === 'live' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, color: notesFilter === 'live' ? '#2563eb' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              Live Sessions
            </button>
            <button
              onClick={() => setNotesFilter('ai')}
              style={{ border: 'none', background: notesFilter === 'ai' ? '#fff' : 'transparent', boxShadow: notesFilter === 'ai' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 600, color: notesFilter === 'ai' ? '#7c3aed' : '#64748b', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              AI Insights
            </button>
          </div>
        </div>
        <div className="content-panel-body">
          {unifiedNotes.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              No notes found. Try uploading a recording, using the Chommie extension, or generating an AI Insight.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {unifiedNotes.map((note) => (
                <div key={note.id} style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  <div
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0.9rem', background: '#f8faff', cursor: note.type === 'ai' ? 'pointer' : 'default' }}
                    onClick={() => {
                      if (note.type === 'ai') setExpandedNote(expandedNote === note.id ? null : note.id);
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {note.title}
                        <span style={{
                          fontSize: '0.65rem', fontWeight: 700, padding: '0.15rem 0.4rem', borderRadius: '4px',
                          background: note.type === 'ai' ? '#f5f3ff' : '#eff6ff',
                          color: note.type === 'ai' ? '#7c3aed' : '#2563eb',
                          border: `1px solid ${note.type === 'ai' ? '#ddd6fe' : '#bfdbfe'}`
                        }}>
                          {note.type === 'ai' ? <span style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Sparkles size={10} /> AI Insight</span> : 'Live Session'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.2rem' }}>
                        {new Date(note.date).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
                      </div>
                    </div>
                    
                    <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
                      {note.type === 'live' ? (
                        <Link to="/dashboard/session-recordings" style={{ fontSize: '0.8rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>Open Recording</Link>
                      ) : (
                        <>
                          <span style={{ color: '#7c3aed' }}>{expandedNote === note.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</span>
                          <button onClick={e => { e.stopPropagation(); handleDeleteAiNote(note.data.id); }} style={{ border: 'none', background: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600 }}>Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                  {note.type === 'ai' && expandedNote === note.id && (
                    <div style={{ padding: '0.9rem', borderTop: '1px solid #e2e8f0', background: 'white' }}>
                      {note.data.summary && <p style={{ fontSize: '0.85rem', marginBottom: '0.75rem', lineHeight: 1.65, color: '#334155' }}><strong style={{ color: '#5b21b6' }}>Summary:</strong> {note.data.summary}</p>}
                      {note.data.key_topics && note.data.key_topics.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                          {note.data.key_topics.map((t: string, i: number) => (
                            <span key={i} style={{ display: 'inline-block', padding: '0.2rem 0.6rem', borderRadius: '12px', background: '#f1f5f9', color: '#475569', fontSize: '0.75rem', fontWeight: 600, border: '1px solid #e2e8f0' }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit work */}
      <div className="content-panel">
        <div className="content-panel-header" style={{ display: 'block' }}>
          <h3 className="content-panel-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Send size={20} /> Submit Work to a Tutor</h3>
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

            </div>
          )}
        </div>
      </div>
    </div>
  );
}
