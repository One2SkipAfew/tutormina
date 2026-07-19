import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import type { UserRole } from '../../types/lms';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}

const STATUS_GATE_EXEMPT_PATHS = ['/vetting-application', '/application-status'];

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, providerDetails, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-background)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="loading-spinner" style={{
            width: 40,
            height: 40,
            border: '3px solid rgba(0,0,0,0.1)',
            borderTopColor: 'var(--color-spring-dark)',
            borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile && !STATUS_GATE_EXEMPT_PATHS.includes(location.pathname)) {
    if (profile.status !== 'approved') {
      const isUnsubmittedApplication =
        (profile.role === 'tutor' || profile.role === 'coach') &&
        profile.status === 'pending' &&
        !providerDetails?.application_submitted_at;

      return <Navigate to={isUnsubmittedApplication ? '/vetting-application' : '/application-status'} replace />;
    }
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
