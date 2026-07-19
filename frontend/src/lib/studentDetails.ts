import { supabase } from './supabaseClient';
import type { StudentDetails, StudentType } from '../types/lms';

const DOCUMENT_BUCKET = 'shared-drive';

export type StudentDetailsInput = Partial<Pick<StudentDetails,
  'student_type' | 'age' | 'location' |
  'school_name' | 'grade' | 'teacher_name' |
  'institution_name' | 'course_of_study' | 'year_of_study' |
  'subjects' | 'current_results' |
  'occupation' | 'employer' | 'years_experience' | 'goals' |
  'document_url' | 'document_extracted_summary'
>>;

export async function getStudentDetails(): Promise<StudentDetails | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('student_details')
    .select('*')
    .eq('profile_id', user.id)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveStudentDetails(input: StudentDetailsInput): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('student_details')
    .upsert({ profile_id: user.id, ...input, updated_at: new Date().toISOString() });

  if (error) throw error;
}

export async function uploadStudentDocument(file: File): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const ext = file.name.split('.').pop();
  const storagePath = `${user.id}/student-document_${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, file, { cacheControl: '3600', upsert: false });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(DOCUMENT_BUCKET).getPublicUrl(storagePath);
  return urlData.publicUrl;
}

export async function extractDocumentInsights(file: File): Promise<string> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/summarise-file', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      return data.summary as string;
    }
  } catch {
    // Fall through to the same demo-mode placeholder AIInsights.tsx uses when the ai-api
    // service isn't reachable - the endpoint itself is still a TODO stub either way.
  }
  return `[AI Summary Placeholder] Summary of "${file.name}". Connect a real document-parsing model in ai-api to enable extraction.`;
}

interface StudentTypeLabels {
  typeLabel: string;
  institutionLabel: string;
  institutionField: 'school_name' | 'institution_name' | null;
  subLabel: string; // grade / course
  subField: 'grade' | 'course_of_study' | null;
  contactLabel: string; // teacher's name / year of study
  contactField: 'teacher_name' | 'year_of_study' | null;
  documentLabel: string; // Report / Transcript
}

export function getStudentTypeLabels(type: StudentType | null | undefined): StudentTypeLabels {
  if (type === 'scholar') {
    return {
      typeLabel: 'Scholar',
      institutionLabel: 'School name',
      institutionField: 'school_name',
      subLabel: 'Grade',
      subField: 'grade',
      contactLabel: "Teacher's name",
      contactField: 'teacher_name',
      documentLabel: 'Report',
    };
  }
  if (type === 'student') {
    return {
      typeLabel: 'Student',
      institutionLabel: 'Institution name',
      institutionField: 'institution_name',
      subLabel: 'Course / programme',
      subField: 'course_of_study',
      contactLabel: 'Year of study',
      contactField: 'year_of_study',
      documentLabel: 'Transcript',
    };
  }
  return {
    typeLabel: 'Professional',
    institutionLabel: '',
    institutionField: null,
    subLabel: '',
    subField: null,
    contactLabel: '',
    contactField: null,
    documentLabel: '',
  };
}
