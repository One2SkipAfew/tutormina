import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
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
import DashboardLayout from './components/layouts/DashboardLayout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import DashboardHome from './pages/dashboard/DashboardHome';
import ProfileEditor from './pages/dashboard/ProfileEditor';
import SharedDrive from './pages/dashboard/SharedDrive';
import ResourceManager from './pages/dashboard/ResourceManager';
import MyStudents from './pages/dashboard/MyStudents';
import AIInsights from './pages/dashboard/AIInsights';
import Messages from './pages/dashboard/Messages';
import ProfileVisits from './pages/dashboard/ProfileVisits';
import VettingApplication from './pages/VettingApplication';
import ApplicationStatus from './pages/ApplicationStatus';
import AdminApplications from './pages/dashboard/admin/Applications';
import AdminAccounts from './pages/dashboard/admin/Accounts';
import AdminSetup from './pages/AdminSetup';
import AdminLogin from './pages/AdminLogin';
import Directory from './pages/Directory';
import DirectoryProfile from './pages/DirectoryProfile';
import ProviderCalendar from './pages/dashboard/ProviderCalendar';
import MyBookings from './pages/dashboard/MyBookings';
import LearningZone from './pages/dashboard/LearningZone';
import LiveSession from './pages/dashboard/LiveSession';
import SessionRecordings from './pages/dashboard/SessionRecordings';
import VideoRoom from './pages/dashboard/VideoRoom';
import './index.css';

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
      </Router>
      </NotificationProvider>
    </AuthProvider>
  );
}

export default App;
