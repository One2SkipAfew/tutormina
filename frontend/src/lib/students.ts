import { supabase } from './supabaseClient';

export interface MyStudent {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  session_count: number;
  last_session_date: string;
  upcoming_session_date: string | null;
}

export interface MyStudentsResult {
  students: MyStudent[];
  sessionsThisMonth: number;
}

export async function getMyStudents(): Promise<MyStudentsResult> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('bookings')
    .select('customer_id, session_date, status, customer:profiles!bookings_customer_id_fkey(id, first_name, last_name, email, avatar_url)')
    .eq('provider_id', user.id)
    .neq('status', 'cancelled')
    .order('session_date', { ascending: false });

  if (error) throw error;

  const now = new Date();
  const byStudent = new Map<string, MyStudent>();
  let sessionsThisMonth = 0;

  for (const row of data ?? []) {
    const customer = (Array.isArray(row.customer) ? row.customer[0] : row.customer) as
      { id: string; first_name: string; last_name: string; email: string; avatar_url: string | null } | null;
    if (!customer) continue;

    const sessionDate = new Date(row.session_date as string);
    if (sessionDate.getMonth() === now.getMonth() && sessionDate.getFullYear() === now.getFullYear()) {
      sessionsThisMonth += 1;
    }

    const existing = byStudent.get(customer.id);
    if (existing) {
      existing.session_count += 1;
      if (sessionDate > new Date(existing.last_session_date)) existing.last_session_date = row.session_date as string;
      if (sessionDate > now && (!existing.upcoming_session_date || sessionDate < new Date(existing.upcoming_session_date))) {
        existing.upcoming_session_date = row.session_date as string;
      }
    } else {
      byStudent.set(customer.id, {
        id: customer.id,
        first_name: customer.first_name,
        last_name: customer.last_name,
        email: customer.email,
        avatar_url: customer.avatar_url,
        session_count: 1,
        last_session_date: row.session_date as string,
        upcoming_session_date: sessionDate > now ? (row.session_date as string) : null,
      });
    }
  }

  return {
    students: Array.from(byStudent.values()).sort((a, b) => new Date(b.last_session_date).getTime() - new Date(a.last_session_date).getTime()),
    sessionsThisMonth,
  };
}
