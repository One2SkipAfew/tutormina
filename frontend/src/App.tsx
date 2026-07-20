import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import DashboardLayout from './components/layouts/DashboardLayout';
import ProtectedRoute from './components/shared/ProtectedRoute';
import DashboardHome from './pages/dashboard/DashboardHome';
import ProfileEditor from './pages/dashboard/ProfileEditor';
import SharedDrive from './pages/dashboard/SharedDrive';
import ResourceManager from './pages/dashboard/ResourceManager';
import MyStudents from './pages/dashboard/MyStudents';
import AIInsights from './pages/dashboard/AIInsights';
import Messages from './pages/dashboard/Messages';
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
import VideoRoom from './pages/dashboard/VideoRoom';
import './index.css';

function PublicNav() {
  const { session, signOut } = useAuth();
  return (
    <nav style={{
      padding: '1rem 0',
      background: 'rgba(255, 255, 255, 0.9)',
      backdropFilter: 'blur(10px)',
      borderBottom: '1px solid var(--color-gray-warm)',
      position: 'sticky',
      top: 0,
      zIndex: 50
    }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--color-spring-dark)', textDecoration: 'none' }}>
          <img src="/logo.png" alt="TutorMina Logo" style={{ height: '32px' }} />
          TutorMina
        </a>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <a href="/directory" style={{ fontWeight: 500, textDecoration: 'none', color: 'inherit' }}>Directory</a>
          {session ? (
            <>
              <a href="/dashboard" style={{ fontWeight: 500, textDecoration: 'none', color: 'inherit' }}>Dashboard</a>
              <button onClick={signOut} className="btn btn-outline" style={{ padding: '0.5rem 1rem' }}>Log Out</button>
            </>
          ) : (
            <>
              <a href="/login" style={{ fontWeight: 500, textDecoration: 'none', color: 'inherit' }}>Login</a>
              <a href="/register" className="btn btn-primary" style={{ padding: '0.5rem 1rem', textDecoration: 'none' }}>Get Started</a>
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
      <footer className="site-footer">
        <div className="container">
          <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>TutorMina</p>
          <p style={{ fontSize: '0.9rem', color: '#e0e0e0' }}>&copy; {new Date().getFullYear()} From B2C. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Pages */}
          <Route path="/" element={<PublicLayout><Home /></PublicLayout>} />
          <Route path="/directory" element={<PublicLayout><Directory /></PublicLayout>} />
          <Route path="/directory/:id" element={<PublicLayout><DirectoryProfile /></PublicLayout>} />
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />

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
            <Route path="bookings" element={<MyBookings />} />
            <Route path="learning-zone" element={
              <ProtectedRoute allowedRoles={['customer']}>
                <LearningZone />
              </ProtectedRoute>
            } />
            <Route path="ai-insights" element={<AIInsights />} />
            <Route path="live-session" element={<LiveSession />} />
            <Route path="live-session/:bookingId" element={<LiveSession />} />
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
    </AuthProvider>
  );
}

export default App;
