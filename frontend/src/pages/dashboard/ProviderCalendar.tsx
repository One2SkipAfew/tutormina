import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabaseClient';
import type { Booking, AvailabilityRule, AvailabilityException, AvailabilityFrequency, StudentDetails } from '../../types/lms';
import { getZoneColor } from '../../types/lms';
import { getStudentTypeLabels } from '../../lib/studentDetails';
import {
  getMyAvailabilityRules,
  getMyAvailabilityExceptions,
  addAvailabilityRule,
  deleteAvailabilityRule,
  addAvailabilityException,
  deleteAvailabilityException,
  proposeNewBookingTime,
  updateMeetingLink,
} from '../../lib/bookings';
import { getOrCreateConversation } from '../../lib/messaging';
import { expandAvailability, toDateKey } from '../../lib/availability';

interface PopulatedBooking extends Booking {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
    student_details: StudentDetails | StudentDetails[] | null;
  };
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

type RuleFrequencyOption = AvailabilityFrequency | 'one_time';

function formatRuleSummary(rule: AvailabilityRule): string {
  const time = `${rule.start_time.slice(0, 5)}–${rule.end_time.slice(0, 5)}`;
  switch (rule.frequency) {
    case 'daily':
      return `Every day, ${time}`;
    case 'weekly': {
      const days = (rule.days_of_week ?? []).slice().sort().map((d) => WEEKDAY_LABELS[d]).join(', ');
      return `Weekly on ${days || '—'}, ${time}`;
    }
    case 'monthly':
      return `Monthly on day ${rule.day_of_month}, ${time}`;
    case 'quarterly':
      return `Quarterly on day ${rule.day_of_month} (every 3 months), ${time}`;
    case 'yearly':
      return `Yearly on ${MONTH_NAMES[(rule.month_of_year ?? 1) - 1]} ${rule.day_of_month}, ${time}`;
    default:
      return time;
  }
}

export default function ProviderCalendar() {
  const { profile } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<PopulatedBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [proposingFor, setProposingFor] = useState<string | null>(null);
  const [proposedDate, setProposedDate] = useState('');
  const [proposedTime, setProposedTime] = useState('09:00');
  const [addingLinkFor, setAddingLinkFor] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState('');

  const [rules, setRules] = useState<AvailabilityRule[]>([]);
  const [exceptions, setExceptions] = useState<AvailabilityException[]>([]);
  const [availError, setAvailError] = useState<string | null>(null);

  const [ruleFrequency, setRuleFrequency] = useState<RuleFrequencyOption>('weekly');
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [monthOfYear, setMonthOfYear] = useState(1);
  const [oneTimeDate, setOneTimeDate] = useState('');
  const [ruleStart, setRuleStart] = useState('09:00');
  const [ruleEnd, setRuleEnd] = useState('17:00');
  const [repeatUntil, setRepeatUntil] = useState('');

  const zone = getZoneColor(profile?.role ?? 'tutor');
  const zoneColor = zone === 'tutor' ? 'var(--zone-tutor)' : 'var(--zone-coach)';

  const availLabelStyle: React.CSSProperties = {
    display: 'block', fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', color: '#334155',
  };
  const availInputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem 0.75rem', borderRadius: '8px', border: '1px solid #d8dde3',
    fontFamily: 'inherit', fontSize: '0.9rem', color: '#1e293b', background: '#fff',
  };
  const availSectionHeaderStyle: React.CSSProperties = {
    fontSize: '0.82rem', fontWeight: 700, marginBottom: '0.6rem', paddingTop: '1.1rem',
    borderTop: '1px solid #eef1f4', color: '#334155', letterSpacing: '0.01em',
  };
  const availListRowStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem',
    padding: '0.65rem 0', borderBottom: '1px solid #f2f4f6', fontSize: '0.85rem', color: '#334155', lineHeight: 1.4,
  };
  const availDeleteBtnStyle: React.CSSProperties = {
    border: 'none', background: 'none', color: '#c5221f', cursor: 'pointer', fontWeight: 700,
    fontSize: '1rem', flexShrink: 0, padding: '0.2rem 0.4rem',
  };

  const loadAvailability = () => {
    Promise.all([getMyAvailabilityRules(), getMyAvailabilityExceptions()])
      .then(([r, e]) => { setRules(r); setExceptions(e); })
      .catch((err) => setAvailError(err instanceof Error ? err.message : 'Failed to load availability'));
  };

  useEffect(() => { loadAvailability(); }, []);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));
  };

  const handleAddRule = async () => {
    setAvailError(null);
    if (ruleStart >= ruleEnd) {
      setAvailError('Start time must be before end time.');
      return;
    }
    try {
      if (ruleFrequency === 'one_time') {
        const date = oneTimeDate || toDateKey(selectedDate);
        const exc = await addAvailabilityException({ specific_date: date, is_available: true, start_time: ruleStart, end_time: ruleEnd });
        setExceptions((prev) => [...prev, exc].sort((a, b) => a.specific_date.localeCompare(b.specific_date)));
      } else {
        if (ruleFrequency === 'weekly' && selectedDays.length === 0) {
          setAvailError('Select at least one day of the week.');
          return;
        }
        if ((ruleFrequency === 'monthly' || ruleFrequency === 'quarterly' || ruleFrequency === 'yearly') && !dayOfMonth) {
          setAvailError('Enter a day of the month.');
          return;
        }
        const rule = await addAvailabilityRule({
          frequency: ruleFrequency,
          days_of_week: ruleFrequency === 'weekly' ? selectedDays : null,
          day_of_month: ['monthly', 'quarterly', 'yearly'].includes(ruleFrequency) ? dayOfMonth : null,
          month_of_year: ruleFrequency === 'yearly' ? monthOfYear : null,
          start_time: ruleStart,
          end_time: ruleEnd,
          ends_on: repeatUntil || null,
        });
        setRules((prev) => [...prev, rule]);
      }
      setSelectedDays([]);
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : 'Failed to add availability');
    }
  };

  const handleDeleteRule = async (id: string) => {
    await deleteAvailabilityRule(id);
    setRules((prev) => prev.filter((r) => r.id !== id));
  };

  const handleDeleteException = async (id: string) => {
    await deleteAvailabilityException(id);
    setExceptions((prev) => prev.filter((e) => e.id !== id));
  };

  const handleBlockDate = async () => {
    setAvailError(null);
    try {
      const exc = await addAvailabilityException({ specific_date: toDateKey(selectedDate), is_available: false, note: 'Blocked' });
      setExceptions((prev) => [...prev, exc].sort((a, b) => a.specific_date.localeCompare(b.specific_date)));
    } catch (err) {
      setAvailError(err instanceof Error ? err.message : 'Failed to block date');
    }
  };

  useEffect(() => {
    if (!profile) return;

    async function fetchBookings() {
      setLoading(true);
      const { data } = await supabase
        .from('bookings')
        .select(`
          *,
          customer:profiles!bookings_customer_id_fkey(id, first_name, last_name, email, avatar_url, student_details(*))
        `)
        .eq('provider_id', profile!.id)
        .order('session_date', { ascending: true });

      if (data) {
        setBookings(data as any as PopulatedBooking[]);
      }
      setLoading(false);
    }

    fetchBookings();
  }, [profile]);

  const updateBookingStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('bookings')
      .update({ status })
      .eq('id', id);

    if (!error) {
      setBookings(prev => prev.map(b => b.id === id ? { ...b, status: status as any } : b));
    }
  };

  const handleOpenPropose = (booking: PopulatedBooking) => {
    setProposingFor(booking.id);
    const current = new Date(booking.session_date);
    setProposedDate(toDateKey(current));
    setProposedTime(current.toTimeString().slice(0, 5));
  };

  const handleSendProposal = async (booking: PopulatedBooking) => {
    if (!proposedDate || !proposedTime) return;
    const [h, m] = proposedTime.split(':').map(Number);
    const newDate = new Date(`${proposedDate}T00:00:00`);
    newDate.setHours(h, m, 0, 0);
    await proposeNewBookingTime(booking.id, newDate.toISOString(), booking.duration_minutes);
    setBookings((prev) => prev.map((b) => b.id === booking.id
      ? { ...b, status: 'reschedule_proposed', proposed_session_date: newDate.toISOString(), proposed_duration_minutes: booking.duration_minutes }
      : b));
    setProposingFor(null);
  };

  const handleMessageStudent = async (customerId: string) => {
    const conversation = await getOrCreateConversation(customerId);
    navigate(`/dashboard/messages?c=${conversation.id}`);
  };

  const handleSaveLink = async (bookingId: string) => {
    await updateMeetingLink(bookingId, linkInput.trim());
    setBookings((prev) => prev.map((b) => b.id === bookingId ? { ...b, meeting_link: linkInput.trim() || null } : b));
    setAddingLinkFor(null);
    setLinkInput('');
  };

  // Calendar generation helpers
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();

  const days = [];
  for (let i = 0; i < firstDayOfMonth; i++) days.push(null);
  for (let i = 1; i <= daysInMonth; i++) days.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), i));

  const monthRangeExpanded = useMemo(() => {
    const rangeStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const rangeEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return expandAvailability(rules, exceptions, rangeStart, rangeEnd);
  }, [rules, exceptions, currentMonth]);

  const selectedDateRanges = useMemo(() => {
    return expandAvailability(rules, exceptions, selectedDate, selectedDate).get(toDateKey(selectedDate)) ?? [];
  }, [rules, exceptions, selectedDate]);

  // Find bookings for the selected date
  const selectedDateBookings = bookings.filter(b => {
    const d = new Date(b.session_date);
    return d.toDateString() === selectedDate.toDateString();
  });

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">My Calendar</h1>
        <p className="dashboard-page-subtitle">Manage your availability and view your upcoming student sessions.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '1.25rem', alignItems: 'start' }}>

        {/* Left column: Month View + Daily Schedule stacked together, sized to their own
            content - independent of whatever height the Availability Manager needs on the
            right, so neither column ever stretches to match the other and leaves blank space. */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

        {/* Month View - compact */}
        <div className="content-panel">
          <div className="content-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className="content-panel-title">Month View</h3>
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1))} className="btn btn-outline" style={{ padding: '0.2rem 0.6rem' }}>&lt;</button>
              <span style={{ fontWeight: 600, minWidth: '130px', textAlign: 'center', alignSelf: 'center', fontSize: '0.9rem' }}>
                {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
              </span>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1))} className="btn btn-outline" style={{ padding: '0.2rem 0.6rem' }}>&gt;</button>
            </div>
          </div>
          <div className="content-panel-body" style={{ padding: '0.75rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '0.35rem' }}>
              {WEEKDAY_LABELS.map(d => <div key={d} style={{ fontSize: '0.7rem', color: '#666', fontWeight: 600 }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {days.map((date, i) => {
                if (!date) return <div key={`empty-${i}`} style={{ minHeight: '48px', background: '#fafafa', borderRadius: '6px' }} />;

                const isSelected = selectedDate.toDateString() === date.toDateString();
                const dayBookings = bookings.filter(b => new Date(b.session_date).toDateString() === date.toDateString());
                const isToday = new Date().toDateString() === date.toDateString();
                const hasAvailability = monthRangeExpanded.has(toDateKey(date));

                return (
                  <div
                    key={i}
                    onClick={() => setSelectedDate(date)}
                    style={{
                      minHeight: '48px',
                      border: isSelected ? `2px solid ${zoneColor}` : '1px solid #eee',
                      background: isSelected ? `${zoneColor}10` : '#fff',
                      borderRadius: '6px',
                      padding: '0.3rem',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontWeight: isToday ? 800 : 500, color: isToday ? zoneColor : '#333', fontSize: '0.85rem' }}>
                        {date.getDate()}
                      </span>
                      {hasAvailability && (
                        <span title="Available" style={{ width: '6px', height: '6px', borderRadius: '50%', background: zoneColor, display: 'inline-block' }} />
                      )}
                    </div>
                    {dayBookings.length > 0 && (
                      <div style={{ marginTop: '0.2rem', fontSize: '0.65rem', padding: '1px 4px', borderRadius: '4px', display: 'inline-block', background: dayBookings.some(b => b.status === 'confirmed') ? '#e6f4ea' : '#fef7e0', color: dayBookings.some(b => b.status === 'confirmed') ? '#137333' : '#b06000' }}>
                        {dayBookings.length} booking{dayBookings.length > 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Daily Schedule - stacked below Month View, in the same column, so its height
            never depends on (or gets stretched by) the Availability Manager next to it */}
        <div className="content-panel">
          <div className="content-panel-header" style={{ display: 'block' }}>
            <h3 className="content-panel-title">Daily Schedule</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>
          <div className="content-panel-body">
            <div style={{
              marginBottom: '1rem', padding: '0.6rem 0.85rem', borderRadius: '8px', fontSize: '0.82rem',
              background: selectedDateRanges.length > 0 ? `${zoneColor}10` : '#fafafa', color: selectedDateRanges.length > 0 ? zoneColor : '#888',
            }}>
              {selectedDateRanges.length > 0
                ? `Available: ${selectedDateRanges.map(r => `${r.start.slice(0, 5)}–${r.end.slice(0, 5)}`).join(', ')}`
                : 'Not available on this date'}
            </div>

            {loading ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading schedule...</div>
            ) : selectedDateBookings.length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', background: '#fafafa', borderRadius: '8px' }}>
                <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>📭</div>
                <div style={{ color: '#666' }}>No sessions scheduled for this day.</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {selectedDateBookings.map(booking => {
                  const sessionTime = new Date(booking.session_date);
                  return (
                    <div key={booking.id} style={{
                      padding: '1rem',
                      border: '1px solid #eee',
                      borderRadius: '8px',
                      borderLeft: `4px solid ${booking.status === 'confirmed' ? '#34a853' : booking.status === 'pending' ? '#fbbc04' : booking.status === 'reschedule_proposed' ? '#4285f4' : '#ea4335'}`,
                      background: '#fff'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                        <div style={{ fontWeight: 700 }}>{sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                        <div style={{
                          fontSize: '0.75rem',
                          padding: '2px 8px',
                          borderRadius: '16px',
                          background: booking.status === 'confirmed' ? '#e6f4ea' : booking.status === 'pending' ? '#fef7e0' : booking.status === 'reschedule_proposed' ? '#e8f0fe' : '#fce8e6',
                          color: booking.status === 'confirmed' ? '#137333' : booking.status === 'pending' ? '#b06000' : booking.status === 'reschedule_proposed' ? '#1967d2' : '#c5221f',
                          textTransform: 'capitalize',
                          fontWeight: 600
                        }}>
                          {booking.status === 'reschedule_proposed' ? 'Awaiting reply' : booking.status}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', background: '#f0f2f5', flexShrink: 0,
                          backgroundImage: booking.customer?.avatar_url ? `url(${booking.customer.avatar_url})` : undefined,
                          backgroundSize: 'cover', backgroundPosition: 'center',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700, color: '#8b9bb4',
                        }}>
                          {!booking.customer?.avatar_url && `${booking.customer?.first_name?.[0] ?? ''}${booking.customer?.last_name?.[0] ?? ''}`}
                        </div>
                        <div style={{ fontSize: '0.9rem' }}>
                          <strong>Student:</strong> {booking.customer?.first_name} {booking.customer?.last_name}
                        </div>
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>
                        ⏱️ {booking.duration_minutes} Minutes
                      </div>

                      {(booking.student_topic || booking.student_note) && (
                        <div style={{ fontSize: '0.8rem', color: '#475569', background: '#f8fafc', borderRadius: '6px', padding: '0.5rem 0.6rem', marginBottom: '0.75rem' }}>
                          {booking.student_topic && <div><strong>Topic:</strong> {booking.student_topic}</div>}
                          {booking.student_note && <div style={{ marginTop: booking.student_topic ? '0.2rem' : 0 }}>{booking.student_note}</div>}
                        </div>
                      )}

                      {(() => {
                        const details = Array.isArray(booking.customer?.student_details)
                          ? booking.customer.student_details[0]
                          : booking.customer?.student_details;
                        if (!details?.student_type) return null;
                        const labels = getStudentTypeLabels(details.student_type);
                        const parts: string[] = [];
                        if (details.student_type === 'scholar') {
                          if (details.school_name) parts.push(details.school_name);
                          if (details.grade) parts.push(`Grade ${details.grade}`);
                        } else if (details.student_type === 'student') {
                          if (details.institution_name) parts.push(details.institution_name);
                          if (details.course_of_study) parts.push(details.year_of_study ? `${details.course_of_study} (Year ${details.year_of_study})` : details.course_of_study);
                        } else {
                          if (details.occupation) parts.push(details.employer ? `${details.occupation} at ${details.employer}` : details.occupation);
                          if (details.years_experience != null) parts.push(`${details.years_experience} yrs experience`);
                        }
                        if (details.subjects && details.subjects.length > 0) parts.push(`Subjects: ${details.subjects.join(', ')}`);
                        if (details.location) parts.push(details.location);
                        if (parts.length === 0) return null;
                        return (
                          <div style={{ fontSize: '0.78rem', color: '#64748b', marginBottom: '0.75rem' }}>
                            <strong>{labels.typeLabel}:</strong> {parts.join(' • ')}
                          </div>
                        );
                      })()}

                      {booking.status === 'reschedule_proposed' && booking.proposed_session_date && (
                        <div style={{ fontSize: '0.8rem', color: '#1967d2', marginBottom: '0.75rem' }}>
                          Proposed: {new Date(booking.proposed_session_date).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                        </div>
                      )}

                      {proposingFor === booking.id ? (
                        <div style={{ marginBottom: '0.75rem' }}>
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                            <input type="date" value={proposedDate} onChange={(e) => setProposedDate(e.target.value)} style={{ flex: 1, padding: '0.35rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.8rem' }} />
                            <input type="time" value={proposedTime} onChange={(e) => setProposedTime(e.target.value)} style={{ flex: 1, padding: '0.35rem', borderRadius: '6px', border: '1px solid #ddd', fontSize: '0.8rem' }} />
                          </div>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn btn-primary" style={{ flex: 1, padding: '0.35rem', fontSize: '0.8rem' }} onClick={() => handleSendProposal(booking)}>
                              Send proposal
                            </button>
                            <button className="btn btn-outline" style={{ flex: 1, padding: '0.35rem', fontSize: '0.8rem' }} onClick={() => setProposingFor(null)}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : booking.status === 'pending' && (
                        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <button
                            className="btn btn-primary"
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem', background: '#34a853', borderColor: '#34a853' }}
                            onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                          >
                            Approve
                          </button>
                          <button
                            className="btn btn-outline"
                            style={{ flex: 1, padding: '0.4rem', fontSize: '0.85rem', color: '#ea4335', borderColor: '#ea4335' }}
                            onClick={() => updateBookingStatus(booking.id, 'cancelled')}
                          >
                            Decline
                          </button>
                        </div>
                      )}
                      {proposingFor !== booking.id && booking.status === 'pending' && (
                        <button className="btn btn-outline" style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem', marginBottom: '0.5rem' }} onClick={() => handleOpenPropose(booking)}>
                          🕒 Propose different time
                        </button>
                      )}
                      {booking.status === 'confirmed' && (
                        booking.meeting_link ? (
                          <a
                            href={booking.meeting_link} target="_blank" rel="noopener noreferrer"
                            className="btn btn-primary" style={{ display: 'block', textAlign: 'center', padding: '0.4rem', fontSize: '0.85rem', marginBottom: '0.5rem' }}
                          >
                            🔗 Join Call
                          </a>
                        ) : addingLinkFor === booking.id ? (
                          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
                            <input
                              type="text" value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                              placeholder="Paste meeting link"
                              style={{ flex: 1, padding: '0.35rem', borderRadius: '6px', border: '1px solid #ddd', fontFamily: 'inherit', fontSize: '0.8rem' }}
                            />
                            <button className="btn btn-primary" style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem' }} onClick={() => handleSaveLink(booking.id)}>Save</button>
                          </div>
                        ) : (
                          <button className="btn btn-outline" style={{ width: '100%', padding: '0.4rem', fontSize: '0.85rem', marginBottom: '0.5rem' }} onClick={() => { setAddingLinkFor(booking.id); setLinkInput(''); }}>
                            + Add meeting link
                          </button>
                        )
                      )}
                      <button className="btn btn-outline" style={{ width: '100%', padding: '0.4rem', fontSize: '0.8rem' }} onClick={() => handleMessageStudent(booking.customer.id)}>
                        💬 Message {booking.customer?.first_name}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        </div>

        {/* Availability Manager */}
        <div className="content-panel">
          <div className="content-panel-header" style={{ display: 'block' }}>
            <h3 className="content-panel-title">My Availability</h3>
            <p style={{ fontSize: '0.78rem', color: '#666', marginTop: '0.2rem' }}>
              Set how often you're free. Shown to students when booking.
            </p>
          </div>
          <div className="content-panel-body" style={{ fontFamily: 'var(--font-sans, inherit)' }}>
            {availError && (
              <div style={{ background: '#fce8e6', color: '#c5221f', padding: '0.7rem 0.9rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.85rem' }}>
                {availError}
              </div>
            )}

            <label style={availLabelStyle}>Repeats</label>
            <select
              value={ruleFrequency}
              onChange={(e) => setRuleFrequency(e.target.value as RuleFrequencyOption)}
              style={{ ...availInputStyle, marginBottom: '1rem' }}
            >
              <option value="daily">Every day</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="quarterly">Quarterly</option>
              <option value="yearly">Yearly</option>
              <option value="one_time">One-time date</option>
            </select>

            {ruleFrequency === 'weekly' && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
                {WEEKDAY_LABELS.map((label, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => toggleDay(i)}
                    style={{
                      padding: '0.45rem 0.8rem', borderRadius: '16px', fontSize: '0.85rem', cursor: 'pointer',
                      fontFamily: 'inherit', fontWeight: 500,
                      border: selectedDays.includes(i) ? `1.5px solid ${zoneColor}` : '1.5px solid #e2e8f0',
                      background: selectedDays.includes(i) ? zoneColor : '#fff',
                      color: selectedDays.includes(i) ? '#fff' : '#334155',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {(ruleFrequency === 'monthly' || ruleFrequency === 'quarterly' || ruleFrequency === 'yearly') && (
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
                {ruleFrequency === 'yearly' && (
                  <div style={{ flex: 1 }}>
                    <label style={availLabelStyle}>Month</label>
                    <select value={monthOfYear} onChange={(e) => setMonthOfYear(Number(e.target.value))} style={availInputStyle}>
                      {MONTH_NAMES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}
                <div style={{ flex: 1 }}>
                  <label style={availLabelStyle}>Day of month</label>
                  <input type="number" min={1} max={31} value={dayOfMonth} onChange={(e) => setDayOfMonth(Number(e.target.value))} style={availInputStyle} />
                </div>
              </div>
            )}

            {ruleFrequency === 'one_time' && (
              <div style={{ marginBottom: '1rem' }}>
                <label style={availLabelStyle}>Date</label>
                <input
                  type="date"
                  value={oneTimeDate || toDateKey(selectedDate)}
                  onChange={(e) => setOneTimeDate(e.target.value)}
                  style={availInputStyle}
                />
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={availLabelStyle}>Start</label>
                <input type="time" value={ruleStart} onChange={(e) => setRuleStart(e.target.value)} style={availInputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={availLabelStyle}>End</label>
                <input type="time" value={ruleEnd} onChange={(e) => setRuleEnd(e.target.value)} style={availInputStyle} />
              </div>
            </div>

            {ruleFrequency !== 'one_time' && (
              <div style={{ marginBottom: '1.1rem' }}>
                <label style={availLabelStyle}>Repeat until (optional)</label>
                <input type="date" value={repeatUntil} onChange={(e) => setRepeatUntil(e.target.value)} style={availInputStyle} />
              </div>
            )}

            <button className="btn btn-primary" style={{ width: '100%', marginBottom: '0.6rem', padding: '0.7rem', fontSize: '0.9rem' }} onClick={handleAddRule}>
              Add availability
            </button>
            <button className="btn btn-outline" style={{ width: '100%', marginBottom: '1.25rem', padding: '0.6rem', fontSize: '0.85rem' }} onClick={handleBlockDate}>
              Block {selectedDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} (mark unavailable)
            </button>

            {rules.length > 0 && (
              <>
                <div style={availSectionHeaderStyle}>Recurring rules</div>
                {rules.map((rule) => (
                  <div key={rule.id} style={availListRowStyle}>
                    <span>{formatRuleSummary(rule)}</span>
                    <button onClick={() => handleDeleteRule(rule.id)} style={availDeleteBtnStyle}>&times;</button>
                  </div>
                ))}
              </>
            )}

            {exceptions.length > 0 && (
              <>
                <div style={{ ...availSectionHeaderStyle, marginTop: rules.length > 0 ? '1.1rem' : 0 }}>One-time dates &amp; blocks</div>
                {exceptions.map((exc) => (
                  <div key={exc.id} style={availListRowStyle}>
                    <span>
                      {exc.is_available
                        ? `${exc.specific_date}: ${exc.start_time?.slice(0, 5)}–${exc.end_time?.slice(0, 5)}`
                        : `${exc.specific_date}: Blocked`}
                    </span>
                    <button onClick={() => handleDeleteException(exc.id)} style={availDeleteBtnStyle}>&times;</button>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
