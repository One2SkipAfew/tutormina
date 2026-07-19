import { getRoleDisplayName, formatRate } from '../../types/lms';
import type { Profile, ProviderDetails } from '../../types/lms';

interface ProviderTileProps {
  profile: Profile;
  details: ProviderDetails;
  onBook: () => void;
}

export default function ProviderTile({ profile, details, onBook }: ProviderTileProps) {
  const roleName = getRoleDisplayName(profile.role);
  const fullName = `${profile.first_name} ${profile.last_name}`;
  
  // Format subtitle based on role specific details
  let subtitle = roleName;
  if (profile.role === 'tutor' && details.tutor_level) {
    const levelStr = details.tutor_level.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    subtitle = `${levelStr} ${roleName}`;
  } else if (profile.role === 'coach' && details.coach_type) {
    const typeStr = details.coach_type.charAt(0).toUpperCase() + details.coach_type.slice(1);
    subtitle = `${typeStr} ${roleName}`;
  }

  // Badges (Location/Type)
  const locationBadges = [];
  if (details.offers_in_person) locationBadges.push('📍 In-Person');
  if (details.offers_virtual) locationBadges.push('💻 Virtual');

  // Stats
  const rating = details.rating || 0;
  const reviewCount = details.review_count || 0;
  const experience = details.years_of_experience;
  const sessionsCompleted = details.completed_sessions || 0;

  // Specialties
  const specialties = details.specialties || [];

  return (
    <div style={{
      background: '#fff',
      borderRadius: '12px',
      padding: '2rem 1.5rem',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      border: '1px solid rgba(0,0,0,0.05)',
      transition: 'transform 0.2s',
      height: '100%',
    }}>
      {/* Avatar */}
      <div style={{
        width: '90px',
        height: '90px',
        borderRadius: '50%',
        background: '#f0f2f5',
        marginBottom: '1rem',
        backgroundImage: details.avatar_url ? `url(${details.avatar_url})` : 'none',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '1.5rem',
        fontWeight: 700,
        color: '#8b9bb4',
        border: '3px solid #fff',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)'
      }}>
        {!details.avatar_url && `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase()}
      </div>

      {/* Name & Subtitle */}
      <h3 style={{
        margin: '0 0 0.25rem 0',
        fontSize: '1.25rem',
        fontWeight: 800,
        color: 'var(--color-primary-dark)',
      }}>
        {fullName}
      </h3>
      <p style={{
        margin: '0 0 0.75rem 0',
        fontSize: '0.9rem',
        color: 'var(--color-text-muted)',
        fontWeight: 500
      }}>
        {subtitle}
      </p>

      {details.bio && (
        <p style={{
          margin: '0 0 0.5rem 0',
          fontSize: '0.82rem',
          color: '#64748b',
          lineHeight: 1.5,
        }}>
          {details.bio.length > 110 ? `${details.bio.slice(0, 110)}…` : details.bio}
        </p>
      )}

      {details.qualifications && (
        <p style={{
          margin: '0 0 1rem 0',
          fontSize: '0.78rem',
          color: 'var(--color-primary-dark)',
          fontWeight: 600,
        }}>
          🎓 {details.qualifications}
        </p>
      )}

      {details.rate_visible && details.rate_amount != null && (
        <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary-dark)', marginBottom: '0.5rem' }}>
          {formatRate(details.rate_amount, details.rate_currency)}
        </div>
      )}

      {/* Stats Row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        marginBottom: '1rem',
        fontSize: '0.85rem',
        color: '#475569'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <span style={{ color: '#fbbf24' }}>★</span>
          <span style={{ fontWeight: 600 }}>{rating.toFixed(1)}</span>
          <span style={{ opacity: 0.7 }}>({reviewCount})</span>
        </div>
        
        {experience != null && (
          <>
            <span style={{ opacity: 0.3 }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>{experience}</span>
              <span style={{ opacity: 0.7 }}>yrs exp</span>
            </div>
          </>
        )}
        
        {sessionsCompleted > 0 && (
          <>
            <span style={{ opacity: 0.3 }}>•</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span style={{ fontWeight: 600 }}>{sessionsCompleted}</span>
              <span style={{ opacity: 0.7 }}>sessions</span>
            </div>
          </>
        )}
      </div>

      {/* Location Badges */}
      {locationBadges.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          justifyContent: 'center',
          marginBottom: '1.5rem'
        }}>
          {locationBadges.map(badge => (
            <span key={badge} style={{
              fontSize: '0.75rem',
              padding: '0.25rem 0.6rem',
              borderRadius: '16px',
              background: '#e0f2fe',
              color: '#0369a1',
              fontWeight: 500
            }}>
              {badge}
            </span>
          ))}
        </div>
      )}

      {/* Specialties Tags */}
      {specialties.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.4rem',
          justifyContent: 'center',
          marginBottom: '1.5rem',
          marginTop: 'auto'
        }}>
          {specialties.slice(0, 5).map(spec => (
            <span key={spec} style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              background: '#f1f5f9',
              color: '#334155',
              border: '1px solid #e2e8f0',
            }}>
              {spec}
            </span>
          ))}
          {specialties.length > 5 && (
            <span style={{
              fontSize: '0.7rem',
              padding: '0.2rem 0.5rem',
              borderRadius: '4px',
              background: '#f8fafc',
              color: '#94a3b8',
              border: '1px solid #e2e8f0',
            }}>
              +{specialties.length - 5} more
            </span>
          )}
        </div>
      )}

      <div style={{ marginTop: specialties.length === 0 ? 'auto' : '0', width: '100%' }}></div>

      {/* Actions */}
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '1rem' }}>
        <button
          onClick={onBook}
          className="btn btn-primary"
          style={{ width: '100%', padding: '0.75rem 0', borderRadius: '8px' }}
        >
          Book Now
        </button>
        <a 
          href={`/directory/${profile.id}`} 
          className="btn btn-outline"
          style={{ width: '100%', padding: '0.6rem 0', borderRadius: '8px', fontSize: '0.9rem' }}
        >
          View Full Profile
        </a>
      </div>
    </div>
  );
}
