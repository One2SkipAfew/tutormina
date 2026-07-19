import { supabase } from './supabaseClient';
import type { LearningEvent } from '../types/lms';
import { getMyBookingsAsCustomer } from './bookings';
import { uploadFile } from './sharedDrive';

export interface NewLearningEvent {
  event_type: LearningEvent['event_type'];
  title: string;
  description?: string | null;
  event_date?: string | null;
}

export async function getMyLearningEvents(): Promise<LearningEvent[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('learning_events')
    .select('*')
    .eq('student_id', user.id)
    .order('event_date', { ascending: true, nullsFirst: false });

  if (error) throw error;
  return data ?? [];
}

export async function addLearningEvent(input: NewLearningEvent): Promise<LearningEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('learning_events')
    .insert({
      student_id: user.id,
      event_type: input.event_type,
      title: input.title,
      description: input.description || null,
      event_date: input.event_date || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function logEventResult(id: string, resultText: string, resultFileUrl?: string | null): Promise<void> {
  const { error } = await supabase
    .from('learning_events')
    .update({ status: 'completed', result_text: resultText || null, result_file_url: resultFileUrl || null })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteLearningEvent(id: string): Promise<void> {
  const { error } = await supabase.from('learning_events').delete().eq('id', id);
  if (error) throw error;
}

export interface MyTutor {
  id: string;
  name: string;
  avatar_url: string | null;
}

// Distinct tutors/coaches the student has an actual booking with - who a submission can be
// sent to.
export async function getMyTutors(): Promise<MyTutor[]> {
  const bookings = await getMyBookingsAsCustomer();
  const byId = new Map<string, MyTutor>();
  for (const b of bookings) {
    if (!byId.has(b.provider_id)) {
      byId.set(b.provider_id, { id: b.provider_id, name: b.provider_name, avatar_url: b.provider_avatar_url });
    }
  }
  return Array.from(byId.values());
}

export async function submitFileToProvider(file: File, providerId: string, title: string): Promise<void> {
  await uploadFile(file, {
    title,
    file_type: 'document',
    visibility: 'private',
    sharedWithId: providerId,
  });
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

// Consecutive weeks (including the current week) with at least one completed session.
export async function getLearningStreak(): Promise<number> {
  const bookings = await getMyBookingsAsCustomer();
  const completedWeeks = new Set(
    bookings.filter((b) => b.status === 'completed').map((b) => getWeekStart(new Date(b.session_date)).getTime())
  );

  let streak = 0;
  const cursor = getWeekStart(new Date());
  while (completedWeeks.has(cursor.getTime())) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}
