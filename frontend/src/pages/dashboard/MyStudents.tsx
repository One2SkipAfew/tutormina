import { useAuth } from '../../contexts/AuthContext';
import { getZoneColor } from '../../types/lms';

export default function MyStudents() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'customer';
  const zone = getZoneColor(role);
  const isCoach = role === 'coach';

  const zoneColor = zone === 'tutor' ? 'var(--zone-tutor)' : zone === 'coach' ? 'var(--zone-coach)' : 'var(--zone-student)';

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

      {/* Stats */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div className={`stat-card-icon ${zone}`}>
              {isCoach ? '🤝' : '👨‍🎓'}
            </div>
          </div>
          <div className="stat-card-value">—</div>
          <div className="stat-card-label">{isCoach ? 'Active Clients' : 'Active Students'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className={`stat-card-icon ${zone}`}>📅</div>
          </div>
          <div className="stat-card-value">—</div>
          <div className="stat-card-label">Sessions This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-header">
            <div className={`stat-card-icon ${zone}`}>📈</div>
          </div>
          <div className="stat-card-value">—</div>
          <div className="stat-card-label">Avg. Progress</div>
        </div>
      </div>

      {/* Student List */}
      <div className="content-panel">
        <div className="content-panel-header">
          <h3 className="content-panel-title">
            {isCoach ? 'Coaching Clients' : 'Students'}
          </h3>
          <button
            className="btn btn-outline"
            style={{ padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderColor: zoneColor, color: zoneColor }}
          >
            + Invite {isCoach ? 'Client' : 'Student'}
          </button>
        </div>
        <div className="content-panel-body">
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
        </div>
      </div>
    </div>
  );
}
