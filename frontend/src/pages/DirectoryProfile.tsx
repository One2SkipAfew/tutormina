import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import type { Profile, ProviderDetails, WorkExperience } from '../types/lms';
import { formatRate } from '../types/lms';
import { getWorkExperiences } from '../lib/vetting';
import BookingCalendarModal from '../components/directory/BookingCalendarModal';
import { useAuth } from '../contexts/AuthContext';

interface FullProfile extends Profile {
  provider_details: ProviderDetails;
}

export default function DirectoryProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session } = useAuth();
  const [profile, setProfile] = useState<FullProfile | null>(null);
  const [workExperiences, setWorkExperiences] = useState<WorkExperience[]>([]);
  const [referenceCount, setReferenceCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    async function fetchProfile() {
      if (!id) return;
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*, provider_details(*)')
        .eq('id', id)
        .single();

      if (data && data.provider_details) {
        setProfile(data as FullProfile);
        const [we, { data: refCount }] = await Promise.all([
          getWorkExperiences(id),
          supabase.rpc('get_reference_count', { target_profile_id: id }),
        ]);
        setWorkExperiences(we);
        setReferenceCount(refCount ?? 0);
      }
      setLoading(false);
    }
    fetchProfile();
  }, [id]);

  if (loading) {
    return <div style={{ padding: '4rem', textAlign: 'center' }}>Loading profile...</div>;
  }

  if (!profile) {
    return (
      <div style={{ padding: '4rem', textAlign: 'center' }}>
        <h2>Profile not found.</h2>
        <button className="btn btn-primary" onClick={() => navigate('/directory')}>Return to Directory</button>
      </div>
    );
  }

  const details = profile.provider_details;

  const handleBookClick = () => {
    if (!session) {
      setShowAuthPrompt(true);
    } else {
      setShowBookingModal(true);
    }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: 'calc(100vh - 64px)', padding: '3rem 0' }}>
      <div className="container" style={{ maxWidth: '800px' }}>
        <button 
          className="btn btn-outline" 
          onClick={() => navigate('/directory')}
          style={{ marginBottom: '2rem' }}
        >
          &larr; Back to Directory
        </button>

        <div className="glass-card" style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
          {/* Left Col: Avatar & Actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '250px', flexShrink: 0 }}>
            <div style={{
              width: '150px',
              height: '150px',
              borderRadius: '50%',
              background: '#f0f2f5',
              marginBottom: '1rem',
              backgroundImage: details.avatar_url ? `url(${details.avatar_url})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              border: '4px solid #fff',
              boxShadow: 'var(--shadow-md)'
            }} />
            
            <h1 style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem' }}>
              {profile.first_name} {profile.last_name}
            </h1>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '0.5rem' }}>
              {profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}
            </p>

            {details.rate_visible && details.rate_amount != null && (
              <p style={{ fontWeight: 700, fontSize: '1.15rem', color: 'var(--color-primary-dark)', marginBottom: '1rem' }}>
                {formatRate(details.rate_amount, details.rate_currency)}
              </p>
            )}

            <button
              className="btn btn-primary" 
              style={{ width: '100%', marginBottom: '1rem' }}
              onClick={handleBookClick}
            >
              Book Session
            </button>
          </div>

          {/* Right Col: Details */}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '2rem', marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '1px solid #e2e8f0' }}>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                  ★ {details.rating?.toFixed(1) || '0.0'}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>{details.review_count || 0} Reviews</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                  {details.years_of_experience || 0}+
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Years Exp</div>
              </div>
              <div>
                <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--color-primary-dark)' }}>
                  {details.completed_sessions || 0}
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>Sessions</div>
              </div>
            </div>

            <h3 style={{ marginBottom: '1rem' }}>About Me</h3>
            <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: '2rem' }}>
              {details.bio || "No bio provided."}
            </p>

            {details.qualifications && (
              <>
                <h3 style={{ marginBottom: '1rem' }}>Qualifications</h3>
                <p style={{ color: '#475569', lineHeight: 1.7, marginBottom: '2rem' }}>
                  {details.qualifications}
                </p>
              </>
            )}

            <h3 style={{ marginBottom: '1rem' }}>Specialties</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {details.specialties?.map(s => (
                <span key={s} style={{ padding: '0.4rem 0.8rem', background: '#f1f5f9', borderRadius: '20px', fontSize: '0.9rem' }}>
                  {s}
                </span>
              ))}
            </div>

            {workExperiences.length > 0 && (
              <>
                <h3 style={{ margin: '2rem 0 1rem' }}>Work History</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {workExperiences.map((we) => (
                    <div key={we.id}>
                      <strong>{we.title}</strong> at {we.company}
                      <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
                        {we.start_date ?? '—'} to {we.end_date ?? 'Present'}
                      </div>
                      {we.description && <p style={{ color: '#475569', marginTop: '0.25rem' }}>{we.description}</p>}
                    </div>
                  ))}
                </div>
              </>
            )}

            {referenceCount > 0 && (
              <p style={{ marginTop: '1.5rem', color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
                ✓ {referenceCount} professional reference{referenceCount === 1 ? '' : 's'} verified during onboarding
              </p>
            )}
          </div>
        </div>
      </div>

      {showBookingModal && (
        <BookingCalendarModal provider={profile} onClose={() => setShowBookingModal(false)} />
      )}

      {/* Auth Prompt Modal */}
      {showAuthPrompt && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '1rem'
        }}>
          <div className="animate-slide-up glass-card" style={{ background: '#fff', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '1rem', color: 'var(--color-primary-dark)' }}>Authentication Required</h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
              Please log in or register an account to book a session with {profile.first_name}.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <button 
                className="btn btn-primary" 
                onClick={() => window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`}
              >
                Log In
              </button>
              <button 
                className="btn btn-outline" 
                onClick={() => window.location.href = `/register?redirect=${encodeURIComponent(window.location.pathname)}`}
              >
                Register
              </button>
              <button 
                style={{ background: 'none', border: 'none', color: '#94a3b8', marginTop: '0.5rem', cursor: 'pointer' }}
                onClick={() => setShowAuthPrompt(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
