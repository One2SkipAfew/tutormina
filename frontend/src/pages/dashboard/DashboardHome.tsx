import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/lms';

interface StatItem {
  icon: string;
  value: string;
  label: string;
}

interface QuickAction {
  icon: string;
  label: string;
  description: string;
  to: string;
}

function getStatsForRole(role: UserRole): StatItem[] {
  if (role === 'tutor') {
    return [
      { icon: '👨‍🎓', value: '—', label: 'Active Students' },
      { icon: '📚', value: '—', label: 'Resources Shared' },
      { icon: '📅', value: '—', label: 'Upcoming Sessions' },
      { icon: '⭐', value: '—', label: 'Avg. Rating' },
    ];
  }
  if (role === 'coach') {
    return [
      { icon: '🤝', value: '—', label: 'Active Clients' },
      { icon: '📁', value: '—', label: 'Resources Shared' },
      { icon: '📅', value: '—', label: 'Upcoming Sessions' },
      { icon: '💬', value: '—', label: 'Session Hours' },
    ];
  }
  // Student
  return [
    { icon: '📖', value: '—', label: 'Resources Available' },
    { icon: '📅', value: '—', label: 'Upcoming Sessions' },
    { icon: '🎯', value: '—', label: 'Learning Streak' },
    { icon: '🏆', value: '—', label: 'Completed Sessions' },
  ];
}

function getQuickActionsForRole(role: UserRole): QuickAction[] {
  if (role === 'tutor') {
    return [
      { icon: '📂', label: 'Upload Resources', description: 'Share notes, past papers, or course material', to: '/dashboard/resources' },
      { icon: '🖥️', label: 'SharedDrive', description: 'Browse & share collaborative resources', to: '/dashboard/shared-drive' },
      { icon: '👨‍🎓', label: 'My Students', description: 'View and manage your students', to: '/dashboard/students' },
      { icon: '✨', label: 'AI Insights', description: 'Summarise files & extract insights', to: '/dashboard/ai-insights' },
    ];
  }
  if (role === 'coach') {
    return [
      { icon: '📂', label: 'Upload Resources', description: 'Share coaching materials & recordings', to: '/dashboard/resources' },
      { icon: '🖥️', label: 'SharedDrive', description: 'Browse & share collaborative resources', to: '/dashboard/shared-drive' },
      { icon: '🤝', label: 'My Clients', description: 'View and manage your coaching clients', to: '/dashboard/students' },
      { icon: '✨', label: 'AI Insights', description: 'Summarise files & extract insights', to: '/dashboard/ai-insights' },
    ];
  }
  // Student
  return [
    { icon: '🖥️', label: 'SharedDrive', description: 'Access resources from your tutors & coaches', to: '/dashboard/shared-drive' },
    { icon: '✨', label: 'AI Insights', description: 'Get summaries & insights from your materials', to: '/dashboard/ai-insights' },
    { icon: '👤', label: 'My Profile', description: 'Update your profile & preferences', to: '/dashboard/profile' },
  ];
}

function getWelcomeMessage(role: UserRole, name: string, isParentMode: boolean): { title: string; subtitle: string } {
  if (isParentMode) {
    return {
      title: `Welcome back, ${name} 👨‍👩‍👧`,
      subtitle: "You're viewing in Parent Mode. Track your child's progress and access shared resources.",
    };
  }
  if (role === 'tutor') {
    return {
      title: `Welcome back, ${name} 🎓`,
      subtitle: 'Manage your resources, connect with students, and leverage AI to enhance learning.',
    };
  }
  if (role === 'coach') {
    return {
      title: `Welcome back, ${name} 🤝`,
      subtitle: 'Manage your coaching materials, track client progress, and share insights.',
    };
  }
  return {
    title: `Hey ${name}! 👋`,
    subtitle: 'Access your learning resources, track your sessions, and explore AI-powered study tools.',
  };
}

export default function DashboardHome() {
  const { profile, isParentMode } = useAuth();
  const role = profile?.role ?? 'customer';
  const zone = role === 'tutor' ? 'tutor' : role === 'coach' ? 'coach' : 'student';
  const firstName = profile?.first_name ?? 'there';

  const stats = getStatsForRole(role);
  const quickActions = getQuickActionsForRole(role);
  const welcome = getWelcomeMessage(role, firstName, isParentMode);

  return (
    <div className="animate-slide-up">
      {/* Welcome Header */}
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">{welcome.title}</h1>
        <p className="dashboard-page-subtitle">{welcome.subtitle}</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div className="stat-card" key={i}>
            <div className="stat-card-header">
              <div className={`stat-card-icon ${zone}`}>
                {stat.icon}
              </div>
            </div>
            <div className="stat-card-value">{stat.value}</div>
            <div className="stat-card-label">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header">
          <h3 className="content-panel-title">Quick Actions</h3>
        </div>
        <div className="content-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            {quickActions.map((action, i) => (
              <a
                key={i}
                href={action.to}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid rgba(0,0,0,0.06)',
                  textDecoration: 'none',
                  color: 'inherit',
                  transition: 'all 0.2s',
                  background: '#fafafa',
                }}
                onMouseOver={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-md)';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                }}
                onMouseOut={e => {
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                  (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                }}
              >
                <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{action.icon}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                    {action.label}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    {action.description}
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity (Placeholder) */}
      <div className="content-panel">
        <div className="content-panel-header">
          <h3 className="content-panel-title">Recent Activity</h3>
        </div>
        <div className="content-panel-body">
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No recent activity</div>
            <div className="empty-state-text">
              Your latest uploads, sessions, and resource interactions will appear here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
