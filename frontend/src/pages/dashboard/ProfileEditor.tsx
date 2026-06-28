import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { ProviderDetails, UserRole } from '../../types/lms';
import { getZoneColor } from '../../types/lms';

export default function ProfileEditor() {
  const { profile, refreshProfile } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [providerDetails, setProviderDetails] = useState<ProviderDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const role = profile?.role ?? 'customer';
  const zone = getZoneColor(role);
  const isProvider = role === 'tutor' || role === 'coach';

  useEffect(() => {
    if (profile) {
      setFirstName(profile.first_name);
      setLastName(profile.last_name);
    }
  }, [profile]);

  useEffect(() => {
    if (isProvider && profile) {
      supabase
        .from('provider_details')
        .select('*')
        .eq('profile_id', profile.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setProviderDetails(data);
            setBio(data.bio || '');
            setPhone(data.phone_number || '');
            setLocation(data.location || '');
          }
        });
    }
  }, [isProvider, profile]);

  const handleSave = async () => {
    if (!profile) return;
    setLoading(true);
    setError(null);
    setSaved(false);

    try {
      // Update profile
      const { error: profileErr } = await supabase
        .from('profiles')
        .update({
          first_name: firstName,
          last_name: lastName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', profile.id);

      if (profileErr) throw profileErr;

      // Update provider details if applicable
      if (isProvider) {
        const { error: providerErr } = await supabase
          .from('provider_details')
          .upsert({
            profile_id: profile.id,
            bio,
            phone_number: phone,
            location,
            is_tutor: role === 'tutor' || (providerDetails?.is_tutor ?? false),
            is_coach: role === 'coach' || (providerDetails?.is_coach ?? false),
          });

        if (providerErr) throw providerErr;
      }

      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setLoading(false);
    }
  };

  const zoneColor = zone === 'tutor'
    ? 'var(--zone-tutor)'
    : zone === 'coach'
      ? 'var(--zone-coach)'
      : 'var(--zone-student)';

  const zoneBg = zone === 'tutor'
    ? 'var(--zone-tutor-light)'
    : zone === 'coach'
      ? 'var(--zone-coach-light)'
      : 'var(--zone-student-light)';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '0.7rem 0.85rem',
    borderRadius: '8px',
    border: '1px solid rgba(0, 0, 0, 0.12)',
    fontFamily: 'inherit',
    fontSize: '0.9rem',
    transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    marginBottom: '0.35rem',
    color: 'var(--color-text-main)',
  };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">My Profile</h1>
        <p className="dashboard-page-subtitle">Manage your personal information and preferences.</p>
      </div>

      {/* Avatar + Zone Banner */}
      <div className="content-panel" style={{ marginBottom: '1.5rem', overflow: 'visible' }}>
        <div style={{
          height: '100px',
          background: zone === 'tutor'
            ? 'var(--zone-tutor-gradient)'
            : zone === 'coach'
              ? 'var(--zone-coach-gradient)'
              : 'var(--zone-student-gradient)',
          borderRadius: '12px 12px 0 0',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            bottom: '-32px',
            left: '1.5rem',
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#fff',
            border: `3px solid ${zoneColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.5rem',
            fontWeight: 800,
            color: zoneColor,
            boxShadow: 'var(--shadow-md)',
          }}>
            {profile ? `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase() : '?'}
          </div>
        </div>
        <div style={{ padding: '2.75rem 1.5rem 1.25rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
            {profile?.first_name} {profile?.last_name}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
            {profile?.email} • {role === 'tutor' ? '🎓 Tutor' : role === 'coach' ? '🤝 Coach' : '📖 Student'}
          </p>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div style={{
          padding: '0.75rem 1rem',
          background: '#FFEBEE',
          border: '1px solid #EF9A9A',
          borderRadius: '8px',
          color: '#C62828',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          {error}
        </div>
      )}

      {saved && (
        <div style={{
          padding: '0.75rem 1rem',
          background: zoneBg,
          border: `1px solid ${zoneColor}`,
          borderRadius: '8px',
          color: zone === 'tutor' ? 'var(--zone-tutor-dark)' : zone === 'coach' ? 'var(--zone-coach-dark)' : 'var(--zone-student-dark)',
          fontSize: '0.85rem',
          marginBottom: '1rem',
        }}>
          ✅ Profile saved successfully!
        </div>
      )}

      {/* Profile Form */}
      <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
        <div className="content-panel-header">
          <h3 className="content-panel-title">Personal Information</h3>
        </div>
        <div className="content-panel-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', maxWidth: '600px' }}>
            <div>
              <label style={labelStyle}>First Name</label>
              <input
                type="text"
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Last Name</label>
              <input
                type="text"
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ marginTop: '1rem', maxWidth: '600px' }}>
            <label style={labelStyle}>Email Address</label>
            <input
              type="email"
              value={profile?.email ?? ''}
              disabled
              style={{ ...inputStyle, background: '#f5f5f5', cursor: 'not-allowed' }}
            />
            <p style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
              Email cannot be changed here. Contact support if needed.
            </p>
          </div>
        </div>
      </div>

      {/* Provider Details (Tutors & Coaches only) */}
      {isProvider && (
        <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="content-panel-header">
            <h3 className="content-panel-title">
              {role === 'tutor' ? '🎓 Tutor Details' : '🤝 Coach Details'}
            </h3>
          </div>
          <div className="content-panel-body" style={{ maxWidth: '600px' }}>
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Bio</label>
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell students about your experience, teaching style, and specializations..."
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', minHeight: '100px' }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="+27 XX XXX XXXX"
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Johannesburg, South Africa"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Button */}
      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={loading}
          style={{
            padding: '0.75rem 2rem',
            background: zoneColor,
          }}
        >
          {loading ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
