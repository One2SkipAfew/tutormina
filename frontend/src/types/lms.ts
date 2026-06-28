// ============================================
// TutorMina LMS — Type Definitions
// ============================================

export type UserRole = 'customer' | 'tutor' | 'coach' | 'admin';
export type UserStatus = 'pending' | 'approved' | 'declined';
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
  created_at: string;
  updated_at: string;
}

export interface ProviderDetails {
  profile_id: string;
  bio: string | null;
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
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  meeting_link: string | null;
  payment_reference: string | null;
  created_at: string;
}

// Utility
export function getZoneColor(role: UserRole): string {
  switch (role) {
    case 'tutor': return 'tutor';
    case 'coach': return 'coach';
    case 'customer': return 'student';
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
