// ============================================
// TutorMina LMS — Type Definitions
// ============================================

export type UserRole = 'customer' | 'tutor' | 'coach' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'declined' | 'suspended' | 'blocked' | 'deleted';
export type CoachType = 'behavioural' | 'executive';
export type TutorLevel = 'primary' | 'high_school' | 'university';
export type FileType = 'document' | 'video' | 'past_paper' | 'notes' | 'course_material' | 'recording' | 'other';
export type FileVisibility = 'public' | 'students_only' | 'tutors_coaches_only' | 'private';

export interface Profile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  status: UserStatus;
  status_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProviderDetails {
  profile_id: string;
  bio: string | null;
  qualifications: string | null;
  avatar_url: string | null;
  location: string | null;
  travel_radius_km: number | null;
  contact_preference: string | null;
  phone_number: string | null;
  is_tutor: boolean;
  tutor_level: TutorLevel | null;
  is_coach: boolean;
  coach_type: CoachType | null;
  offers_super_revision: boolean;
  offers_diverse_needs: boolean;
  offers_in_person: boolean;
  offers_virtual: boolean;
  rating: number | null;
  review_count: number;
  years_of_experience: number | null;
  specialties: string[] | null;
  completed_sessions: number;
  application_submitted_at: string | null;
  rate_amount: number | null;
  rate_currency: 'USD' | 'EUR' | 'ZAR';
  rate_visible: boolean;
  created_at: string;
}

export type StudentType = 'scholar' | 'student' | 'professional';

export interface StudentDetails {
  profile_id: string;
  student_type: StudentType | null;
  age: number | null;
  location: string | null;
  school_name: string | null;
  grade: string | null;
  teacher_name: string | null;
  institution_name: string | null;
  course_of_study: string | null;
  year_of_study: string | null;
  subjects: string[] | null;
  current_results: string | null;
  occupation: string | null;
  employer: string | null;
  years_experience: number | null;
  goals: string | null;
  document_url: string | null;
  document_extracted_summary: string | null;
  created_at: string;
  updated_at: string;
}

export interface LearningEvent {
  id: string;
  student_id: string;
  event_type: 'benchmark' | 'deadline' | 'submission' | 'test' | 'exam';
  title: string;
  description: string | null;
  event_date: string | null;
  status: 'upcoming' | 'completed';
  result_text: string | null;
  result_file_url: string | null;
  created_at: string;
}

export interface WorkExperience {
  id: string;
  profile_id: string;
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  created_at: string;
}

export interface ProfessionalReference {
  id: string;
  profile_id: string;
  reference_name: string;
  relationship: string | null;
  contact_info: string | null;
  comment: string | null;
  created_at: string;
}

export interface Folder {
  id: string;
  owner_id: string;
  parent_folder_id: string | null;
  name: string;
  description: string | null;
  color: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields (computed in queries)
  file_count?: number;
  subfolder_count?: number;
}

export interface SharedFile {
  id: string;
  uploaded_by: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  file_type: FileType;
  storage_path: string;
  file_url: string | null;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  mime_type: string | null;
  visibility: FileVisibility;
  shared_with_id: string | null;
  ai_summary: string | null;
  ai_insights: string[] | null;
  ai_key_topics: string[] | null;
  ai_processed_at: string | null;
  created_at: string;
  updated_at: string;
  // Virtual fields (from joins)
  uploader_name?: string;
  uploader_role?: UserRole;
}

export interface FileAccessLog {
  id: string;
  file_id: string;
  user_id: string;
  accessed_at: string;
}

export interface ResourceAlert {
  id: string;
  user_id: string;
  triggered_by: string;
  file_id: string | null;
  folder_id: string | null;
  alert_type: 'file_added' | 'file_updated' | 'folder_created';
  message: string;
  is_read: boolean;
  created_at: string;
  // Virtual fields
  triggered_by_name?: string;
}

export interface Booking {
  id: string;
  customer_id: string;
  provider_id: string;
  session_date: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled' | 'reschedule_proposed';
  meeting_link: string | null;
  payment_reference: string | null;
  student_topic: string | null;
  student_note: string | null;
  proposed_session_date: string | null;
  proposed_duration_minutes: number | null;
  cancellation_reason: string | null;
  created_at: string;
}

export type AvailabilityFrequency = 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'yearly';

export interface AvailabilityRule {
  id: string;
  provider_id: string;
  frequency: AvailabilityFrequency;
  days_of_week: number[] | null; // weekly only, 0 = Sunday .. 6 = Saturday
  day_of_month: number | null; // monthly/quarterly/yearly
  month_of_year: number | null; // yearly only, 1-12
  start_time: string; // "HH:MM:SS"
  end_time: string;
  starts_on: string; // date
  ends_on: string | null; // date
  created_at: string;
}

export interface AvailabilityException {
  id: string;
  provider_id: string;
  specific_date: string; // date
  is_available: boolean;
  start_time: string | null;
  end_time: string | null;
  note: string | null;
  created_at: string;
}

export interface Conversation {
  id: string;
  participant_one_id: string;
  participant_two_id: string;
  last_message_at: string | null;
  created_at: string;
  // Virtual fields (computed in queries)
  other_participant_name?: string;
  other_participant_role?: UserRole;
  last_message_preview?: string;
  unread_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
  // Virtual fields
  sender_name?: string;
}

export type NotificationType = 'new_message' | 'file_added' | 'file_updated' | 'folder_created' | 'booking_update';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string | null;
  body: string | null;
  link: string | null;
  related_id: string | null;
  is_read: boolean;
  created_at: string;
}

// Utility
export function getZoneColor(role: UserRole): string {
  switch (role) {
    case 'tutor': return 'tutor';
    case 'coach': return 'coach';
    case 'customer': return 'student';
    case 'admin': return 'admin';
    default: return 'student';
  }
}

export function getZoneLabel(role: UserRole): string {
  switch (role) {
    case 'tutor': return 'Tutor Zone';
    case 'coach': return 'Coach Zone';
    case 'customer': return 'Student Zone';
    case 'admin': return 'Admin Zone';
    default: return 'Dashboard';
  }
}

export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case 'tutor': return 'Tutor';
    case 'coach': return 'Coach';
    case 'customer': return 'Student';
    case 'admin': return 'Admin';
    default: return role;
  }
}

export function getFileTypeIcon(fileType: FileType): string {
  switch (fileType) {
    case 'document': return '📄';
    case 'video': return '🎬';
    case 'past_paper': return '📝';
    case 'notes': return '📒';
    case 'course_material': return '📚';
    case 'recording': return '🎙️';
    case 'other': return '📎';
    default: return '📄';
  }
}

export function formatFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatDuration(seconds: number | null): string {
  if (!seconds) return '—';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', ZAR: 'R' };

export function formatRate(amount: number | null, currency: string): string {
  if (amount == null) return '—';
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  return `${symbol}${amount.toFixed(0)}/hr`;
}

// File upload constraints
export const FILE_LIMITS = {
  MAX_FILE_SIZE_MB: 100,           // 100 MB max per file
  MAX_VIDEO_SIZE_MB: 500,          // 500 MB max for video
  MAX_VIDEO_DURATION_SECONDS: 7200, // 2 hours max
  ALLOWED_DOCUMENT_TYPES: ['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx', '.txt', '.csv'],
  ALLOWED_VIDEO_TYPES: ['.mp4', '.mov', '.avi', '.webm', '.mkv'],
  ALLOWED_IMAGE_TYPES: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'],
  ALLOWED_AUDIO_TYPES: ['.mp3', '.wav', '.m4a', '.ogg', '.flac'],
} as const;
