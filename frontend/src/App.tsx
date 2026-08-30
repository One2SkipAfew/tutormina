import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, lazy, Suspense } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { NotificationProvider } from './contexts/NotificationContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Contact from './pages/Contact';
import Terms from './pages/Terms';
import Privacy from './pages/Privacy';
import ProtectedRoute from './components/shared/ProtectedRoute';
import Directory from './pages/Directory';
import DirectoryProfile from './pages/DirectoryProfile';
import './index.css';

// The dashboard is a large, authenticated-only surface. Splitting it out keeps it off the
// critical path for the public pages, which is what most first-time (and mobile) visitors load.
const DashboardLayout = lazy(() => import('./components/layouts/DashboardLayout'));
const DashboardHome = lazy(() => import('./pages/dashboard/DashboardHome'));
const ProfileEditor = lazy(() => import('./pages/dashboard/ProfileEditor'));
const SharedDrive = lazy(() => import('./pages/dashboard/SharedDrive'));
const ResourceManager = lazy(() => import('./pages/dashboard/ResourceManager'));
const MyStudents = lazy(() => import('./pages/dashboard/MyStudents'));
const AIInsights = lazy(() => import('./pages/dashboard/AIInsights'));
const Messages = lazy(() => import('./pages/dashboard/Messages'));
const ProfileVisits = lazy(() => import('./pages/dashboard/ProfileVisits'));
const VettingApplication = lazy(() => import('./pages/VettingApplication'));
const ApplicationStatus = lazy(() => import('./pages/ApplicationStatus'));
const AdminApplications = lazy(() => import('./pages/dashboard/admin/Applications'));
const AdminAccounts = lazy(() => import('./pages/dashboard/admin/Accounts'));
const AdminSetup = lazy(() => import('./pages/AdminSetup'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const ProviderCalendar = lazy(() => import('./pages/dashboard/ProviderCalendar'));
const MyBookings = lazy(() => import('./pages/dashboard/MyBookings'));
const LearningZone = lazy(() => import('./pages/dashboard/LearningZone'));
const LiveSession = lazy(() => import('./pages/dashboard/LiveSession'));
const SessionRecordings = lazy(() => import('./pages/dashboard/SessionRecordings'));
const VideoRoom = lazy(() => import('./pages/dashboard/VideoRoom'));

function RouteFallback() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '50vh', gap: '0.75rem', color: 'var(--color-text-muted)' }}>
      <div className="spinner" />
      <span>Loading…</span>
    </div>
  );
}

function PublicNav() {
  const { session, signOut } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  return (
    <nav className="public-nav">
      <div className="container public-nav-inner">
        <a href="/" className="public-nav-logo">
          <img src="/logo.png" alt="TutorMina Logo" />
          TutorMina
        </a>
        <button
          className="public-nav-toggle"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle navigation menu"
        >
          {mobileMenuOpen ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
        <div className={`public-nav-links ${mobileMenuOpen ? 'open' : ''}`}>
          <a href="/directory" onClick={() => setMobileMenuOpen(false)}>Directory</a>
          {session ? (
            <>
              <a href="/dashboard" onClick={() => setMobileMenuOpen(false)}>Dashboard</a>
              <button onClick={() => { signOut(); setMobileMenuOpen(false); }} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>Log Out</button>
            </>
          ) : (
            <>
              <a href="/login" onClick={() => setMobileMenuOpen(false)}>Login</a>
              <a href="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }} onClick={() => setMobileMenuOpen(false)}>Get Started</a>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-wrapper">
      <PublicNav />
      <main>{children}</main>
      <footer className="site-footer" style={{ padding: '2rem 0', background: 'var(--color-olive-dark)', color: '#e0e0e0' }}>
        <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <p style={{ fontWeight: 600, fontSize: '1.2rem', color: '#fff', margin: 0 }}>TutorMina</p>
          <div className="footer-links">
            <a href="/terms">Terms &amp; Conditions</a>
            <a href="/privacy">Privacy Policy</a>
            <a href="/contact">Contact Us</a>
          </div>
          <p style={{ fontSize: '0.85rem', margin: 0, opacity: 0.8 }}>
            &copy; {new Date().getFullYear()} <a href="https://fromb2c.africa" target="_blank" rel="noopener noreferrer" style={{ color: '#fff', textDecoration: 'underline' }}>From B 2 C</a>. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
      <Router>
        <Suspense fallback={<RouteFallback />}>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/directory" element={<PublicLayout><Directory /></PublicLayout>} />
          <Route path="/directory/:id" element={<PublicLayout><DirectoryProfile /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
          <Route path="/forgot-password" element={<PublicLayout><ForgotPassword /></PublicLayout>} />
          <Route path="/reset-password" element={<PublicLayout><ResetPassword /></PublicLayout>} />
          <Route path="/contact" element={<PublicLayout><Contact /></PublicLayout>} />
          <Route path="/terms" element={<PublicLayout><Terms /></PublicLayout>} />
          <Route path="/privacy" element={<PublicLayout><Privacy /></PublicLayout>} />

          {/* Hidden admin routes - not linked anywhere in public nav */}
          <Route path="/admin-setup" element={<PublicLayout><AdminSetup /></PublicLayout>} />
          <Route path="/admin-login" element={<PublicLayout><AdminLogin /></PublicLayout>} />
          <Route path="/vetting-application" element={
            <ProtectedRoute>
              <PublicLayout><VettingApplication /></PublicLayout>
            </ProtectedRoute>
          } />
          <Route path="/application-status" element={
            <ProtectedRoute>
              <PublicLayout><ApplicationStatus /></PublicLayout>
            </ProtectedRoute>
          } />

          {/* Dashboard (Protected + Sidebar Layout) */}
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardHome />} />
            <Route path="profile" element={<ProfileEditor />} />
            <Route path="messages" element={<Messages />} />
            <Route path="shared-drive" element={<SharedDrive />} />
            <Route path="resources" element={
              <ProtectedRoute allowedRoles={['tutor', 'coach', 'admin']}>
                <ResourceManager />
              </ProtectedRoute>
            } />
            <Route path="students" element={
              <ProtectedRoute allowedRoles={['tutor', 'coach', 'admin']}>
                <MyStudents />
              </ProtectedRoute>
            } />
            <Route path="calendar" element={
              <ProtectedRoute allowedRoles={['tutor', 'coach', 'admin']}>
                <ProviderCalendar />
              </ProtectedRoute>
            } />
            <Route path="profile-visits" element={
              <ProtectedRoute allowedRoles={['tutor', 'coach']}>
                <ProfileVisits />
              </ProtectedRoute>
            } />
            <Route path="bookings" element={<MyBookings />} />
            <Route path="learning-zone" element={
              <ProtectedRoute allowedRoles={['customer']}>
                <LearningZone />
              </ProtectedRoute>
            } />
            <Route path="ai-insights" element={<AIInsights />} />
            <Route path="live-session" element={<LiveSession />} />
            <Route path="live-session/:bookingId" element={<LiveSession />} />
            <Route path="session-recordings" element={<SessionRecordings />} />
            <Route path="video-room/:roomId" element={<VideoRoom />} />
            <Route path="admin/applications" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminApplications />
              </ProtectedRoute>
            } />
            <Route path="admin/accounts" element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminAccounts />
              </ProtectedRoute>
            } />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
