import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createFolder, getFolders, deleteFolder, updateFolder } from '../../lib/sharedDrive';
import { getFiles, uploadFile, deleteFile as deleteSharedFile } from '../../lib/sharedDrive';
import { getZoneColor, getFileTypeIcon, formatFileSize } from '../../types/lms';
import type { Folder, SharedFile, FileType, FileVisibility } from '../../types/lms';
import '../../styles/shared-drive.css';

export default function ResourceManager() {
  const { profile } = useAuth();
  const role = profile?.role ?? 'customer';
  const zone = getZoneColor(role);

  // State
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'My Resources' }
  ]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  // Upload state
  const [uploadFile_, setUploadFile_] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadType, setUploadType] = useState<FileType>('document');
  const [uploadVisibility, setUploadVisibility] = useState<FileVisibility>('public');
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Edit folder
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  const zoneColor = zone === 'tutor' ? 'var(--zone-tutor)' : zone === 'coach' ? 'var(--zone-coach)' : 'var(--zone-student)';

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [folderData, fileData] = await Promise.all([
        getFolders(currentFolderId, profile.id),
        getFiles({ folderId: currentFolderId, uploadedBy: profile.id }),
      ]);
      setFolders(folderData);
      setFiles(fileData);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, profile]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Navigate into folder
  const navigateToFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  // Navigate to breadcrumb
  const navigateToBreadcrumb = (index: number) => {
    const target = folderPath[index];
    setCurrentFolderId(target.id);
    setFolderPath(prev => prev.slice(0, index + 1));
  };

  // Create folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;
    try {
      await createFolder(newFolderName.trim(), currentFolderId, newFolderDesc || null);
      setShowNewFolder(false);
      setNewFolderName('');
      setNewFolderDesc('');
      loadData();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  // Delete folder
  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm('Delete this folder and all its contents?')) return;
    try {
      await deleteFolder(folderId);
      loadData();
    } catch (err) {
      console.error('Failed to delete folder:', err);
    }
  };

  // Rename folder
  const handleRenameFolder = async () => {
    if (!editingFolder || !editFolderName.trim()) return;
    try {
      await updateFolder(editingFolder.id, { name: editFolderName.trim() });
      setEditingFolder(null);
      loadData();
    } catch (err) {
      console.error('Failed to rename folder:', err);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!uploadFile_ || !uploadTitle.trim()) return;
    setUploading(true);
    setUploadError(null);
    try {
      await uploadFile(uploadFile_, {
        title: uploadTitle.trim(),
        description: uploadDesc || undefined,
        file_type: uploadType,
        folder_id: currentFolderId || undefined,
        visibility: uploadVisibility,
      });
      setShowUpload(false);
      setUploadFile_(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadType('document');
      setUploadVisibility('public');
      loadData();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  // Delete file
  const handleDeleteFile = async (fileId: string) => {
    if (!confirm('Delete this file permanently?')) return;
    try {
      await deleteSharedFile(fileId);
      loadData();
    } catch (err) {
      console.error('Failed to delete file:', err);
    }
  };

  // File input handler
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadFile_(file);
      if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ''));
      // Auto-detect type
      if (file.type.startsWith('video/')) setUploadType('video');
      else if (file.type.startsWith('audio/')) setUploadType('recording');
      else if (file.type.includes('pdf')) setUploadType('document');
    }
  };



  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">
          {role === 'tutor' ? '📂 My Resources' : '📂 My Resources'}
        </h1>
        <p className="dashboard-page-subtitle">
          Organise your teaching materials into folders. Students will see resources you share.
        </p>
      </div>

      {/* Controls */}
      <div className="drive-controls">
        <div className="drive-controls-left">
          {/* Breadcrumb */}
          <div className="drive-path">
            {folderPath.map((crumb, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {i > 0 && <span className="drive-path-separator">›</span>}
                <span
                  className={`drive-path-item ${i === folderPath.length - 1 ? 'current' : ''}`}
                  onClick={() => navigateToBreadcrumb(i)}
                >
                  {crumb.name}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="drive-controls-right">
          <button
            className="btn btn-outline"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem' }}
            onClick={() => setShowNewFolder(true)}
          >
            📁 New Folder
          </button>
          <button
            className="btn btn-primary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', background: zoneColor }}
            onClick={() => setShowUpload(true)}
          >
            ⬆️ Upload File
          </button>
          <div className="view-toggle">
            <button
              className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid view"
            >⊞</button>
            <button
              className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List view"
            >☰</button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Loading...</div>
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="content-panel">
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <div className="empty-state-title">No resources yet</div>
            <div className="empty-state-text">
              Create a folder to organise your materials, or upload a file directly.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => setShowNewFolder(true)}>
                📁 New Folder
              </button>
              <button className="btn btn-primary" onClick={() => setShowUpload(true)} style={{ background: zoneColor }}>
                ⬆️ Upload
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className={`file-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
          {/* Folders */}
          {folders.map(folder => (
            <div
              key={folder.id}
              className="folder-card"
              onClick={() => navigateToFolder(folder)}
            >
              <div className="folder-card-icon">📁</div>
              <div className="folder-card-name">{folder.name}</div>
              {folder.description && (
                <div className="folder-card-count">{folder.description}</div>
              )}
              <div className="folder-card-menu">
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem' }}
                  onClick={e => {
                    e.stopPropagation();
                    setEditingFolder(folder);
                    setEditFolderName(folder.name);
                  }}
                  title="Rename"
                >✏️</button>
                <button
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.9rem', padding: '0.25rem' }}
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                  title="Delete"
                >🗑️</button>
              </div>
            </div>
          ))}

          {/* Files */}
          {files.map(file => (
            <div key={file.id} className="file-card">
              <div className={`file-card-thumbnail ${file.file_type}`}>
                {getFileTypeIcon(file.file_type)}
                <span className="file-card-type-badge">{file.file_type.replace('_', ' ')}</span>
              </div>
              <div className="file-card-body">
                <div className="file-card-title">{file.title}</div>
                <div className="file-card-meta">
                  <span>{formatFileSize(file.file_size_bytes)}</span>
                  <span>•</span>
                  <span>{new Date(file.created_at).toLocaleDateString()}</span>
                </div>
                {file.ai_summary && <div className="file-card-ai-badge">✨ AI Summary</div>}
              </div>
              <button
                style={{
                  position: 'absolute', top: '0.5rem', right: '0.5rem',
                  background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff',
                  borderRadius: '4px', padding: '0.15rem 0.35rem', cursor: 'pointer',
                  fontSize: '0.7rem', opacity: 0, transition: 'opacity 0.15s',
                }}
                onMouseOver={e => (e.currentTarget.style.opacity = '1')}
                onMouseOut={e => (e.currentTarget.style.opacity = '0')}
                onClick={() => handleDeleteFile(file.id)}
                title="Delete file"
              >🗑️</button>
            </div>
          ))}
        </div>
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <div className="upload-modal-overlay" onClick={() => setShowNewFolder(false)}>
          <div className="upload-modal new-folder-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-header">
              <h3 className="upload-modal-title">📁 New Folder</h3>
              <button className="upload-modal-close" onClick={() => setShowNewFolder(false)}>×</button>
            </div>
            <div className="upload-modal-body">
              <div className="upload-form-group">
                <label className="upload-form-label">Folder Name</label>
                <input
                  className="upload-form-input"
                  type="text"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  placeholder="e.g. Mathematics Grade 12"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
                />
              </div>
              <div className="upload-form-group">
                <label className="upload-form-label">Description (optional)</label>
                <input
                  className="upload-form-input"
                  type="text"
                  value={newFolderDesc}
                  onChange={e => setNewFolderDesc(e.target.value)}
                  placeholder="Brief description of this folder's contents"
                />
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-outline" onClick={() => setShowNewFolder(false)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreateFolder}
                disabled={!newFolderName.trim()}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: zoneColor }}
              >
                Create Folder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rename Folder Modal */}
      {editingFolder && (
        <div className="upload-modal-overlay" onClick={() => setEditingFolder(null)}>
          <div className="upload-modal new-folder-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-header">
              <h3 className="upload-modal-title">✏️ Rename Folder</h3>
              <button className="upload-modal-close" onClick={() => setEditingFolder(null)}>×</button>
            </div>
            <div className="upload-modal-body">
              <div className="upload-form-group">
                <label className="upload-form-label">Folder Name</label>
                <input
                  className="upload-form-input"
                  type="text"
                  value={editFolderName}
                  onChange={e => setEditFolderName(e.target.value)}
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleRenameFolder()}
                />
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingFolder(null)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleRenameFolder}
                disabled={!editFolderName.trim()}
                style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', background: zoneColor }}
              >
                Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload File Modal */}
      {showUpload && (
        <div className="upload-modal-overlay" onClick={() => setShowUpload(false)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-header">
              <h3 className="upload-modal-title">⬆️ Upload File</h3>
              <button className="upload-modal-close" onClick={() => setShowUpload(false)}>×</button>
            </div>
            <div className="upload-modal-body">
              {uploadError && (
                <div className="upload-size-warning" style={{ background: '#FFEBEE', borderColor: '#EF9A9A', color: '#C62828' }}>
                  ⚠️ {uploadError}
                </div>
              )}

              {/* Dropzone */}
              <label className={`upload-dropzone ${uploadFile_ ? '' : ''}`}>
                <input
                  type="file"
                  style={{ display: 'none' }}
                  onChange={handleFileSelect}
                />
                <div className="upload-dropzone-icon">{uploadFile_ ? '✅' : '📎'}</div>
                <div className="upload-dropzone-text">
                  {uploadFile_
                    ? <><strong>{uploadFile_.name}</strong> ({formatFileSize(uploadFile_.size)})</>
                    : <>Click to select a file or <strong>drag and drop</strong></>
                  }
                </div>
                <div className="upload-dropzone-hint">
                  Max 100 MB (500 MB for video) • PDF, DOC, PPT, MP4, MP3, and more
                </div>
              </label>

              <div className="upload-form-group">
                <label className="upload-form-label">Title</label>
                <input
                  className="upload-form-input"
                  type="text"
                  value={uploadTitle}
                  onChange={e => setUploadTitle(e.target.value)}
                  placeholder="e.g. Chapter 5 Notes — Trigonometry"
                />
              </div>

              <div className="upload-form-group">
                <label className="upload-form-label">Description (optional)</label>
                <textarea
                  className="upload-form-textarea"
                  value={uploadDesc}
                  onChange={e => setUploadDesc(e.target.value)}
                  placeholder="Briefly describe this resource..."
                  rows={3}
                />
              </div>

              <div className="upload-form-row">
                <div className="upload-form-group">
                  <label className="upload-form-label">File Type</label>
                  <select className="upload-form-select" value={uploadType} onChange={e => setUploadType(e.target.value as FileType)}>
                    <option value="document">📄 Document</option>
                    <option value="video">🎬 Video</option>
                    <option value="past_paper">📝 Past Paper</option>
                    <option value="notes">📒 Notes</option>
                    <option value="course_material">📚 Course Material</option>
                    <option value="recording">🎙️ Recording</option>
                    <option value="other">📎 Other</option>
                  </select>
                </div>
                <div className="upload-form-group">
                  <label className="upload-form-label">Visibility</label>
                  <select className="upload-form-select" value={uploadVisibility} onChange={e => setUploadVisibility(e.target.value as FileVisibility)}>
                    <option value="public">🌍 Public (Everyone)</option>
                    <option value="students_only">📖 Students Only</option>
                    <option value="tutors_coaches_only">🎓 Tutors & Coaches Only</option>
                    <option value="private">🔒 Private</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-outline" onClick={() => setShowUpload(false)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={!uploadFile_ || !uploadTitle.trim() || uploading}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: zoneColor }}
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
