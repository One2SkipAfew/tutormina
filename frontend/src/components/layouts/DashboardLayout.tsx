import { useState, useMemo } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { getZoneColor, getZoneLabel, getRoleDisplayName } from '../../types/lms';
import NotificationBell from '../shared/NotificationBell';
import '../../styles/dashboard.css';

// SVG Icons as inline components
const Icons = {
  Home: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  ),
  User: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
    </svg>
  ),
  Folder: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  ),
  Drive: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22 6 12 13 2 6" />
    </svg>
  ),
  Users: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  BarChart: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  Bell: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  Search: () => (
    <svg className="topbar-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
  Menu: () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  ),
  LogOut: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
  Sparkles: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3l1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3z" />
      <path d="M19 14l.9 2.7L22.6 17.6l-2.7.9L19 21.2l-.9-2.7-2.7-.9 2.7-.9L19 14z" />
    </svg>
  ),
  MessageCircle: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  Calendar: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  Radio: () => (
    <svg className="sidebar-nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="2" /><path d="M16.24 7.76a6 6 0 0 1 0 8.49" /><path d="M7.76 16.24a6 6 0 0 1 0-8.49" /><path d="M19.07 4.93a10 10 0 0 1 0 14.14" /><path d="M4.93 19.07a10 10 0 0 1 0-14.14" />
    </svg>
  ),
};

interface NavItem {
  to: string;
  label: string;
  icon: React.FC;
}

export default function DashboardLayout() {
  const { profile, providerDetails, signOut, isParentMode, toggleParentMode } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const role = profile?.role ?? 'customer';
  const zone = getZoneColor(role);
  const zoneLabel = getZoneLabel(role);

  const navItems: NavItem[] = useMemo(() => {
    const common: NavItem[] = [
      { to: '/dashboard', label: 'Overview', icon: Icons.Home },
      { to: '/dashboard/profile', label: 'My Profile', icon: Icons.User },
      { to: '/dashboard/messages', label: 'Messages', icon: Icons.MessageCircle },
      { to: '/dashboard/shared-drive', label: 'SharedDrive', icon: Icons.Drive },
    ];

    if (role === 'admin') {
      return [
        { to: '/dashboard', label: 'Overview', icon: Icons.Home },
        { to: '/dashboard/admin/applications', label: 'Applications', icon: Icons.Folder },
        { to: '/dashboard/admin/accounts', label: 'Accounts', icon: Icons.Users },
      ];
    }

    if (role === 'tutor' || role === 'coach') {
      return [
        ...common,
        { to: '/dashboard/resources', label: 'My Resources', icon: Icons.Folder },
        { to: '/dashboard/students', label: 'My Students', icon: Icons.Users },
        { to: '/dashboard/calendar', label: 'My Calendar', icon: Icons.Calendar },
        { to: '/dashboard/live-session', label: 'Live Session', icon: Icons.Radio },
        { to: '/dashboard/ai-insights', label: 'AI Insights', icon: Icons.Sparkles },
      ];
    }

    // Student/Customer
    return [
      ...common,
      { to: '/dashboard/bookings', label: 'My Bookings', icon: Icons.Calendar },
      { to: '/dashboard/live-session', label: 'Live Session', icon: Icons.Radio },
      { to: '/dashboard/learning-zone', label: 'Learning Zone', icon: Icons.BarChart },
      { to: '/dashboard/ai-insights', label: 'AI Insights', icon: Icons.Sparkles },
    ];
  }, [role]);

  const currentPageTitle = useMemo(() => {
    const path = location.pathname;
    const item = navItems.find(n => n.to === path);
    return item?.label ?? 'Dashboard';
  }, [location.pathname, navItems]);

  const userInitials = profile
    ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()
    : '?';

  const handleCloseMobile = () => setMobileOpen(false);

  return (
    <div className={`dashboard-shell zone-${zone}`}>
      {/* Mobile Overlay */}
      <div
        className={`sidebar-overlay ${mobileOpen ? 'visible' : ''}`}
        onClick={handleCloseMobile}
      />

      {/* Sidebar */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        {/* Toggle */}
        <button
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed(prev => !prev)}
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <Icons.ChevronRight /> : <Icons.ChevronLeft />}
        </button>

        {/* Header */}
        <div className="sidebar-header">
          <img src="/logo.png" alt="TutorMina" className="sidebar-logo" />
          <span className="sidebar-brand">TutorMina</span>
        </div>

        {/* Zone Badge */}
        <div className={`sidebar-zone-badge ${zone}`}>
          {zoneLabel}
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="sidebar-nav-section">
            <span className="sidebar-nav-section-title">Main</span>
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
                data-zone={zone}
                onClick={handleCloseMobile}
              >
                <item.icon />
                <span className="sidebar-nav-label">{item.label}</span>
              </NavLink>
            ))}
          </div>

          {/* Parent mode toggle — only for students/customers */}
          {role === 'customer' && (
            <div className="sidebar-nav-section">
              <span className="sidebar-nav-section-title">View</span>
              <div
                className={`parent-mode-toggle ${isParentMode ? 'active' : ''}`}
                onClick={toggleParentMode}
                style={{ margin: '0.25rem 1rem' }}
              >
                <span>👨‍👩‍👧 Parent Mode</span>
                <div className="parent-mode-toggle-switch" />
              </div>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div
              className={`sidebar-user-avatar ${zone}`}
              style={(providerDetails?.avatar_url ?? profile?.avatar_url) ? {
                backgroundImage: `url(${providerDetails?.avatar_url ?? profile?.avatar_url})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              } : undefined}
            >
              {!(providerDetails?.avatar_url ?? profile?.avatar_url) && userInitials}
            </div>
            <div className="sidebar-user-info">
              <div className="sidebar-user-name">
                {profile?.first_name} {profile?.last_name}
              </div>
              <div className="sidebar-user-role">
                {getRoleDisplayName(role)}
              </div>
            </div>
          </div>
          <button
            className="sidebar-nav-item"
            onClick={signOut}
            style={{ marginTop: '0.5rem', width: '100%', border: 'none', background: 'none' }}
          >
            <Icons.LogOut />
            <span className="sidebar-nav-label">Log Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className={`dashboard-main ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
        {/* Top Bar */}
        <header className="dashboard-topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Icons.Menu />
            </button>
            <div className="topbar-breadcrumb">
              <span>{zoneLabel}</span>
              <span className="topbar-breadcrumb-separator">/</span>
              <span className="topbar-breadcrumb-current">{currentPageTitle}</span>
            </div>
          </div>
          <div className="topbar-right">
            <div className="topbar-search">
              <Icons.Search />
              <input type="text" placeholder="Search..." />
            </div>
            <NotificationBell />
          </div>
        </header>

        {/* Page Content */}
        <div className="dashboard-content animate-slide-up">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
