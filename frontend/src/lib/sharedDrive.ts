import { supabase } from './supabaseClient';
import type { SharedFile, Folder, FileType, FileVisibility, ResourceAlert } from '../types/lms';
import { FILE_LIMITS, getAllowedExtensionsForType } from '../types/lms';

const STORAGE_BUCKET = 'shared-drive';

// ============ FOLDERS ============

export async function createFolder(
  name: string,
  parentFolderId: string | null = null,
  description: string | null = null,
  color: string | null = null,
  folderType: FileType | null = null
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
      folder_type: folderType,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getFolders(parentFolderId: string | null = null, ownerId?: string, folderType?: FileType | ''): Promise<Folder[]> {
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

  if (folderType) {
    query = query.eq('folder_type', folderType);
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

export function validateFile(file: File, fileType: FileType): string | null {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  const isLargeMedia = fileType === 'video' || fileType === 'recording';
  const maxSize = isLargeMedia ? FILE_LIMITS.MAX_VIDEO_SIZE_MB : FILE_LIMITS.MAX_FILE_SIZE_MB;
  const fileSizeMB = file.size / (1024 * 1024);

  if (fileSizeMB > maxSize) {
    return `File is too large (${fileSizeMB.toFixed(1)} MB). Maximum is ${maxSize} MB${isLargeMedia ? ' for media' : ''}.`;
  }

  const allAllowed = getAllowedExtensionsForType(fileType);

  if (!(allAllowed as readonly string[]).includes(ext)) {
    return `File type "${ext}" is not supported for ${fileType.replace('_', ' ')}. Allowed: ${allAllowed.join(', ')}`;
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
  const validationError = validateFile(file, metadata.file_type);
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
      contentType: file.type || undefined,
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

// ============ DOWNLOAD ============

/**
 * Map a MIME type to a sensible file extension.
 * Falls back to extracting the extension from the storage_path.
 */
function resolveExtension(mimeType: string | null, storagePath: string): string {
  // Try to extract from the storage path first (most reliable)
  const pathExt = storagePath.split('.').pop()?.toLowerCase();
  if (pathExt && pathExt.length <= 5 && pathExt !== storagePath) {
    return '.' + pathExt;
  }
  // Fall back to MIME type mapping
  const mimeMap: Record<string, string> = {
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-powerpoint': '.ppt',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
    'text/plain': '.txt',
    'text/csv': '.csv',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'video/quicktime': '.mov',
    'audio/mpeg': '.mp3',
    'audio/wav': '.wav',
    'audio/ogg': '.ogg',
    'application/zip': '.zip',
    'application/x-rar-compressed': '.rar',
  };
  return mimeType ? (mimeMap[mimeType] ?? '') : '';
}

/**
 * Download a SharedFile with the correct filename and extension.
 * Fetches the file as a blob so the browser saves it with the right name,
 * regardless of what the public URL's Content-Disposition says.
 */
export async function downloadFile(file: { file_url: string | null; storage_path: string; title: string; mime_type: string | null }): Promise<void> {
  if (!file.file_url) throw new Error('No file URL available');

  const ext = resolveExtension(file.mime_type, file.storage_path);
  // Sanitise title for use as a filename
  const safeName = file.title.replace(/[/\\?%*:|"<>]/g, '-');
  const downloadName = safeName.endsWith(ext) ? safeName : safeName + ext;

  const response = await fetch(file.file_url);
  if (!response.ok) throw new Error(`Download failed: ${response.statusText}`);

  const blob = await response.blob();
  // Use the stored mime_type if available, otherwise fall back to what the server returned
  const blobType = file.mime_type || blob.type;
  const typedBlob = blobType ? new Blob([blob], { type: blobType }) : blob;

  const objectUrl = URL.createObjectURL(typedBlob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = downloadName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke after a short delay to let the download start
  setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
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

// ============ STUDENT RESOURCE ACCESS CONTROL ============

export async function grantStudentResourceAccess(
  studentId: string,
  options: {
    grantAll?: boolean;
    fileIds?: string[];
    providerId?: string;
  } = {}
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const providerId = options.providerId || user.id;

  // Clear existing grants for this student and provider first to avoid duplicates
  await supabase
    .from('student_resource_access')
    .delete()
    .eq('student_id', studentId)
    .eq('provider_id', providerId);

  if (options.grantAll) {
    const { error } = await supabase.from('student_resource_access').insert({
      student_id: studentId,
      provider_id: providerId,
      grant_all: true,
      file_id: null,
    });
    if (error) throw error;
  } else if (options.fileIds && options.fileIds.length > 0) {
    const rows = options.fileIds.map((fileId) => ({
      student_id: studentId,
      provider_id: providerId,
      grant_all: false,
      file_id: fileId,
    }));
    const { error } = await supabase.from('student_resource_access').insert(rows);
    if (error) throw error;
  }
}

export async function getStudentResourceGrants(studentId: string, providerId?: string): Promise<{ grantAll: boolean; fileIds: string[] }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const pid = providerId || user.id;

  const { data, error } = await supabase
    .from('student_resource_access')
    .select('*')
    .eq('student_id', studentId)
    .eq('provider_id', pid);

  if (error) throw error;

  const grantAll = (data ?? []).some((r) => r.grant_all);
  const fileIds = (data ?? []).filter((r) => !r.grant_all && r.file_id).map((r) => r.file_id as string);

  return { grantAll, fileIds };
}

export async function revokeStudentResourceAccess(studentId: string, providerId?: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const pid = providerId || user.id;

  const { error } = await supabase
    .from('student_resource_access')
    .delete()
    .eq('student_id', studentId)
    .eq('provider_id', pid);

  if (error) throw error;
}

