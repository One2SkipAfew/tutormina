import { supabase } from './supabaseClient';
import type { Booking, AvailabilityRule, AvailabilityException, AvailabilityFrequency } from '../types/lms';

export interface BookingWithProvider extends Booking {
  provider_name: string;
  provider_role: string;
  provider_avatar_url: string | null;
}

export interface BookingConflict {
  id: string;
  provider_name: string;
  session_date: string;
  duration_minutes: number;
}

// Checks the current user's OWN bookings (across every provider) for a time overlap with a
// candidate session - the only kind of "conflict" that should ever be flagged (booking the
// same student with multiple different professionals is fine; double-booking their own time
// isn't, and should be surfaced, not silently blocked).
export async function getMyBookingConflicts(
  candidateDate: Date,
  durationMinutes: number,
  excludeBookingId?: string
): Promise<BookingConflict[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('bookings')
    .select('id, session_date, duration_minutes, provider:profiles!bookings_provider_id_fkey(first_name, last_name)')
    .eq('customer_id', user.id)
    .neq('status', 'cancelled');

  if (error) throw error;

  const candidateStart = candidateDate.getTime();
  const candidateEnd = candidateStart + durationMinutes * 60000;

  return (data ?? [])
    .filter((row) => row.id !== excludeBookingId)
    .filter((row) => {
      const start = new Date(row.session_date as string).getTime();
      const end = start + (row.duration_minutes as number) * 60000;
      return candidateStart < end && candidateEnd > start;
    })
    .map((row) => {
      const provider = (Array.isArray(row.provider) ? row.provider[0] : row.provider) as { first_name: string; last_name: string } | null;
      return {
        id: row.id as string,
        provider_name: provider ? `${provider.first_name} ${provider.last_name}` : 'Unknown',
        session_date: row.session_date as string,
        duration_minutes: row.duration_minutes as number,
      };
    });
}

export async function updateMeetingLink(bookingId: string, url: string): Promise<void> {
  const { error } = await supabase.from('bookings').update({ meeting_link: url || null }).eq('id', bookingId);
  if (error) throw error;
}

export async function cancelBooking(bookingId: string, reason?: string): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled', cancellation_reason: reason?.trim() || null })
    .eq('id', bookingId);
  if (error) throw error;
}

export async function updateBooking(bookingId: string, updates: {
  session_date: string;
  duration_minutes: number;
  student_topic?: string | null;
  student_note?: string | null;
  use_video_room?: boolean;
}): Promise<void> {
  const { error } = await supabase.from('bookings').update(updates).eq('id', bookingId);
  if (error) throw error;
}

export async function markBookingCompleted(bookingId: string): Promise<void> {
  const { error } = await supabase.from('bookings').update({ status: 'completed' }).eq('id', bookingId);
  if (error) throw error;
}

// Confirmed bookings (either as customer or provider) whose end time has already passed -
// candidates for the post-session "did this happen?" completion prompt.
export async function getPastUnconfirmedBookings(): Promise<BookingWithProvider[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('bookings')
    .select('*, provider:profiles!bookings_provider_id_fkey(first_name, last_name, role, provider_details(avatar_url)), customer:profiles!bookings_customer_id_fkey(first_name, last_name)')
    .or(`customer_id.eq.${user.id},provider_id.eq.${user.id}`)
    .eq('status', 'confirmed');

  if (error) throw error;

  const now = Date.now();
  return (data ?? [])
    .filter((row) => {
      const end = new Date(row.session_date as string).getTime() + (row.duration_minutes as number) * 60000;
      return end < now;
    })
    .map((row: Record<string, unknown>) => {
      const provider = row.provider as { first_name: string; last_name: string; role: string; provider_details: { avatar_url: string | null } | { avatar_url: string | null }[] | null } | null;
      const customer = row.customer as { first_name: string; last_name: string } | null;
      const providerDetails = Array.isArray(provider?.provider_details) ? provider?.provider_details[0] : provider?.provider_details;
      const isProvider = row.provider_id === user.id;
      return {
        ...row,
        provider_name: provider ? `${provider.first_name} ${provider.last_name}` : 'Unknown',
        provider_role: provider?.role ?? 'tutor',
        provider_avatar_url: providerDetails?.avatar_url ?? null,
        other_party_name: isProvider ? (customer ? `${customer.first_name} ${customer.last_name}` : 'Unknown') : (provider ? `${provider.first_name} ${provider.last_name}` : 'Unknown'),
      } as BookingWithProvider & { other_party_name: string };
    });
}

export async function getMyBookingsAsCustomer(): Promise<BookingWithProvider[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('bookings')
    .select('*, provider:profiles!bookings_provider_id_fkey(first_name, last_name, role, provider_details(avatar_url))')
    .eq('customer_id', user.id)
    .order('session_date', { ascending: false });

  if (error) throw error;

  return (data ?? []).map((row: Record<string, unknown>) => {
    const provider = row.provider as { first_name: string; last_name: string; role: string; provider_details: { avatar_url: string | null } | { avatar_url: string | null }[] | null } | null;
    const providerDetails = Array.isArray(provider?.provider_details) ? provider?.provider_details[0] : provider?.provider_details;
    return {
      ...row,
      provider_name: provider ? `${provider.first_name} ${provider.last_name}` : 'Unknown',
      provider_role: provider?.role ?? 'tutor',
      provider_avatar_url: providerDetails?.avatar_url ?? null,
    } as BookingWithProvider;
  });
}

// ============ PROVIDER AVAILABILITY ============

export async function getAvailabilityRulesFor(providerId: string): Promise<AvailabilityRule[]> {
  const { data, error } = await supabase
    .from('provider_availability_rules')
    .select('*')
    .eq('provider_id', providerId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getAvailabilityExceptionsFor(providerId: string): Promise<AvailabilityException[]> {
  const { data, error } = await supabase
    .from('provider_availability_exceptions')
    .select('*')
    .eq('provider_id', providerId)
    .order('specific_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getMyAvailabilityRules(): Promise<AvailabilityRule[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return getAvailabilityRulesFor(user.id);
}

export async function getMyAvailabilityExceptions(): Promise<AvailabilityException[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  return getAvailabilityExceptionsFor(user.id);
}

export interface NewAvailabilityRule {
  frequency: AvailabilityFrequency;
  days_of_week?: number[] | null;
  day_of_month?: number | null;
  month_of_year?: number | null;
  start_time: string;
  end_time: string;
  starts_on?: string;
  ends_on?: string | null;
}

export async function addAvailabilityRule(rule: NewAvailabilityRule): Promise<AvailabilityRule> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('provider_availability_rules')
    .insert({
      provider_id: user.id,
      frequency: rule.frequency,
      days_of_week: rule.days_of_week ?? null,
      day_of_month: rule.day_of_month ?? null,
      month_of_year: rule.month_of_year ?? null,
      start_time: rule.start_time,
      end_time: rule.end_time,
      starts_on: rule.starts_on ?? new Date().toISOString().slice(0, 10),
      ends_on: rule.ends_on ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAvailabilityRule(id: string): Promise<void> {
  const { error } = await supabase.from('provider_availability_rules').delete().eq('id', id);
  if (error) throw error;
}

export async function addAvailabilityException(exception: {
  specific_date: string;
  is_available: boolean;
  start_time?: string | null;
  end_time?: string | null;
  note?: string | null;
}): Promise<AvailabilityException> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('provider_availability_exceptions')
    .insert({
      provider_id: user.id,
      specific_date: exception.specific_date,
      is_available: exception.is_available,
      start_time: exception.start_time ?? null,
      end_time: exception.end_time ?? null,
      note: exception.note ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteAvailabilityException(id: string): Promise<void> {
  const { error } = await supabase.from('provider_availability_exceptions').delete().eq('id', id);
  if (error) throw error;
}

// ============ BOOKING RESPONSES ============

export async function proposeNewBookingTime(
  bookingId: string,
  proposedDate: string,
  proposedDurationMinutes: number
): Promise<void> {
  const { error } = await supabase
    .from('bookings')
    .update({
      status: 'reschedule_proposed',
      proposed_session_date: proposedDate,
      proposed_duration_minutes: proposedDurationMinutes,
    })
    .eq('id', bookingId);

  if (error) throw error;
}

export async function respondToProposedTime(bookingId: string, accept: boolean): Promise<void> {
  if (accept) {
    const { data: booking, error: fetchError } = await supabase
      .from('bookings')
      .select('proposed_session_date, proposed_duration_minutes')
      .eq('id', bookingId)
      .single();

    if (fetchError) throw fetchError;

    const { error } = await supabase
      .from('bookings')
      .update({
        status: 'confirmed',
        session_date: booking.proposed_session_date,
        duration_minutes: booking.proposed_duration_minutes,
        proposed_session_date: null,
        proposed_duration_minutes: null,
      })
      .eq('id', bookingId);

    if (error) throw error;
  } else {
    const { error } = await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
    if (error) throw error;
  }
}
