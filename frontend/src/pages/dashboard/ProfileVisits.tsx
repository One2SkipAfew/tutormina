import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getOrCreateConversation } from '../../lib/messaging';

interface ProfileVisit {
  id: string;
  visited_at: string;
  visitor: {
    id: string;
    first_name: string;
    last_name: string;
    role: string;
  };
}

export default function ProfileVisits() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<ProfileVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchVisits() {
      if (!profile) return;
      const { data } = await supabase
        .from('profile_visits')
        .select(`
          id,
          visited_at,
          visitor:profiles!visitor_id (
            id,
            first_name,
            last_name,
            role
          )
        `)
        .eq('provider_id', profile.id)
        .order('visited_at', { ascending: false })
        .limit(50);
        
      if (data) {
        setVisits(data as unknown as ProfileVisit[]);
      }
      setLoading(false);
    }
    
    fetchVisits();
  }, [profile]);

  const handleMessage = async (visitorId: string) => {
    try {
      const conversation = await getOrCreateConversation(visitorId);
      // Pass a query parameter to open the compose box with a template if we want
      navigate(`/dashboard/messages?c=${conversation.id}&template=intro`);
    } catch (err) {
      console.error('Error starting conversation:', err);
    }
  };

  return (
    <div className="container animate-fade-in" style={{ padding: '2rem 0', maxWidth: '800px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '2rem' }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.5rem', color: '#64748b' }}>
          &larr;
        </button>
        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--color-primary-dark)', margin: 0 }}>
          Profile Visits
        </h1>
      </div>

      <div className="glass-card">
        <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
          See who has been viewing your profile recently. Reach out to prospective students to offer a free intro call or advertise a special!
        </p>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b' }}>Loading visits...</div>
        ) : visits.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: '#64748b', background: '#f8fafc', borderRadius: '8px' }}>
            No profile visits yet. Check back soon!
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {visits.map((visit) => (
              <div key={visit.id} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '1.25rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: '#fff',
                transition: 'transform 0.15s, box-shadow 0.15s',
                cursor: 'default'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--color-primary-dark)' }}>
                    {visit.visitor.first_name} {visit.visitor.last_name}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Visited on {new Date(visit.visited_at).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
                <button
                  onClick={() => handleMessage(visit.visitor.id)}
                  className="btn btn-outline"
                  style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', borderColor: 'var(--color-primary)', color: 'var(--color-primary-dark)' }}
                >
                  💬 Send Message
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
