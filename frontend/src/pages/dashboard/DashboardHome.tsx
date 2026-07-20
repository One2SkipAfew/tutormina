import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole, Notification } from '../../types/lms';
import { getAdminDashboardStats, getRecentAdminActivity, type AdminActivityItem } from '../../lib/admin';
import { getNotifications } from '../../lib/messaging';
import { getMyStudents } from '../../lib/students';
import { getMyBookingsAsCustomer } from '../../lib/bookings';
import { getLearningStreak } from '../../lib/learningZone';
import { supabase } from '../../lib/supabaseClient';
import SessionCompletionPrompt from '../../components/shared/SessionCompletionPrompt';

import { Users, BookOpen, Calendar, Clock, MessageCircle, Target, Trophy, UploadCloud, HardDrive, Sparkles, ClipboardCheck, User } from 'lucide-react';

interface StatItem {
  icon: React.ReactNode;
  value: string;
  label: string;
  to?: string;
}

interface QuickAction {
  icon: React.ReactNode;
  label: string;
  description: string;
  to: string;
}

function getStatsForRole(role: UserRole): StatItem[] {
  if (role === 'tutor') {
    return [
      { icon: <Users size={24} />, value: '—', label: 'Active Students', to: '/dashboard/students' },
      { icon: <BookOpen size={24} />, value: '—', label: 'Resources Shared', to: '/dashboard/shared-drive' },
      { icon: <Calendar size={24} />, value: '—', label: 'Upcoming Sessions', to: '/dashboard/calendar' },
      { icon: <Clock size={24} />, value: '—', label: 'Session Hours', to: '/dashboard/calendar' },
    ];
  }
  if (role === 'coach') {
    return [
      { icon: <Users size={24} />, value: '—', label: 'Active Clients', to: '/dashboard/students' },
      { icon: <BookOpen size={24} />, value: '—', label: 'Resources Shared', to: '/dashboard/shared-drive' },
      { icon: <Calendar size={24} />, value: '—', label: 'Upcoming Sessions', to: '/dashboard/calendar' },
      { icon: <MessageCircle size={24} />, value: '—', label: 'Session Hours', to: '/dashboard/calendar' },
    ];
  }
  // Student
  return [
    { icon: <BookOpen size={24} />, value: '—', label: 'Resources Available', to: '/dashboard/shared-drive' },
    { icon: <Calendar size={24} />, value: '—', label: 'Upcoming Sessions', to: '/dashboard/bookings' },
    { icon: <Target size={24} />, value: '—', label: 'Learning Streak', to: '/dashboard/learning-zone' },
    { icon: <Trophy size={24} />, value: '—', label: 'Completed Sessions', to: '/dashboard/learning-zone' },
  ];
}

async function getProviderStats(providerId: string, role: UserRole): Promise<StatItem[]> {
  const nowIso = new Date().toISOString();

  const [{ students }, resourcesCount, upcomingCount, sessionRows] = await Promise.all([
    getMyStudents(),
    supabase.from('shared_files').select('*', { count: 'exact', head: true }).eq('uploaded_by', providerId).then((r) => r.count ?? 0),
    supabase.from('bookings').select('*', { count: 'exact', head: true }).eq('provider_id', providerId).gte('session_date', nowIso).neq('status', 'cancelled').then((r) => r.count ?? 0),
    supabase.from('bookings').select('duration_minutes').eq('provider_id', providerId).in('status', ['confirmed', 'completed']).then((r) => r.data ?? []),
  ]);

  const sessionHours = Math.round(sessionRows.reduce((sum, b) => sum + (b.duration_minutes ?? 0), 0) / 60);

  if (role === 'coach') {
    return [
      { icon: <Users size={24} />, value: String(students.length), label: 'Active Clients', to: '/dashboard/students' },
      { icon: <BookOpen size={24} />, value: String(resourcesCount), label: 'Resources Shared', to: '/dashboard/shared-drive' },
      { icon: <Calendar size={24} />, value: String(upcomingCount), label: 'Upcoming Sessions', to: '/dashboard/calendar' },
      { icon: <MessageCircle size={24} />, value: String(sessionHours), label: 'Session Hours', to: '/dashboard/calendar' },
    ];
  }
  return [
    { icon: <Users size={24} />, value: String(students.length), label: 'Active Students', to: '/dashboard/students' },
    { icon: <BookOpen size={24} />, value: String(resourcesCount), label: 'Resources Shared', to: '/dashboard/shared-drive' },
    { icon: <Calendar size={24} />, value: String(upcomingCount), label: 'Upcoming Sessions', to: '/dashboard/calendar' },
    { icon: <Clock size={24} />, value: String(sessionHours), label: 'Session Hours', to: '/dashboard/calendar' },
  ];
}

async function getCustomerStats(): Promise<StatItem[]> {
  const bookings = await getMyBookingsAsCustomer();
  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.session_date) >= now && b.status !== 'cancelled').length;
  const completed = bookings.filter((b) => b.status === 'completed').length;
  const [{ count: resourcesCount }, streak] = await Promise.all([
    supabase.from('shared_files').select('*', { count: 'exact', head: true }).in('visibility', ['public', 'students_only']),
    getLearningStreak(),
  ]);

  return [
    { icon: <BookOpen size={24} />, value: String(resourcesCount ?? 0), label: 'Resources Available', to: '/dashboard/shared-drive' },
    { icon: <Calendar size={24} />, value: String(upcoming), label: 'Upcoming Sessions', to: '/dashboard/bookings' },
    { icon: <Target size={24} />, value: String(streak), label: 'Learning Streak', to: '/dashboard/learning-zone' },
    { icon: <Trophy size={24} />, value: String(completed), label: 'Completed Sessions', to: '/dashboard/learning-zone' },
  ];
}

function getQuickActionsForRole(role: UserRole): QuickAction[] {
  if (role === 'tutor') {
    return [
      { icon: <UploadCloud size={24} />, label: 'Upload Resources', description: 'Share notes, past papers, or course material', to: '/dashboard/resources' },
      { icon: <HardDrive size={24} />, label: 'SharedDrive', description: 'Browse & share collaborative resources', to: '/dashboard/shared-drive' },
      { icon: <Users size={24} />, label: 'My Students', description: 'View and manage your students', to: '/dashboard/students' },
      { icon: <Sparkles size={24} />, label: 'AI Insights', description: 'Summarise files & extract insights', to: '/dashboard/ai-insights' },
    ];
  }
  if (role === 'coach') {
    return [
      { icon: <UploadCloud size={24} />, label: 'Upload Resources', description: 'Share coaching materials & recordings', to: '/dashboard/resources' },
      { icon: <HardDrive size={24} />, label: 'SharedDrive', description: 'Browse & share collaborative resources', to: '/dashboard/shared-drive' },
      { icon: <Users size={24} />, label: 'My Clients', description: 'View and manage your coaching clients', to: '/dashboard/students' },
      { icon: <Sparkles size={24} />, label: 'AI Insights', description: 'Summarise files & extract insights', to: '/dashboard/ai-insights' },
    ];
  }
  if (role === 'admin') {
    return [
      { icon: <ClipboardCheck size={24} />, label: 'Review Applications', description: 'Approve or decline pending professional applications', to: '/dashboard/admin/applications' },
      { icon: <Users size={24} />, label: 'Manage Accounts', description: 'Suspend, block, reactivate, or deactivate accounts', to: '/dashboard/admin/accounts' },
    ];
  }
  // Student
  return [
    { icon: <HardDrive size={24} />, label: 'SharedDrive', description: 'Access resources from your tutors & coaches', to: '/dashboard/shared-drive' },
    { icon: <Target size={24} />, label: 'Learning Zone', description: 'Plan your year, log results, submit work', to: '/dashboard/learning-zone' },
    { icon: <Sparkles size={24} />, label: 'AI Insights', description: 'Get summaries & insights from your materials', to: '/dashboard/ai-insights' },
    { icon: <User size={24} />, label: 'My Profile', description: 'Update your profile & preferences', to: '/dashboard/profile' },
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
  if (role === 'admin') {
    return {
      title: `Welcome back, ${name} 🛡️`,
      subtitle: 'Review professional applications and oversee platform accounts.',
    };
  }
  return {
    title: `Hey ${name}! 👋`,
    subtitle: 'Access your learning resources, track your sessions, and explore AI-powered study tools.',
  };
}

const ACTIVITY_COPY: Record<string, { icon: string; label: (name: string, role: UserRole) => string }> = {
  approved: { icon: '✅', label: (name, role) => `Approved ${name}'s ${role === 'customer' ? 'account' : 'application'}` },
  declined: { icon: '❌', label: (name) => `Declined ${name}'s application` },
  suspended: { icon: '⏸️', label: (name) => `Suspended ${name}'s account` },
  blocked: { icon: '🚫', label: (name) => `Blocked ${name}'s account` },
  deleted: { icon: '🗑️', label: (name) => `Deactivated ${name}'s account` },
};

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function DashboardHome() {
  const navigate = useNavigate();
  const { profile, isParentMode } = useAuth();
  const role = profile?.role ?? 'customer';
  const zone = role === 'tutor' ? 'tutor' : role === 'coach' ? 'coach' : role === 'admin' ? 'admin' : 'student';
  const firstName = profile?.first_name ?? 'there';

  const [adminStats, setAdminStats] = useState<StatItem[] | null>(null);
  const [recentActivity, setRecentActivity] = useState<AdminActivityItem[] | null>(null);
  const [liveStats, setLiveStats] = useState<StatItem[] | null>(null);
  const [recentNotifications, setRecentNotifications] = useState<Notification[] | null>(null);

  useEffect(() => {
    if (role !== 'admin') return;
    let cancelled = false;

    getAdminDashboardStats().then((s) => {
      if (cancelled) return;
      setAdminStats([
        { icon: <ClipboardCheck size={24} />, value: String(s.pendingApplications), label: 'Pending Applications', to: '/dashboard/admin/applications' },
        { icon: <Users size={24} />, value: String(s.totalAccounts), label: 'Total Accounts', to: '/dashboard/admin/accounts' },
        { icon: <Users size={24} />, value: String(s.approvedProfessionals), label: 'Approved Professionals', to: '/dashboard/admin/accounts' },
        { icon: <Users size={24} />, value: String(s.suspendedOrBlocked), label: 'Suspended / Blocked', to: '/dashboard/admin/accounts' },
      ]);
    });

    getRecentAdminActivity().then((items) => {
      if (!cancelled) setRecentActivity(items);
    });

    return () => { cancelled = true; };
  }, [role]);

  useEffect(() => {
    if (role === 'admin' || !profile) return;
    let cancelled = false;

    const statsPromise = role === 'tutor' || role === 'coach'
      ? getProviderStats(profile.id, role)
      : getCustomerStats();

    statsPromise.then((s) => { if (!cancelled) setLiveStats(s); }).catch(() => {});
    getNotifications().then((n) => { if (!cancelled) setRecentNotifications(n.slice(0, 8)); }).catch(() => {});

    return () => { cancelled = true; };
  }, [role, profile]);

  const stats = role === 'admin' ? (adminStats ?? getStatsForRole(role)) : (liveStats ?? getStatsForRole(role));
  const quickActions = getQuickActionsForRole(role);
  const welcome = getWelcomeMessage(role, firstName, isParentMode);

  return (
    <div className="animate-slide-up">
      {role !== 'admin' && <SessionCompletionPrompt />}
      {/* Welcome Header */}
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">{welcome.title}</h1>
        <p className="dashboard-page-subtitle">{welcome.subtitle}</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        {stats.map((stat, i) => (
          <div
            className="stat-card"
            key={i}
            role={stat.to ? 'button' : undefined}
            tabIndex={stat.to ? 0 : undefined}
            onClick={stat.to ? () => navigate(stat.to!) : undefined}
            onKeyDown={stat.to ? (e) => { if (e.key === 'Enter') navigate(stat.to!); } : undefined}
            style={stat.to ? { cursor: 'pointer' } : undefined}
          >
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
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: `var(--zone-${zone})` }}>{action.icon}</span>
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

      {/* Recent Activity */}
      <div className="content-panel">
        <div className="content-panel-header">
          <h3 className="content-panel-title">Recent Activity</h3>
        </div>
        <div className="content-panel-body">
          {role === 'admin' ? (
            !recentActivity || recentActivity.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-title">No recent activity</div>
                <div className="empty-state-text">
                  Applications and accounts you approve, decline, or manage will appear here.
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {recentActivity.map((item) => {
                  const copy = ACTIVITY_COPY[item.status];
                  return (
                    <div
                      key={`${item.id}-${item.reviewed_at}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)' }}
                    >
                      <span style={{ fontSize: '1.25rem' }}>{copy?.icon ?? '•'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.88rem' }}>
                          {copy ? copy.label(`${item.first_name} ${item.last_name}`, item.role) : `Updated ${item.first_name} ${item.last_name}`}
                        </div>
                        {item.status_reason && (
                          <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{item.status_reason}</div>
                        )}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                        {formatRelativeTime(item.reviewed_at)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : !recentNotifications || recentNotifications.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">No recent activity</div>
              <div className="empty-state-text">
                Your latest uploads, sessions, and resource interactions will appear here.
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {recentNotifications.map((n) => (
                <a
                  key={n.id}
                  href={n.link ?? '#'}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 0.25rem', borderBottom: '1px solid rgba(0,0,0,0.06)', textDecoration: 'none', color: 'inherit' }}
                >
                  <span style={{ fontSize: '1.25rem' }}>{n.is_read ? '•' : '🔔'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: n.is_read ? 400 : 600 }}>{n.title}</div>
                    {n.body && <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>{n.body}</div>}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap' }}>
                    {formatRelativeTime(n.created_at)}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
