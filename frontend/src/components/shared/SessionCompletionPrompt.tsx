import { useState, useEffect, useCallback } from 'react';
import { getPastUnconfirmedBookings, markBookingCompleted, type BookingWithProvider } from '../../lib/bookings';

type Candidate = BookingWithProvider & { other_party_name: string };

export default function SessionCompletionPrompt() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);

  const load = useCallback(() => {
    getPastUnconfirmedBookings()
      .then((rows) => setCandidates(rows as Candidate[]))
      .catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);

  const dismiss = (id: string) => setCandidates((prev) => prev.filter((b) => b.id !== id));

  const handleComplete = async (id: string) => {
    await markBookingCompleted(id);
    dismiss(id);
  };

  if (candidates.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1200,
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div className="animate-slide-up" style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.15rem' }}>How did your session go?</h3>
        <p style={{ margin: '0 0 1.25rem', color: 'var(--color-text-muted)', fontSize: '0.88rem' }}>
          Confirm whether these past sessions actually happened.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {candidates.map((b) => (
            <div key={b.id} style={{ border: '1px solid rgba(0,0,0,0.08)', borderRadius: '10px', padding: '0.85rem 1rem' }}>
              <div style={{ fontSize: '0.9rem', marginBottom: '0.15rem' }}>
                Session with <strong>{b.other_party_name}</strong>
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginBottom: '0.75rem' }}>
                {new Date(b.session_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} &middot; {b.duration_minutes} min
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-primary btn-sm" onClick={() => handleComplete(b.id)}>Mark complete</button>
                <button className="btn btn-outline btn-sm" onClick={() => dismiss(b.id)}>Not yet</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
