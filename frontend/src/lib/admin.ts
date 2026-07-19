import { supabase } from './supabaseClient';
import type { Profile, ProviderDetails, WorkExperience, ProfessionalReference, UserStatus, UserRole } from '../types/lms';

const STATUS_EMAIL_COPY: Record<string, { subject: string; body: (reason?: string | null) => string }> = {
  approved: {
    subject: 'Your TutorMina application has been approved',
    body: () => 'Congratulations! Your application to join TutorMina has been approved. You can now log in and start using your dashboard.',
  },
  declined: {
    subject: 'Your TutorMina application was declined',
    body: (reason) => `Your application to join TutorMina was not approved at this time.${reason ? ` Reason: ${reason}` : ''} You're welcome to update your application and resubmit.`,
  },
  suspended: {
    subject: 'Your TutorMina account has been suspended',
    body: (reason) => `Your account has been temporarily suspended.${reason ? ` Reason: ${reason}` : ''}`,
  },
  blocked: {
    subject: 'Your TutorMina account has been blocked',
    body: (reason) => `Your account has been blocked.${reason ? ` Reason: ${reason}` : ''}`,
  },
  deleted: {
    subject: 'Your TutorMina account has been deactivated',
    body: (reason) => `Your account has been deactivated.${reason ? ` Reason: ${reason}` : ''}`,
  },
  approved_reactivation: {
    subject: 'Your TutorMina account is active again',
    body: () => 'Your account has been reactivated and you can log in as normal.',
  },
};

async function sendStatusEmail(profile: Profile, status: UserStatus, reason?: string | null, wasReactivation = false) {
  const key = wasReactivation ? 'approved_reactivation' : status;
  const copy = STATUS_EMAIL_COPY[key];
  if (!copy) return;

  try {
    await fetch('/api/send-application-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: profile.email, subject: copy.subject, body: copy.body(reason) }),
    });
  } catch (err) {
    // Email is best-effort - the in-app notification (DB trigger) is the source of truth.
    console.warn('Failed to send status email:', err);
  }
}

// ============ APPLICATIONS ============

export interface ApplicationSummary extends Profile {
  provider_details: ProviderDetails;
}

export async function getPendingApplications(): Promise<ApplicationSummary[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, provider_details!inner(*)')
    .in('role', ['tutor', 'coach'])
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((row: Record<string, unknown>) => {
      const details = row.provider_details as ProviderDetails | ProviderDetails[];
      const d = Array.isArray(details) ? details[0] : details;
      return !!d?.application_submitted_at;
    })
    .map((row: Record<string, unknown>) => {
      const details = row.provider_details as ProviderDetails | ProviderDetails[];
      return { ...row, provider_details: Array.isArray(details) ? details[0] : details } as ApplicationSummary;
    });
}

export interface ApplicationDetail {
  profile: Profile;
  providerDetails: ProviderDetails | null;
  workExperiences: WorkExperience[];
  references: ProfessionalReference[];
}

export async function getApplicationDetail(profileId: string): Promise<ApplicationDetail> {
  const [profileRes, providerRes, weRes, refRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', profileId).single(),
    supabase.from('provider_details').select('*').eq('profile_id', profileId).maybeSingle(),
    supabase.from('work_experiences').select('*').eq('profile_id', profileId).order('start_date', { ascending: false }),
    supabase.from('professional_references').select('*').eq('profile_id', profileId),
  ]);

  if (profileRes.error) throw profileRes.error;

  return {
    profile: profileRes.data,
    providerDetails: providerRes.data,
    workExperiences: weRes.data ?? [],
    references: refRes.data ?? [],
  };
}

export async function reviewApplication(
  profileId: string,
  decision: 'approved' | 'declined',
  reason?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      status: decision,
      status_reason: reason ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  await sendStatusEmail(updated, decision, reason);
}

// ============ ACCOUNTS ============

export interface AccountFilters {
  role?: UserRole;
  status?: UserStatus;
  search?: string;
}

export async function getAllAccounts(filters: AccountFilters = {}): Promise<Profile[]> {
  let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });

  if (filters.role) query = query.eq('role', filters.role);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.search) query = query.or(`first_name.ilike.%${filters.search}%,last_name.ilike.%${filters.search}%,email.ilike.%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateAccountStatus(
  profileId: string,
  status: 'suspended' | 'blocked' | 'deleted' | 'approved',
  reason?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: updated, error } = await supabase
    .from('profiles')
    .update({
      status,
      status_reason: reason ?? null,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', profileId)
    .select()
    .single();

  if (error) throw error;
  await sendStatusEmail(updated, status, reason, status === 'approved');
}

// ============ DASHBOARD OVERVIEW ============

export interface AdminDashboardStats {
  pendingApplications: number;
  totalAccounts: number;
  approvedProfessionals: number;
  suspendedOrBlocked: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const [pending, total, approvedPros, suspendedBlocked] = await Promise.all([
    getPendingApplications(),
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('role', ['tutor', 'coach']).eq('status', 'approved'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).in('status', ['suspended', 'blocked']),
  ]);

  return {
    pendingApplications: pending.length,
    totalAccounts: total.count ?? 0,
    approvedProfessionals: approvedPros.count ?? 0,
    suspendedOrBlocked: suspendedBlocked.count ?? 0,
  };
}

export interface AdminActivityItem {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  status_reason: string | null;
  reviewed_at: string;
}

export async function getRecentAdminActivity(limit = 8): Promise<AdminActivityItem[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, role, status, status_reason, reviewed_at')
    .eq('reviewed_by', user.id)
    .not('reviewed_at', 'is', null)
    .order('reviewed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}
