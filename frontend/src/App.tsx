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
import './index.css';

// Placeholder Components
const Directory = () => <div className="container" style={{ paddingTop: '4rem' }}><h2>Directory (Coming Soon)</h2></div>;
const VettingApplication = () => <div className="container" style={{ paddingTop: '4rem' }}><h2>Tutor/Coach Application (Coming Soon)</h2></div>;

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
          <Route path="/login" element={<PublicLayout><Login /></PublicLayout>} />
          <Route path="/register" element={<PublicLayout><Register /></PublicLayout>} />
          <Route path="/vetting-application" element={<PublicLayout><VettingApplication /></PublicLayout>} />

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
            <Route path="ai-insights" element={<AIInsights />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
