import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { getMyBookingsAsCustomer, respondToProposedTime, cancelBooking, updateMeetingLink, type BookingWithProvider } from '../../lib/bookings';
import { getOrCreateConversation, sendMessage } from '../../lib/messaging';
import { getRoleDisplayName } from '../../types/lms';
import type { Profile, ProviderDetails } from '../../types/lms';
import BookingCalendarModal from '../../components/directory/BookingCalendarModal';
import { Calendar, Video, Link, MessageCircle, Edit2 } from 'lucide-react';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  pending: { bg: '#fef7e0', color: '#b06000' },
  confirmed: { bg: '#e6f4ea', color: '#137333' },
  completed: { bg: '#e8eaed', color: '#3c4043' },
  cancelled: { bg: '#fce8e6', color: '#c5221f' },
  reschedule_proposed: { bg: '#e8f0fe', color: '#1967d2' },
};

export default function MyBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<BookingWithProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editingProvider, setEditingProvider] = useState<(Profile & { provider_details?: ProviderDetails }) | null>(null);
  const [editingBooking, setEditingBooking] = useState<BookingWithProvider | null>(null);

  const [cancelingId, setCancelingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');

  const [addingLinkFor, setAddingLinkFor] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setBookings(await getMyBookingsAsCustomer());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRespond = async (bookingId: string, accept: boolean) => {
    await respondToProposedTime(bookingId, accept);
    load();
  };

  const handleMessage = async (providerId: string) => {
    const conversation = await getOrCreateConversation(providerId);
    navigate(`/dashboard/messages?c=${conversation.id}`);
  };

  const handleOpenEdit = async (booking: BookingWithProvider) => {
    const { data } = await supabase
      .from('profiles')
      .select('*, provider_details(*)')
      .eq('id', booking.provider_id)
      .single();
    if (data) {
      const details = Array.isArray(data.provider_details) ? data.provider_details[0] : data.provider_details;
      setEditingProvider({ ...data, provider_details: details });
      setEditingBooking(booking);
    }
  };

  const handleConfirmCancel = async (booking: BookingWithProvider) => {
    await cancelBooking(booking.id, cancelReason);
    try {
      const conversation = await getOrCreateConversation(booking.provider_id);
      const summary = `${new Date(booking.session_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`;
      await sendMessage(conversation.id, `Booking cancelled: ${summary}${cancelReason.trim() ? `\nReason: ${cancelReason.trim()}` : ''}`);
    } catch {
      // Non-fatal - the cancellation itself already succeeded.
    }
    setCancelingId(null);
    setCancelReason('');
    load();
  };

  const handleSaveLink = async (bookingId: string) => {
    await updateMeetingLink(bookingId, linkInput.trim());
    setAddingLinkFor(null);
    setLinkInput('');
    load();
  };

  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.session_date) >= now && b.status !== 'cancelled' && b.status !== 'completed');
  const past = bookings.filter((b) => new Date(b.session_date) < now || b.status === 'cancelled' || b.status === 'completed');

  const renderBooking = (b: BookingWithProvider) => {
    const style = STATUS_STYLE[b.status] ?? STATUS_STYLE.pending;
    const isUpcomingActive = new Date(b.session_date) >= now && (b.status === 'pending' || b.status === 'confirmed');

    return (
      <div key={b.id} style={{
        display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem',
        border: '1px solid rgba(0,0,0,0.06)', borderRadius: '10px', marginBottom: '0.75rem', background: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{
            width: '44px', height: '44px', borderRadius: '50%', background: '#f0f2f5', flexShrink: 0,
            backgroundImage: b.provider_avatar_url ? `url(${b.provider_avatar_url})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: '#8b9bb4',
          }}>
            {!b.provider_avatar_url && b.provider_name.split(' ').map((n) => n[0]).join('').toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600 }}>{b.provider_name} <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>({getRoleDisplayName(b.provider_role as 'tutor' | 'coach')})</span></div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)' }}>
              {new Date(b.session_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} &middot; {b.duration_minutes} min
            </div>
          </div>
          <span style={{ fontSize: '0.75rem', padding: '0.25rem 0.7rem', borderRadius: '16px', fontWeight: 600, textTransform: 'capitalize', background: style.bg, color: style.color }}>
            {b.status === 'reschedule_proposed' ? 'New time proposed' : b.status}
          </span>
        </div>

        {b.status === 'cancelled' && b.cancellation_reason && (
          <div style={{ fontSize: '0.8rem', color: '#c5221f', background: '#fce8e6', borderRadius: '8px', padding: '0.6rem 0.8rem' }}>
            Cancellation reason: {b.cancellation_reason}
          </div>
        )}

        {b.status === 'reschedule_proposed' && b.proposed_session_date && (
          <div style={{ background: '#e8f0fe', borderRadius: '8px', padding: '0.75rem 1rem' }}>
            <div style={{ fontSize: '0.85rem', color: '#1967d2', marginBottom: '0.6rem' }}>
              {b.provider_name} proposed a new time: <strong>{new Date(b.proposed_session_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</strong>
              {b.proposed_duration_minutes ? ` (${b.proposed_duration_minutes} min)` : ''}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" onClick={() => handleRespond(b.id, true)}>Accept</button>
              <button className="btn btn-outline btn-sm" onClick={() => handleRespond(b.id, false)}>Decline</button>
            </div>
          </div>
        )}

        {b.status === 'confirmed' && (
          b.use_video_room ? (
            b.video_room_id ? (
              <button 
                className="btn btn-primary btn-sm" 
                style={{ alignSelf: 'flex-start', background: 'linear-gradient(135deg, var(--color-primary), var(--color-spring-dark))', border: 'none', display: 'flex', alignItems: 'center', gap: '0.4rem' }} 
                onClick={() => navigate(`/dashboard/video-room/${b.video_room_id}`)}
              >
                <Video size={16} /> Join Video Room
              </button>
            ) : (
              <div style={{ fontSize: '0.8rem', color: '#b06000', background: '#fef7e0', padding: '0.4rem 0.8rem', borderRadius: '8px', alignSelf: 'flex-start' }}>
                Video room is being prepared...
              </div>
            )
          ) : b.meeting_link ? (
            <a href={b.meeting_link} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
              <Link size={16} /> Join Call
            </a>
          ) : addingLinkFor === b.id ? (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Paste Zoom / Google Meet / Teams link"
                style={{ flex: 1, padding: '0.5rem 0.7rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontFamily: 'inherit', fontSize: '0.85rem' }}
              />
              <button className="btn btn-primary btn-sm" onClick={() => handleSaveLink(b.id)}>Save</button>
              <button className="btn btn-outline btn-sm" onClick={() => setAddingLinkFor(null)}>Cancel</button>
            </div>
          ) : (
            <button className="btn btn-outline btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => { setAddingLinkFor(b.id); setLinkInput(''); }}>
              + Add meeting link
            </button>
          )
        )}

        {cancelingId === b.id ? (
          <div style={{ background: '#fce8e6', borderRadius: '8px', padding: '0.75rem 0.8rem' }}>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: '#8a2a20' }}>
              Let {b.provider_name} know why, if you'd like (optional)
            </label>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={2}
              style={{ width: '100%', padding: '0.5rem 0.65rem', borderRadius: '8px', border: '1px solid #f3b3ac', fontFamily: 'inherit', fontSize: '0.85rem', resize: 'vertical', marginBottom: '0.6rem' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button className="btn btn-primary btn-sm" style={{ background: '#c5221f', borderColor: '#c5221f' }} onClick={() => handleConfirmCancel(b)}>
                Confirm Cancellation
              </button>
              <button className="btn btn-outline btn-sm" onClick={() => { setCancelingId(null); setCancelReason(''); }}>
                Never mind
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn btn-outline btn-sm" onClick={() => handleMessage(b.provider_id)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><MessageCircle size={14} /> Message</button>
            {isUpcomingActive && (
              <>
                <button className="btn btn-outline btn-sm" onClick={() => handleOpenEdit(b)} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Edit2 size={14} /> Edit</button>
                <button className="btn btn-outline btn-sm" style={{ color: '#c5221f', borderColor: '#f3b3ac' }} onClick={() => setCancelingId(b.id)}>
                  Cancel
                </button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className="dashboard-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Calendar size={32} color="#2196F3" /> My Bookings</h1>
          <p className="dashboard-page-subtitle">Your upcoming and past sessions with tutors and coaches.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate('/directory')}>
          Browse the Directory
        </button>
      </div>

      {error && <div style={{ background: '#ffebee', color: '#c62828', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : bookings.length === 0 ? (
        <div className="content-panel">
          <div className="content-panel-body">
            <div className="empty-state">
              <div className="empty-state-icon"><Calendar size={48} /></div>
              <div className="empty-state-title">You haven't booked a session yet</div>
              <div className="empty-state-text">Browse the directory to find a tutor or coach and book your first session.</div>
              <button className="btn btn-primary" style={{ marginTop: '1rem' }} onClick={() => navigate('/directory')}>
                Browse the Directory
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="content-panel" style={{ marginBottom: '1.5rem' }}>
            <div className="content-panel-header"><h3 className="content-panel-title">Upcoming</h3></div>
            <div className="content-panel-body">
              {upcoming.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)' }}>No upcoming sessions. <a href="/directory">Book one?</a></p>
              ) : upcoming.map(renderBooking)}
            </div>
          </div>

          {past.length > 0 && (
            <div className="content-panel">
              <div className="content-panel-header"><h3 className="content-panel-title">Past</h3></div>
              <div className="content-panel-body">{past.map(renderBooking)}</div>
            </div>
          )}
        </>
      )}

      {editingProvider && editingBooking && (
        <BookingCalendarModal
          provider={editingProvider}
          editingBooking={editingBooking}
          onUpdated={load}
          onClose={() => { setEditingProvider(null); setEditingBooking(null); }}
        />
      )}
    </div>
  );
}
