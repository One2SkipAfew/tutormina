import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../contexts/AuthContext';
import type { Profile, ProviderDetails, AvailabilityRule, AvailabilityException, Booking } from '../../types/lms';
import { getAvailabilityRulesFor, getAvailabilityExceptionsFor, getMyBookingConflicts, updateBooking, type BookingConflict, type BookingWithProvider } from '../../lib/bookings';
import { expandAvailability, getAvailableSlotsForDate, toDateKey } from '../../lib/availability';
import { getOrCreateConversation, sendMessage } from '../../lib/messaging';

interface BookingCalendarModalProps {
  provider: Profile & { provider_details?: ProviderDetails };
  onClose: () => void;
  editingBooking?: BookingWithProvider;
  onUpdated?: () => void;
}

const DURATIONS = [
  { value: 30, label: '30 Minutes' },
  { value: 60, label: '1 Hour' },
  { value: 90, label: '1.5 Hours' },
  { value: 120, label: '2 Hours' },
];

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60).toString().padStart(2, '0');
  const m = (mins % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export default function BookingCalendarModal({ provider, onClose, editingBooking, onUpdated }: BookingCalendarModalProps) {
  const { session, profile: currentUser } = useAuth();
  const isEditing = !!editingBooking;

  const initialDate = editingBooking ? new Date(editingBooking.session_date) : new Date();
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [selectedDate, setSelectedDate] = useState<Date | null>(editingBooking ? initialDate : null);
  const [selectedDuration, setSelectedDuration] = useState<number>(editingBooking?.duration_minutes ?? 30);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(
    editingBooking ? initialDate.toTimeString().slice(0, 5) : null
  );
  const [topic, setTopic] = useState(editingBooking?.student_topic ?? '');
  const [note, setNote] = useState(editingBooking?.student_note ?? '');
  const [useVideoRoom, setUseVideoRoom] = useState(editingBooking?.use_video_room ?? true);

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [existingBookings, setExistingBookings] = useState<Booking[]>([]);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);

  const [loadingSlots, setLoadingSlots] = useState(false);
  const [bookingStatus, setBookingStatus] = useState<'idle' | 'booking' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<BookingConflict[]>([]);
  const [conflictAcknowledged, setConflictAcknowledged] = useState(false);

  const specialtyOptions = provider.provider_details?.specialties ?? [];

  // 1. Fetch provider's availability rules + exceptions
  useEffect(() => {
    Promise.all([getAvailabilityRulesFor(provider.id), getAvailabilityExceptionsFor(provider.id)]).then(([r, e]) => {
      setRules(r);
      setExceptions(e);
    });
  }, [provider.id]);

  // 2. Fetch existing bookings when a date is selected
  useEffect(() => {
    if (!selectedDate) return;

    async function fetchSlots() {
      setLoadingSlots(true);
      // We need to fetch bookings for the selected date to filter out occupied slots
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      let query = supabase
        .from('bookings')
        .select('*')
        .eq('provider_id', provider.id)
        .gte('session_date', startOfDay.toISOString())
        .lte('session_date', endOfDay.toISOString())
        .not('status', 'eq', 'cancelled');

      // Editing a booking shouldn't count its own current slot as "occupied".
      if (editingBooking) query = query.neq('id', editingBooking.id);

      const { data } = await query;

      if (data) setExistingBookings(data as Booking[]);
      setLoadingSlots(false);
    }

    fetchSlots();
  }, [selectedDate, provider.id, editingBooking]);

  // 3. Calculate available slots whenever date, duration, or bookings change. Rules/exceptions/
  // existingBookings load in asynchronously after mount, so this effect re-fires several times
  // before the user touches anything - only clear the chosen slot when selectedDate/selectedDuration
  // themselves actually change (tracked via refs), not just because this effect re-ran for other
  // reasons, so an edit's prefilled slot survives those async loads.
  const prevDateKeyRef = useRef<string | null>(null);
  const prevDurationRef = useRef<number | null>(null);
  useEffect(() => {
    if (!selectedDate) {
      setAvailableSlots([]);
      return;
    }

    const ranges = expandAvailability(rules, exceptions, selectedDate, selectedDate).get(toDateKey(selectedDate)) ?? [];
    const slots = getAvailableSlotsForDate(selectedDate, ranges, existingBookings, selectedDuration);
    setAvailableSlots(slots);

    const dateKey = selectedDate.toDateString();
    const dateChanged = prevDateKeyRef.current !== null && prevDateKeyRef.current !== dateKey;
    const durationChanged = prevDurationRef.current !== null && prevDurationRef.current !== selectedDuration;
    if (dateChanged || durationChanged) {
      setSelectedSlot(null);
    }
    prevDateKeyRef.current = dateKey;
    prevDurationRef.current = selectedDuration;
  }, [selectedDate, selectedDuration, rules, exceptions, existingBookings]);

  // 4. Check the student's own schedule for a time clash whenever the candidate slot changes.
  useEffect(() => {
    setConflictAcknowledged(false);
    if (!selectedDate || !selectedSlot || !session) {
      setConflicts([]);
      return;
    }
    const [h, m] = selectedSlot.split(':').map(Number);
    const candidateDate = new Date(selectedDate);
    candidateDate.setHours(h, m, 0, 0);

    getMyBookingConflicts(candidateDate, selectedDuration, editingBooking?.id)
      .then(setConflicts)
      .catch(() => setConflicts([]));
  }, [selectedDate, selectedSlot, selectedDuration, session, editingBooking]);

  const navigate = useNavigate();

  // The set of 30-min marks a selected start time actually consumes, so the time grid can show
  // the whole block (not just the clicked button) as reserved for this booking.
  const coveredSlots = useMemo(() => {
    if (!selectedSlot) return new Set<string>();
    const start = timeToMinutes(selectedSlot);
    const covered = new Set<string>();
    for (let m = start; m < start + selectedDuration; m += 30) covered.add(minutesToTime(m));
    return covered;
  }, [selectedSlot, selectedDuration]);

  const handleBook = async () => {
    if (!session || !currentUser) {
      navigate('/login?redirect=' + encodeURIComponent(window.location.pathname));
      return;
    }

    if (!selectedDate || !selectedSlot) return;
    if (conflicts.length > 0 && !conflictAcknowledged) return;

    setBookingStatus('booking');

    const [h, m] = selectedSlot.split(':').map(Number);
    const sessionDate = new Date(selectedDate);
    sessionDate.setHours(h, m, 0, 0);
    const summary = `${sessionDate.toLocaleDateString(undefined, { dateStyle: 'medium' })}, ${selectedSlot}, ${selectedDuration} min`;

    if (isEditing && editingBooking) {
      try {
        await updateBooking(editingBooking.id, {
          session_date: sessionDate.toISOString(),
          duration_minutes: selectedDuration,
          student_topic: topic || null,
          student_note: note.trim() || null,
          use_video_room: useVideoRoom,
        });
      } catch (err) {
        setBookingStatus('error');
        setErrorMessage(err instanceof Error ? err.message : 'Failed to update booking');
        return;
      }

      setBookingStatus('success');
      onUpdated?.();

      try {
        const conversation = await getOrCreateConversation(provider.id);
        setConversationId(conversation.id);
        await sendMessage(conversation.id, `Booking updated: ${summary}`);
      } catch {
        // Non-fatal - the update itself already succeeded.
      }
      return;
    }

    const { error } = await supabase.from('bookings').insert({
      customer_id: currentUser.id,
      provider_id: provider.id,
      session_date: sessionDate.toISOString(),
      duration_minutes: selectedDuration,
      status: 'pending', // Tutor/Coach needs to confirm later
      student_topic: topic || null,
      student_note: note.trim() || null,
      use_video_room: useVideoRoom,
    });

    if (error) {
      setBookingStatus('error');
      setErrorMessage(error.message);
      return;
    }

    setBookingStatus('success');

    // Best-effort: let the provider see the request in their inbox too. Booking already
    // succeeded above, so a messaging failure here shouldn't surface as a booking error.
    try {
      const conversation = await getOrCreateConversation(provider.id);
      setConversationId(conversation.id);
      const lines = [`New booking request: ${summary}`];
      if (topic) lines.push(`Topic: ${topic}`);
      if (note.trim()) lines.push(`Note: ${note.trim()}`);
      await sendMessage(conversation.id, lines.join('\n'));
    } catch {
      // Non-fatal - the booking itself already succeeded.
    }
  };

  // Calendar generation helpers
  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) {
    days.push(null);
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(currentDate.getFullYear(), currentDate.getMonth(), i));
  }

  const monthExpanded = useMemo(() => {
    const rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
    return expandAvailability(rules, exceptions, rangeStart, rangeEnd);
  }, [rules, exceptions, currentDate]);

  const isDayAvailable = (date: Date) => {
    // True if the expanded availability has a slot for this date, and it's not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return false;
    return monthExpanded.has(toDateKey(date));
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', zIndex: 1000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div className="animate-slide-up" style={{
        background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '800px',
        maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column'
      }}>

        {/* Header */}
        <div style={{ padding: '1.5rem', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '1.25rem' }}>
            {isEditing ? 'Edit Booking with' : 'Book Session with'} {provider.first_name} {provider.last_name}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', padding: '0.5rem' }}>×</button>
        </div>

        {bookingStatus === 'success' ? (
          <div style={{ padding: '3rem 2rem', textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎉</div>
            <h3 style={{ fontSize: '1.5rem', color: 'var(--color-primary-dark)', marginBottom: '1rem' }}>
              {isEditing ? 'Booking Updated!' : 'Booking Request Sent!'}
            </h3>
            <p style={{ color: 'var(--color-text-muted)', marginBottom: '2rem' }}>
              {isEditing
                ? `Your session with ${provider.first_name} has been updated.`
                : `Your session request has been sent to ${provider.first_name}. You can view the status in your dashboard.`}
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              {conversationId && (
                <button
                  className="btn btn-outline"
                  onClick={() => navigate(`/dashboard/messages?c=${conversationId}`)}
                >
                  💬 Chat with {provider.first_name}
                </button>
              )}
              <button className="btn btn-primary" onClick={onClose}>{isEditing ? 'Done' : 'Return to Directory'}</button>
            </div>
          </div>
        ) : (
          <div style={{ padding: '1.5rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>

              {/* Left Col: Calendar & Duration */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>1. Select Duration</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.6rem', marginBottom: '2rem' }}>
                  {DURATIONS.map(dur => {
                    const active = selectedDuration === dur.value;
                    return (
                      <button
                        key={dur.value}
                        onClick={() => setSelectedDuration(dur.value)}
                        style={{
                          padding: '0.65rem 0.5rem',
                          borderRadius: '10px',
                          border: `2px solid ${active ? 'var(--color-primary-dark)' : '#e2e8f0'}`,
                          background: active ? 'var(--color-primary-dark)' : '#fff',
                          color: active ? '#fff' : '#333',
                          cursor: 'pointer',
                          fontWeight: active ? 700 : 500,
                          transition: 'all 0.15s',
                          boxShadow: active ? '0 2px 8px rgba(0,0,0,0.15)' : 'none',
                        }}
                      >
                        {active ? '✓ ' : ''}{dur.label}
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1rem', margin: 0 }}>2. Select Date</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} style={{ border: 'none', background: '#eee', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>&lt;</button>
                    <span style={{ fontWeight: 600 }}>{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                    <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} style={{ border: 'none', background: '#eee', padding: '0.25rem 0.75rem', borderRadius: '4px', cursor: 'pointer' }}>&gt;</button>
                  </div>
                </div>

                {/* Calendar Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '0.5rem' }}>
                  {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} style={{ fontSize: '0.8rem', color: '#666', fontWeight: 600 }}>{d}</div>)}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {days.map((date, i) => {
                    if (!date) return <div key={`empty-${i}`} />;

                    const isAvailable = isDayAvailable(date);
                    const isSelected = selectedDate?.toDateString() === date.toDateString();

                    return (
                      <button
                        key={i}
                        disabled={!isAvailable}
                        onClick={() => setSelectedDate(date)}
                        style={{
                          aspectRatio: '1',
                          border: isSelected ? '2px solid var(--color-primary)' : '1px solid #eee',
                          background: isSelected ? 'var(--color-primary)' : isAvailable ? '#f8fafc' : '#fff',
                          color: isSelected ? '#fff' : isAvailable ? '#333' : '#ccc',
                          borderRadius: '8px',
                          cursor: isAvailable ? 'pointer' : 'not-allowed',
                          fontWeight: isSelected ? 700 : 400,
                        }}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right Col: Time Slots */}
              <div>
                <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>3. Select Time</h3>
                {!selectedDate ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f9f9f9', borderRadius: '8px', color: '#666' }}>
                    Please select a date from the calendar to view available time slots.
                  </div>
                ) : loadingSlots ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading slots...</div>
                ) : availableSlots.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f9f9f9', borderRadius: '8px', color: '#666' }}>
                    No available slots on this date for a {selectedDuration}-minute session.
                  </div>
                ) : (
                  <>
                    {selectedSlot && (
                      <div style={{ fontSize: '0.8rem', color: 'var(--color-primary-dark)', marginBottom: '0.75rem' }}>
                        Reserving {selectedSlot}–{minutesToTime(timeToMinutes(selectedSlot) + selectedDuration)}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', maxHeight: '350px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                      {availableSlots.map(slot => {
                        const isSelected = selectedSlot === slot;
                        const isCovered = !isSelected && coveredSlots.has(slot);
                        return (
                          <button
                            key={slot}
                            onClick={() => setSelectedSlot(slot)}
                            style={{
                              padding: '0.75rem',
                              border: `2px solid ${isSelected || isCovered ? 'var(--color-primary)' : '#e2e8f0'}`,
                              background: isSelected ? 'var(--color-primary)' : isCovered ? 'var(--color-primary-light)' : '#fff',
                              color: isSelected ? '#fff' : 'var(--color-primary-dark)',
                              borderRadius: '8px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              transition: 'all 0.15s',
                            }}
                          >
                            {isSelected ? '✓ ' : ''}{slot}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Topic + Note - full width */}
            <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
              <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>4. Anything you'd like to share? (optional)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    What would you like help with?
                  </label>
                  <select
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  >
                    <option value="">Select a topic (optional)</option>
                    {specialtyOptions.map((s) => <option key={s} value={s}>{s}</option>)}
                    <option value="Something else">Something else</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem' }}>
                    Anything else {provider.first_name} should know?
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="e.g. I'm preparing for a test next week..."
                    rows={2}
                    style={{ width: '100%', padding: '0.65rem', borderRadius: '8px', border: '1px solid #e2e8f0', resize: 'vertical', fontFamily: 'inherit' }}
                  />
                </div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <input
                    type="checkbox"
                    checked={useVideoRoom}
                    onChange={(e) => setUseVideoRoom(e.target.checked)}
                    style={{ width: '1.2rem', height: '1.2rem', accentColor: 'var(--color-primary-dark)' }}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                      Host this session in a TutorMina Video Room
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Enjoy real-time transcription, AI insights, and fact-checking during your session.
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {/* Action Area */}
            <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #eee' }}>
              {bookingStatus === 'error' && (
                <div style={{ color: 'red', fontSize: '0.85rem', marginBottom: '1rem' }}>{errorMessage}</div>
              )}
              {conflicts.length > 0 && !conflictAcknowledged && (
                <div style={{ background: '#fff8e1', border: '1px solid #ffe082', borderRadius: '8px', padding: '0.85rem 1rem', marginBottom: '1rem' }}>
                  <div style={{ fontSize: '0.85rem', color: '#8a6d00', marginBottom: '0.6rem' }}>
                    ⚠️ This overlaps with your session with <strong>{conflicts[0].provider_name}</strong> at{' '}
                    {new Date(conflicts[0].session_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button className="btn btn-outline" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => setSelectedSlot(null)}>
                      Change Time
                    </button>
                    <button className="btn btn-primary" style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => setConflictAcknowledged(true)}>
                      Book Anyway
                    </button>
                  </div>
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '1rem', fontSize: '1.1rem' }}
                disabled={!selectedDate || !selectedSlot || bookingStatus === 'booking' || (conflicts.length > 0 && !conflictAcknowledged)}
                onClick={handleBook}
              >
                {bookingStatus === 'booking' ? 'Confirming...' : isEditing ? 'Save Changes' : 'Confirm Booking'}
              </button>
              {!session && (
                <p style={{ textAlign: 'center', fontSize: '0.85rem', color: '#666', marginTop: '0.5rem' }}>
                  You will need to log in to complete the booking.
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
