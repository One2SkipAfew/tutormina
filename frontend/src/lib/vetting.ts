import { supabase } from './supabaseClient';
import type { ProviderDetails, WorkExperience, ProfessionalReference } from '../types/lms';

const PHOTO_BUCKET = 'professional-photos';

// ============ PHOTO ============

export async function uploadAvatar(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop();
  const storagePath = `${user.id}/photo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(PHOTO_BUCKET)
    .upload(storagePath, file, { cacheControl: '3600', upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
  return urlData.publicUrl;
}

export async function uploadProfessionalPhoto(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const publicUrl = await uploadAvatar(file);

  const { error: updateError } = await supabase
    .from('provider_details')
    .update({ avatar_url: publicUrl })
    .eq('profile_id', user.id);

  if (updateError) throw updateError;
  return publicUrl;
}

// ============ PROVIDER DETAILS ============

export type ProviderDetailsInput = Partial<Pick<ProviderDetails,
  'bio' | 'qualifications' | 'specialties' | 'years_of_experience' | 'location' | 'phone_number' |
  'contact_preference' | 'offers_in_person' | 'offers_virtual' |
  'rate_amount' | 'rate_currency' | 'rate_visible'
>>;

export async function getProviderDetails(): Promise<ProviderDetails | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('provider_details')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveProviderDetails(fields: ProviderDetailsInput): Promise<ProviderDetails> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('provider_details')
    .update(fields)
    .eq('profile_id', user.id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ WORK EXPERIENCE ============

export async function getWorkExperiences(profileId?: string): Promise<WorkExperience[]> {
  let id = profileId;
  if (!id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    id = user.id;
  }

  const { data, error } = await supabase
    .from('work_experiences')
    .select('*')
    .eq('profile_id', id)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addWorkExperience(
  entry: Pick<WorkExperience, 'company' | 'title' | 'start_date' | 'end_date' | 'description'>
): Promise<WorkExperience> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('work_experiences')
    .insert({ profile_id: user.id, ...entry })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWorkExperience(id: string): Promise<void> {
  const { error } = await supabase.from('work_experiences').delete().eq('id', id);
  if (error) throw error;
}

// ============ REFERENCES ============

export async function getReferences(profileId?: string): Promise<ProfessionalReference[]> {
  let id = profileId;
  if (!id) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');
    id = user.id;
  }

  const { data, error } = await supabase
    .from('professional_references')
    .select('*')
    .eq('profile_id', id)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function addReference(
  entry: Pick<ProfessionalReference, 'reference_name' | 'relationship' | 'contact_info' | 'comment'>
): Promise<ProfessionalReference> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('professional_references')
    .insert({ profile_id: user.id, ...entry })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteReference(id: string): Promise<void> {
  const { error } = await supabase.from('professional_references').delete().eq('id', id);
  if (error) throw error;
}

// ============ SUBMIT ============

export async function submitApplication(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Resets status to pending (covers both first submission and resubmission after a decline)
  // and clears any prior decision, so the admin queue sees it as a fresh application.
  const { error: profileError } = await supabase
    .from('profiles')
    .update({ status: 'pending', status_reason: null, reviewed_by: null, reviewed_at: null })
    .eq('id', user.id);
  if (profileError) throw profileError;

  const { error: providerError } = await supabase
    .from('provider_details')
    .update({ application_submitted_at: new Date().toISOString() })
    .eq('profile_id', user.id);
  if (providerError) throw providerError;
}
