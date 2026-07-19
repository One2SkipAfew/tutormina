import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { Profile, ProviderDetails } from '../types/lms';
import ProviderTile from '../components/directory/ProviderTile';
import BookingCalendarModal from '../components/directory/BookingCalendarModal';

import { useAuth } from '../contexts/AuthContext';

// Extend profile to include the joined provider details
interface DirectoryProfile extends Profile {
  provider_details: ProviderDetails;
}

export default function Directory() {
  const { session } = useAuth();
  const [providers, setProviders] = useState<DirectoryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<'all' | 'tutor' | 'coach'>(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get('type');
    return (type === 'tutor' || type === 'coach') ? type : 'all';
  });
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [specialtySearch, setSpecialtySearch] = useState('');
  const [selectedProvider, setSelectedProvider] = useState<DirectoryProfile | null>(null);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  useEffect(() => {
    async function fetchProviders() {
      setLoading(true);
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          provider_details (*)
        `)
        .in('role', ['tutor', 'coach'])
        .eq('status', 'approved');

      if (data) {
        // Filter out profiles that might not have provider_details set up yet
        // In a real app, we'd also handle pagination
        const validProviders = (data as any[]).filter(p => p.provider_details) as DirectoryProfile[];
        setProviders(validProviders);
      }
      setLoading(false);
    }
    
    fetchProviders();
  }, []);

  const allSpecialties = Array.from(
    new Set(providers.flatMap(p => p.provider_details.specialties ?? []))
  ).sort();

  const visibleSpecialties = specialtySearch.trim()
    ? allSpecialties.filter(s => s.toLowerCase().includes(specialtySearch.trim().toLowerCase()))
    : allSpecialties;

  const filteredProviders = providers.filter(p => {
    if (filterRole !== 'all' && p.role !== filterRole) return false;
    const providerSpecialties = p.provider_details.specialties ?? [];
    if (selectedSpecialties.length > 0) {
      if (!selectedSpecialties.some(s => providerSpecialties.includes(s))) return false;
    } else if (specialtySearch.trim()) {
      const query = specialtySearch.trim().toLowerCase();
      if (!providerSpecialties.some(s => s.toLowerCase().includes(query))) return false;
    }
    return true;
  });

  const toggleSpecialty = (spec: string) => {
    setSelectedSpecialties(prev => prev.includes(spec) ? prev.filter(s => s !== spec) : [...prev, spec]);
  };

  const handleBookClick = (provider: DirectoryProfile) => {
    if (!session) {
      setShowAuthPrompt(true);
    } else {
      setSelectedProvider(provider);
    }
  };

  return (
    <div style={{ background: '#f8fafc', minHeight: 'calc(100vh - 64px)', padding: '3rem 0' }}>
      <div className="container">
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 800, color: 'var(--color-primary-dark)', marginBottom: '1rem' }}>
            Find Your Expert
          </h1>
          <p style={{ fontSize: '1.1rem', color: 'var(--color-text-muted)', maxWidth: '600px', margin: '0 auto' }}>
            Browse our directory of vetted tutors and coaches. Filter by specialty and book a session that fits your schedule.
          </p>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <button 
            className={`btn ${filterRole === 'all' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterRole('all')}
            style={{ borderRadius: '30px', padding: '0.5rem 1.5rem' }}
          >
            All Experts
          </button>
          <button 
            className={`btn ${filterRole === 'tutor' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterRole('tutor')}
            style={{ borderRadius: '30px', padding: '0.5rem 1.5rem' }}
          >
            Tutors
          </button>
          <button 
            className={`btn ${filterRole === 'coach' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setFilterRole('coach')}
            style={{ borderRadius: '30px', padding: '0.5rem 1.5rem' }}
          >
            Coaches
          </button>
        </div>

        {/* Specialty Search + Filter */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', marginBottom: '2.5rem' }}>
          <div style={{ position: 'relative', width: '100%', maxWidth: '420px' }}>
            <span style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              value={specialtySearch}
              onChange={(e) => setSpecialtySearch(e.target.value)}
              placeholder="Search by speciality (e.g. Mathematics, Executive Coaching)"
              style={{
                width: '100%', padding: '0.65rem 1rem 0.65rem 2.4rem', borderRadius: '30px',
                border: '1px solid #e2e8f0', fontSize: '0.9rem',
              }}
            />
            {specialtySearch && (
              <button
                onClick={() => setSpecialtySearch('')}
                style={{ position: 'absolute', right: '0.9rem', top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                ✕
              </button>
            )}
          </div>

          {visibleSpecialties.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', maxWidth: '700px' }}>
              {visibleSpecialties.map(spec => (
                <button
                  key={spec}
                  onClick={() => toggleSpecialty(spec)}
                  style={{
                    fontSize: '0.8rem',
                    padding: '0.35rem 0.85rem',
                    borderRadius: '16px',
                    border: selectedSpecialties.includes(spec) ? '1px solid var(--color-primary-dark)' : '1px solid #e2e8f0',
                    background: selectedSpecialties.includes(spec) ? 'var(--color-primary-dark)' : '#fff',
                    color: selectedSpecialties.includes(spec) ? '#fff' : '#475569',
                    cursor: 'pointer',
                  }}
                >
                  {spec}
                </button>
              ))}
              {selectedSpecialties.length > 0 && (
                <button
                  onClick={() => setSelectedSpecialties([])}
                  style={{ fontSize: '0.8rem', padding: '0.35rem 0.85rem', border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer' }}
                >
                  Clear specialties
                </button>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
            Loading experts...
          </div>
        ) : filteredProviders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)', background: '#fff', borderRadius: '8px' }}>
            No experts found matching your criteria.
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '2rem',
          }}>
            {filteredProviders.map(provider => (
              <ProviderTile 
                key={provider.id} 
                profile={provider} 
                details={provider.provider_details} 
                onBook={() => handleBookClick(provider)}
              />
            ))}
          </div>
        )}

        {/* Booking Modal */}
        {selectedProvider && (
          <BookingCalendarModal 
            provider={selectedProvider} 
            onClose={() => setSelectedProvider(null)} 
          />
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
                Please log in or register an account to book a session with our experts.
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
    </div>
  );
}
