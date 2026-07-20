import { supabase } from './supabaseClient';
import type { SharedFile, Folder, FileType, FileVisibility, ResourceAlert } from '../types/lms';
import { FILE_LIMITS } from '../types/lms';

const STORAGE_BUCKET = 'shared-drive';

// ============ FOLDERS ============

export async function createFolder(
  name: string,
  parentFolderId: string | null = null,
  description: string | null = null,
  color: string | null = null
): Promise<Folder> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('folders')
    .insert({
      owner_id: user.id,
      parent_folder_id: parentFolderId,
      name,
      description,
      color,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFolders(parentFolderId: string | null = null, ownerId?: string): Promise<Folder[]> {
  let query = supabase
    .from('folders')
    .select('*')
    .order('name', { ascending: true });

  if (parentFolderId === null) {
    query = query.is('parent_folder_id', null);
  } else {
    query = query.eq('parent_folder_id', parentFolderId);
  }

  if (ownerId) {
    query = query.eq('owner_id', ownerId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function updateFolder(folderId: string, updates: Partial<Pick<Folder, 'name' | 'description' | 'color'>>): Promise<Folder> {
  const { data, error } = await supabase
    .from('folders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', folderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await supabase
    .from('folders')
    .delete()
    .eq('id', folderId);

  if (error) throw error;
}

// ============ FILES ============

export function validateFile(file: File): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const isVideo = (FILE_LIMITS.ALLOWED_VIDEO_TYPES as readonly string[]).includes(ext);
  const maxSize = isVideo ? FILE_LIMITS.MAX_VIDEO_SIZE_MB : FILE_LIMITS.MAX_FILE_SIZE_MB;
  const fileSizeMB = file.size / (1024 * 1024);

  if (fileSizeMB > maxSize) {
    return `File is too large (${fileSizeMB.toFixed(1)} MB). Maximum is ${maxSize} MB${isVideo ? ' for videos' : ''}.`;
  }

  const allAllowed = [
    ...FILE_LIMITS.ALLOWED_DOCUMENT_TYPES,
    ...FILE_LIMITS.ALLOWED_VIDEO_TYPES,
    ...FILE_LIMITS.ALLOWED_IMAGE_TYPES,
    ...FILE_LIMITS.ALLOWED_AUDIO_TYPES,
  ];

  if (!(allAllowed as readonly string[]).includes(ext)) {
    return `File type "${ext}" is not supported. Allowed: ${allAllowed.join(', ')}`;
  }

  return null;
}

export async function uploadFile(
  file: File,
  metadata: {
    title: string;
    description?: string;
    file_type: FileType;
    folder_id?: string;
    visibility?: FileVisibility;
    duration_seconds?: number;
    sharedWithId?: string;
  }
): Promise<SharedFile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Validate
  const validationError = validateFile(file);
  if (validationError) throw new Error(validationError);

  // Upload to storage
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${user.id}/${timestamp}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data: urlData } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(storagePath);

  // Insert DB record
  const { data, error } = await supabase
    .from('shared_files')
    .insert({
      uploaded_by: user.id,
      folder_id: metadata.folder_id || null,
      title: metadata.title,
      description: metadata.description || null,
      file_type: metadata.file_type,
      storage_path: storagePath,
      file_url: urlData.publicUrl,
      file_size_bytes: file.size,
      duration_seconds: metadata.duration_seconds || null,
      mime_type: file.type,
      visibility: metadata.visibility || 'public',
      shared_with_id: metadata.sharedWithId || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFiles(options: {
  folderId?: string | null;
  fileType?: FileType;
  visibility?: FileVisibility;
  uploadedBy?: string;
  sharedWithId?: string;
  search?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<SharedFile[]> {
  let query = supabase
    .from('shared_files')
    .select('*, profiles!shared_files_uploaded_by_fkey(first_name, last_name, role)')
    .order('created_at', { ascending: false });

  if (options.folderId !== undefined) {
    if (options.folderId === null) {
      query = query.is('folder_id', null);
    } else {
      query = query.eq('folder_id', options.folderId);
    }
  }

  if (options.fileType) query = query.eq('file_type', options.fileType);
  if (options.visibility) query = query.eq('visibility', options.visibility);
  if (options.uploadedBy) query = query.eq('uploaded_by', options.uploadedBy);
  if (options.sharedWithId) query = query.eq('shared_with_id', options.sharedWithId);
  if (options.search) query = query.ilike('title', `%${options.search}%`);
  if (options.limit) query = query.limit(options.limit);
  if (options.offset) query = query.range(options.offset, options.offset + (options.limit || 20) - 1);

  const { data, error } = await query;
  if (error) throw error;

  // Map joined data
  return (data ?? []).map((file: Record<string, unknown>) => {
    const profiles = file.profiles as { first_name: string; last_name: string; role: string } | null;
    return {
      ...file,
      uploader_name: profiles
        ? `${profiles.first_name} ${profiles.last_name}`
        : 'Unknown',
      uploader_role: profiles?.role ?? 'customer',
    } as SharedFile;
  });
}

export async function getFileById(fileId: string): Promise<SharedFile | null> {
  const { data, error } = await supabase
    .from('shared_files')
    .select('*, profiles!shared_files_uploaded_by_fkey(first_name, last_name, role)')
    .eq('id', fileId)
    .single();

  if (error) return null;

  const profiles = data.profiles as { first_name: string; last_name: string; role: string } | null;
  return {
    ...data,
    uploader_name: profiles ? `${profiles.first_name} ${profiles.last_name}` : 'Unknown',
    uploader_role: profiles?.role ?? 'customer',
  } as SharedFile;
}

export async function deleteFile(fileId: string): Promise<void> {
  // Get storage path first
  const { data: file } = await supabase
    .from('shared_files')
    .select('storage_path')
    .eq('id', fileId)
    .single();

  if (file?.storage_path) {
    await supabase.storage.from(STORAGE_BUCKET).remove([file.storage_path]);
  }

  const { error } = await supabase.from('shared_files').delete().eq('id', fileId);
  if (error) throw error;
}

export async function updateFile(
  fileId: string,
  updates: Partial<Pick<SharedFile, 'title' | 'description' | 'file_type' | 'visibility' | 'folder_id' | 'ai_summary' | 'ai_insights' | 'ai_key_topics'>>
): Promise<SharedFile> {
  const { data, error } = await supabase
    .from('shared_files')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', fileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============ FILE ACCESS LOG ============

export async function logFileAccess(fileId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase.from('file_access_log').insert({
    file_id: fileId,
    user_id: user.id,
  });
}

// ============ ALERTS ============

export async function getAlerts(unreadOnly = false): Promise<ResourceAlert[]> {
  let query = supabase
    .from('resource_alerts')
    .select('*, profiles!resource_alerts_triggered_by_fkey(first_name, last_name)')
    .order('created_at', { ascending: false })
    .limit(50);

  if (unreadOnly) query = query.eq('is_read', false);

  const { data, error } = await query;
  if (error) throw error;

  return (data ?? []).map((alert: Record<string, unknown>) => {
    const profiles = alert.profiles as { first_name: string; last_name: string } | null;
    return {
      ...alert,
      triggered_by_name: profiles
        ? `${profiles.first_name} ${profiles.last_name}`
        : 'Unknown',
    } as ResourceAlert;
  });
}

export async function markAlertRead(alertId: string): Promise<void> {
  await supabase.from('resource_alerts').update({ is_read: true }).eq('id', alertId);
}

export async function markAllAlertsRead(): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from('resource_alerts').update({ is_read: true }).eq('user_id', user.id).eq('is_read', false);
}
