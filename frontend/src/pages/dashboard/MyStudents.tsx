import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getZoneColor } from '../../types/lms';
import { getMyStudents, type MyStudent } from '../../lib/students';

export default function MyStudents() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const role = profile?.role ?? 'customer';
  const zone = getZoneColor(role);
  const isCoach = role === 'coach';

  const [students, setStudents] = useState<MyStudent[]>([]);
  const [sessionsThisMonth, setSessionsThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const zoneColor = zone === 'tutor' ? 'var(--zone-tutor)' : zone === 'coach' ? 'var(--zone-coach)' : 'var(--zone-student)';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getMyStudents();
      setStudents(result.students);
      setSessionsThisMonth(result.sessionsThisMonth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">
          {isCoach ? '🤝 My Clients' : '👨‍🎓 My Students'}
        </h1>
        <p className="dashboard-page-subtitle">
          {isCoach
            ? 'View and manage your coaching clients, track progress, and share resources.'
            : 'View and manage your students, track their progress, and provide feedback.'
          }
        </p>
      </div>

      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className={`stat-card-icon ${zone}`}>
              {isCoach ? '🤝' : '👨‍🎓'}
            </div>
          </div>
          <div className="stat-card-value">{loading ? '—' : students.length}</div>
          <div className="stat-card-label">{isCoach ? 'Active Clients' : 'Active Students'}</div>
        </div>
        <div className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/dashboard/calendar')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard/calendar'); }} style={{ cursor: 'pointer' }}>
          <div className="stat-card-header">
            <div className={`stat-card-icon ${zone}`}>📅</div>
          </div>
          <div className="stat-card-value">{loading ? '—' : sessionsThisMonth}</div>
          <div className="stat-card-label">Sessions This Month</div>
        </div>
        <div className="stat-card" role="button" tabIndex={0} onClick={() => navigate('/dashboard/calendar')} onKeyDown={(e) => { if (e.key === 'Enter') navigate('/dashboard/calendar'); }} style={{ cursor: 'pointer' }}>
          <div className="stat-card-header">
            <div className={`stat-card-icon ${zone}`}>📈</div>
          </div>
          <div className="stat-card-value">{loading ? '—' : students.reduce((sum, s) => sum + s.session_count, 0)}</div>
          <div className="stat-card-label">Total Sessions</div>
        </div>
      </div>

      {/* Student List */}
      <div className="content-panel">
        <div className="content-panel-header">
          <h3 className="content-panel-title">
            {isCoach ? 'Coaching Clients' : 'Students'}
          </h3>
        </div>
        <div className="content-panel-body">
          {loading ? (
            <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
          ) : students.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">{isCoach ? '🤝' : '👨‍🎓'}</div>
              <div className="empty-state-title">No {isCoach ? 'clients' : 'students'} yet</div>
              <div className="empty-state-text">
                {isCoach
                  ? 'Once clients book sessions with you, they\'ll appear here. You\'ll be able to share resources, track sessions, and monitor progress.'
                  : 'Once students book sessions with you, they\'ll appear here. You can share resources, track their learning journey, and provide tailored support.'
                }
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {students.map((s) => (
                <div key={s.id} style={{
                  display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 0.5rem',
                  borderBottom: '1px solid rgba(0,0,0,0.06)',
                }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '50%', background: `${zoneColor}15`, color: zoneColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0,
                    backgroundImage: s.avatar_url ? `url(${s.avatar_url})` : undefined,
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }}>
                    {!s.avatar_url && `${s.first_name[0]}${s.last_name[0]}`}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>{s.email}</div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                    <div>{s.session_count} session{s.session_count === 1 ? '' : 's'}</div>
                    {s.upcoming_session_date && (
                      <div>Next: {new Date(s.upcoming_session_date).toLocaleDateString()}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
