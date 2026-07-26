import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const STATUS_COPY: Record<string, { title: string; tone: string }> = {
  approved: { title: '🎉 Congratulations! Your application is approved.', tone: '#2e7d32' },
  pending: { title: 'Your application is under review', tone: '#1565C0' },
  declined: { title: 'Your application was declined', tone: '#c62828' },
  suspended: { title: 'Your account has been suspended', tone: '#e65100' },
  blocked: { title: 'Your account has been blocked', tone: '#c62828' },
  deleted: { title: 'Your account has been deactivated', tone: '#c62828' },
};

export default function ApplicationStatus() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (profile?.status === 'approved' && (profile.role === 'tutor' || profile.role === 'coach')) {
      localStorage.setItem(`welcome_seen_${profile.id}`, 'true');
    }
  }, [profile]);

  if (!profile) return null;

  const copy = STATUS_COPY[profile.status] ?? { title: 'Account status', tone: 'var(--color-text-main)' };
  const canReapply = profile.status === 'declined' && (profile.role === 'tutor' || profile.role === 'coach');
  const isApproved = profile.status === 'approved' && (profile.role === 'tutor' || profile.role === 'coach');

  return (
    <div className="container animate-fade-in" style={{ paddingTop: '4rem', maxWidth: '560px' }}>
      <div className="glass-card">
        <h2 style={{ textAlign: 'center', marginBottom: '1rem', color: copy.tone }}>
          {copy.title}
        </h2>

        {isApproved && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
            Welcome to the TutorMina family! You're now listed in our professional directory and students can start booking sessions with you.
          </p>
        )}

        {profile.status === 'pending' && (
          <p style={{ textAlign: 'center', color: 'var(--color-text-muted)' }}>
            Thanks for applying to join TutorMina as a {profile.role}. Our team is reviewing your
            application and will let you know as soon as a decision is made.
          </p>
        )}

        {profile.status_reason && profile.status !== 'pending' && !isApproved && (
          <div style={{
            backgroundColor: '#f5f5f5',
            padding: '1rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
          }}>
            <strong>Reason given:</strong>
            <p style={{ margin: '0.5rem 0 0' }}>{profile.status_reason}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '2rem', flexWrap: 'wrap' }}>
          {isApproved && (
            <>
              <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>
                Go to Dashboard
              </button>
              <button className="btn btn-outline" onClick={() => navigate(`/directory/${profile.id}`)}>
                View My Directory Profile
              </button>
            </>
          )}
          {canReapply && (
            <button className="btn btn-primary" onClick={() => navigate('/vetting-application')}>
              Update &amp; resubmit application
            </button>
          )}
          {!isApproved && (
            <button className="btn btn-outline" onClick={signOut}>Log Out</button>
          )}
        </div>
      </div>
    </div>
  );
}
