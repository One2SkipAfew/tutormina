import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { createFolder, getFolders, deleteFolder, updateFolder, getFileAccessList, revokeStudentFileAccess } from '../../lib/sharedDrive';
import { getFiles, uploadFile, deleteFile as deleteSharedFile, updateFile } from '../../lib/sharedDrive';
import { getZoneColor, getFileTypeIcon, formatFileSize, getAllowedExtensionsForType } from '../../types/lms';
import type { Folder, SharedFile, FileType, FileVisibility } from '../../types/lms';
import { ClipboardList, FileText, Film, Edit3, Book, BookOpen, Mic, Eye, Edit2, Trash2, Download, X, FolderPlus, Upload, FolderOpen, Folder as FolderIcon, Users } from 'lucide-react';
import { useModal } from '../../contexts/NotificationContext';
import '../../styles/shared-drive.css';

const FILE_TYPE_FILTERS: { value: FileType | ''; label: string; icon: React.ReactNode }[] = [
  { value: '', label: 'All', icon: <ClipboardList size={16} /> },
  { value: 'document', label: 'Documents', icon: <FileText size={16} /> },
  { value: 'video', label: 'Videos', icon: <Film size={16} /> },
  { value: 'past_paper', label: 'Past Papers', icon: <Edit3 size={16} /> },
  { value: 'notes', label: 'Notes', icon: <Book size={16} /> },
  { value: 'course_material', label: 'Course Material', icon: <BookOpen size={16} /> },
  { value: 'recording', label: 'Recordings', icon: <Mic size={16} /> },
];

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
  const [activeFilter, setActiveFilter] = useState<FileType | ''>('');

  // Modals
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderDesc, setNewFolderDesc] = useState('');
  const [viewingFile, setViewingFile] = useState<SharedFile | null>(null);
  const [noteContent, setNoteContent] = useState<string | null>(null);

  // File Access List
  const [accessListFile, setAccessListFile] = useState<SharedFile | null>(null);
  const [fileAccessList, setFileAccessList] = useState<{ student_id: string; student_name: string; email: string; avatar_url: string | null; has_grant_all: boolean }[]>([]);
  const [accessListLoading, setAccessListLoading] = useState(false);

  useEffect(() => {
    if (viewingFile && viewingFile.file_type === 'notes') {
      if (!viewingFile.file_url) {
        setNoteContent('No file URL available.');
        return;
      }
      setNoteContent('Loading...');
      fetch(viewingFile.file_url)
        .then(res => res.text())
        .then(text => setNoteContent(text))
        .catch(() => setNoteContent('Failed to load note content.'));
    } else {
      setNoteContent(null);
    }
  }, [viewingFile]);

  const renderMarkdown = (md: string): string => {
    if (!md) return '';
    let html = md
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    html = html.replace(/^### (.*$)/gim, '<h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #1e293b;">$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.3rem;">$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1 style="margin-top: 1.5rem; margin-bottom: 0.5rem; color: #0f172a;">$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    html = html.replace(/^\s*[-*+]\s+(.*$)/gim, '<li style="margin-left: 1.5rem; margin-bottom: 0.25rem;">$1</li>');
    html = html.replace(/\n/g, '<br />');
    // Clean up <br /> around headers and lists
    html = html.replace(/(<\/h[1-3]>)\s*<br \/>/g, '$1');
    html = html.replace(/(<\/li>)\s*<br \/>/g, '$1');
    return html;
  };

  // Upload state
  const [uploadFile_, setUploadFile_] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadType, setUploadType] = useState<FileType>('document');
  const [uploadVisibility, setUploadVisibility] = useState<FileVisibility>('public');
  const [uploading, setUploading] = useState(false);
  const { showModal } = useModal();

  // Edit folder
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [editFolderName, setEditFolderName] = useState('');

  // Select and Edit file
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [editingFile, setEditingFile] = useState<SharedFile | null>(null);
  const [editFileTitle, setEditFileTitle] = useState('');
  const [editFileDesc, setEditFileDesc] = useState('');
  const [editFileType, setEditFileType] = useState<FileType>('document');
  const [editFileVisibility, setEditFileVisibility] = useState<FileVisibility>('public');
  const [updatingFile, setUpdatingFile] = useState(false);

  const zoneColor = zone === 'tutor' ? 'var(--zone-tutor)' : zone === 'coach' ? 'var(--zone-coach)' : 'var(--zone-student)';

  const loadData = useCallback(async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const [folderData, fileData] = await Promise.all([
        getFolders(currentFolderId, profile.id, activeFilter || undefined),
        getFiles({ folderId: currentFolderId, uploadedBy: profile.id, fileType: activeFilter || undefined }),
      ]);
      setFolders(folderData);
      setFiles(fileData);
    } catch (err) {
      console.error('Failed to load resources:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, profile, activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAccessList = async (file: SharedFile) => {
    setAccessListFile(file);
    setAccessListLoading(true);
    try {
      const list = await getFileAccessList(file.id);
      setFileAccessList(list);
    } catch (err) {
      console.error('Failed to load access list:', err);
    } finally {
      setAccessListLoading(false);
    }
  };

  const handleRevokeAccess = async (studentId: string, hasGrantAll: boolean) => {
    if (hasGrantAll) {
      showModal({
        type: 'warning',
        title: 'Cannot Revoke',
        message: 'This student has "Grant All" access to your entire library. To revoke access to this file, you must first revoke their "Grant All" access from the My Students page.',
        buttons: [{ label: 'OK', onClick: 'dismiss' }]
      });
      return;
    }
    
    if (!accessListFile) return;
    try {
      await revokeStudentFileAccess(studentId, accessListFile.id);
      setFileAccessList(prev => prev.filter(p => p.student_id !== studentId));
    } catch (err) {
      console.error('Failed to revoke access:', err);
    }
  };

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
      await createFolder(newFolderName.trim(), currentFolderId, newFolderDesc || null, null, activeFilter || null);
      setShowNewFolder(false);
      setNewFolderName('');
      setNewFolderDesc('');
      loadData();
    } catch (err) {
      console.error('Failed to create folder:', err);
    }
  };

  // Delete folder
  const handleDeleteFolder = (folderId: string) => {
    showModal({
      type: 'warning',
      title: 'Delete Folder',
      message: 'Delete this folder and all its contents?',
      buttons: [
        { label: 'Cancel', variant: 'outline', onClick: 'dismiss' },
        {
          label: 'Delete',
          onClick: async () => {
            try {
              await deleteFolder(folderId);
              loadData();
            } catch (err) {
              console.error('Failed to delete folder:', err);
            }
          }
        }
      ]
    });
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
      showModal({ type: 'error', title: 'Upload Failed', message: err instanceof Error ? err.message : 'Upload failed', buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }] });
    } finally {
      setUploading(false);
    }
  };

  // Delete file
  const handleDeleteFile = (fileId: string) => {
    showModal({
      type: 'warning',
      title: 'Delete File',
      message: 'Delete this file permanently?',
      buttons: [
        { label: 'Cancel', variant: 'outline', onClick: 'dismiss' },
        {
          label: 'Delete',
          onClick: async () => {
            try {
              await deleteSharedFile(fileId);
              if (selectedFileId === fileId) setSelectedFileId(null);
              loadData();
            } catch (err) {
              console.error('Failed to delete file:', err);
            }
          }
        }
      ]
    });
  };

  // Update file
  const handleUpdateFile = async () => {
    if (!editingFile || !editFileTitle.trim()) return;
    setUpdatingFile(true);
    try {
      await updateFile(editingFile.id, {
        title: editFileTitle.trim(),
        description: editFileDesc || null,
        file_type: editFileType,
        visibility: editFileVisibility,
      });
      setEditingFile(null);
      loadData();
    } catch (err) {
      showModal({ type: 'error', title: 'Update Failed', message: err instanceof Error ? err.message : 'Update failed', buttons: [{ label: 'OK', onClick: 'dismiss' }] });
    } finally {
      setUpdatingFile(false);
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
          <span style={{display:'flex',alignItems:'center',gap:'0.5rem'}}><FolderOpen size={28} /> My Resources</span>
        </h1>
        <p className="dashboard-page-subtitle">
          Organise your teaching materials into folders. Students will see resources you share.
        </p>
      </div>

      {/* Filters */}
      <div className="drive-filters">
        {FILE_TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`drive-filter-chip ${activeFilter === f.value ? 'active' : ''}`}
            onClick={() => {
              setActiveFilter(f.value as FileType | '');
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>{f.icon} {f.label}</span>
          </button>
        ))}
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
            <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><FolderPlus size={16} /> New Folder</span>
          </button>
          <button
            className="btn btn-primary"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', background: zoneColor }}
            onClick={() => {
              setUploadType(activeFilter || 'document');
              setShowUpload(true);
            }}
          >
            <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Upload size={16} /> Upload File</span>
          </button>
          <button
            className="btn btn-outline"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', opacity: selectedFileId ? 1 : 0.5, cursor: selectedFileId ? 'pointer' : 'not-allowed' }}
            disabled={!selectedFileId}
            onClick={() => {
              const file = files.find(f => f.id === selectedFileId);
              if (file) {
                setEditingFile(file);
                setEditFileTitle(file.title);
                setEditFileDesc(file.description || '');
                setEditFileType(file.file_type);
                setEditFileVisibility(file.visibility);
              }
            }}
          >
            <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Edit2 size={16} /> Edit File</span>
          </button>
          <button
            className="btn btn-outline"
            style={{ padding: '0.5rem 0.85rem', fontSize: '0.82rem', opacity: selectedFileId ? 1 : 0.5, cursor: selectedFileId ? 'pointer' : 'not-allowed' }}
            disabled={!selectedFileId}
            onClick={() => selectedFileId && handleDeleteFile(selectedFileId)}
          >
            <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Trash2 size={16} /> Delete File</span>
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
            <div className="empty-state-icon"><FolderOpen size={48} color="#94a3b8" /></div>
            <div className="empty-state-title">No resources yet</div>
            <div className="empty-state-text">
              Create a folder to organise your materials, or upload a file directly.
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-outline" onClick={() => setShowNewFolder(true)}>
                <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><FolderPlus size={16} /> New Folder</span>
              </button>
              <button className="btn btn-primary" onClick={() => {
                setUploadType(activeFilter || 'document');
                setShowUpload(true);
              }} style={{ background: zoneColor }}>
                <span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Upload size={16} /> Upload</span>
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
              <div className="folder-card-icon"><FolderIcon size={32} color="#fcd34d" /></div>
              <div className="folder-card-name">{folder.name}</div>
              {folder.description && (
                <div className="folder-card-count">{folder.description}</div>
              )}
              <div className="folder-card-menu">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setEditingFolder(folder);
                    setEditFolderName(folder.name);
                  }}
                  title="Rename"
                ><Edit2 size={16} /></button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                  title="Delete"
                ><Trash2 size={16} /></button>
              </div>
            </div>
          ))}

          {/* Files */}
          {files.map(file => (
            <div 
              key={file.id} 
              className={`file-card ${selectedFileId === file.id ? 'selected' : ''}`}
              onClick={() => setViewingFile(file)}
              style={{
                border: selectedFileId === file.id ? `2px solid ${zoneColor}` : undefined,
                cursor: 'pointer'
              }}
            >
              <div className={`file-card-thumbnail ${file.file_type}`}>
                {getFileTypeIcon(file.file_type)}
                <span className="file-card-type-badge">{file.file_type.replace('_', ' ')}</span>
              </div>
              <div className="file-card-body">
                <div className="file-card-title">{file.title}</div>
                <div className="file-card-meta" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                  <span>{formatFileSize(file.file_size_bytes)}</span>
                  <span>•</span>
                  <span>{new Date(file.created_at).toLocaleDateString()}</span>
                  <span>•</span>
                  <span style={{ 
                    padding: '0.1rem 0.4rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 600,
                    background: file.visibility === 'private' ? '#f1f5f9' : '#e0e7ff',
                    color: file.visibility === 'private' ? '#64748b' : '#4338ca' 
                  }}>
                    {file.visibility === 'private' ? 'Draft' : 'Published'}
                  </span>
                </div>
                {file.ai_summary && <div className="file-card-ai-badge">✨ AI Summary</div>}
              </div>
              <div className="file-card-menu">
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setViewingFile(file);
                  }}
                  title="View file"
                ><Eye size={16} /></button>
                {role !== 'customer' && (
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      openAccessList(file);
                    }}
                    title="Shared with"
                  ><Users size={16} /></button>
                )}
                <button
                  onClick={e => {
                    e.stopPropagation();
                    setEditingFile(file);
                    setEditFileTitle(file.title);
                    setEditFileDesc(file.description || '');
                    setEditFileType(file.file_type);
                    setEditFileVisibility(file.visibility);
                  }}
                  title="Edit file"
                ><Edit2 size={16} /></button>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteFile(file.id);
                  }}
                  title="Delete file"
                ><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      
      {/* File Preview Modal */}
      {viewingFile && (
        <div className="upload-modal-overlay" onClick={() => setViewingFile(null)} style={{ zIndex: 1000, padding: '2rem' }}>
          <div 
            className="upload-modal" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '900px', width: '100%', height: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="upload-modal-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '8px', color: '#475569' }}>
                  {getFileTypeIcon(viewingFile.file_type)}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>{viewingFile.title}</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{formatFileSize(viewingFile.file_size_bytes)} • {new Date(viewingFile.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button className="upload-modal-close" onClick={() => setViewingFile(null)}><X size={20} /></button>
            </div>
            
            <div className="upload-modal-body" style={{ flex: 1, padding: 0, background: '#f8fafc', position: 'relative', overflow: 'hidden' }}>
              {viewingFile.file_type === 'notes' && noteContent ? (
                <div 
                  style={{ padding: '2rem 3rem', height: '100%', overflowY: 'auto', color: '#334155', lineHeight: 1.7, fontSize: '0.95rem' }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(noteContent) }}
                />
              ) : viewingFile.file_type === 'video' ? (
                <video src={viewingFile.file_url || undefined} controls style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : viewingFile.file_type === 'recording' ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '2rem' }}>
                   <audio src={viewingFile.file_url || undefined} controls style={{ width: '100%', maxWidth: '500px' }} />
                </div>
              ) : (
                <iframe src={viewingFile.file_url || undefined} style={{ width: '100%', height: '100%', border: 'none' }} title={viewingFile.title} />
              )}
            </div>
            
            <div className="upload-modal-footer" style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
              <button className="btn btn-outline" onClick={() => setViewingFile(null)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Back to Resources
              </button>
              
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    if (!viewingFile.file_url) return;
                    const a = document.createElement('a');
                    a.href = viewingFile.file_url;
                    a.download = viewingFile.title;
                    a.target = '_blank';
                    a.click();
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#3b82f6', borderColor: '#bfdbfe' }}
                >
                  <Download size={16} /> Download
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    setEditingFile(viewingFile);
                    setEditFileTitle(viewingFile.title);
                    setEditFileDesc(viewingFile.description || '');
                    setEditFileType(viewingFile.file_type);
                    setEditFileVisibility(viewingFile.visibility);
                    setViewingFile(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#10b981', borderColor: '#a7f3d0' }}
                >
                  <Edit2 size={16} /> Edit
                </button>
                <button 
                  className="btn btn-outline" 
                  onClick={() => {
                    handleDeleteFile(viewingFile.id);
                    setViewingFile(null);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444', borderColor: '#fecaca' }}
                >
                  <Trash2 size={16} /> Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder Modal */}

      {showNewFolder && (
        <div className="upload-modal-overlay" onClick={() => setShowNewFolder(false)}>
          <div className="upload-modal new-folder-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-header">
              <h3 className="upload-modal-title"><span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><FolderPlus size={16} /> New Folder</span></h3>
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
              <h3 className="upload-modal-title"><span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Edit2 size={20} /> Rename Folder</span></h3>
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
              <h3 className="upload-modal-title"><span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Upload size={16} /> Upload File</span></h3>
              <button className="upload-modal-close" onClick={() => setShowUpload(false)}>×</button>
            </div>
            <div className="upload-modal-body">


              {/* Dropzone */}
              <label className={`upload-dropzone ${uploadFile_ ? '' : ''}`}>
                <input
                  type="file"
                  accept={getAllowedExtensionsForType(uploadType).join(',')}
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
                  {uploadType === 'video' ? 'Max 500 MB • Video files only' : 
                   uploadType === 'recording' ? 'Max 500 MB • Media files only' : 
                   `Max 100 MB • ${getAllowedExtensionsForType(uploadType).slice(0, 5).join(', ').toUpperCase()}...`}
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
                    <option value="private">🔒 Draft (Only you can see this)</option>
                    <option value="students_only">📖 Published (Your Students Only)</option>
                    <option value="tutors_coaches_only">🎓 Published (Tutors & Coaches Only)</option>
                    <option value="public">🌍 Published (Everyone)</option>
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

      {/* Edit File Modal */}
      {editingFile && (
        <div className="upload-modal-overlay" onClick={() => setEditingFile(null)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <div className="upload-modal-header">
              <h3 className="upload-modal-title"><span style={{display:'flex',alignItems:'center',gap:'0.4rem'}}><Edit2 size={16} /> Edit File</span></h3>
              <button className="upload-modal-close" onClick={() => setEditingFile(null)}>×</button>
            </div>
            <div className="upload-modal-body">
              <div className="upload-form-group">
                <label className="upload-form-label">Title</label>
                <input
                  className="upload-form-input"
                  type="text"
                  value={editFileTitle}
                  onChange={e => setEditFileTitle(e.target.value)}
                  placeholder="e.g. Chapter 5 Notes — Trigonometry"
                />
              </div>

              <div className="upload-form-group">
                <label className="upload-form-label">Description (optional)</label>
                <textarea
                  className="upload-form-textarea"
                  value={editFileDesc}
                  onChange={e => setEditFileDesc(e.target.value)}
                  placeholder="Briefly describe this resource..."
                  rows={3}
                />
              </div>

              <div className="upload-form-row">
                <div className="upload-form-group">
                  <label className="upload-form-label">File Type</label>
                  <select className="upload-form-select" value={editFileType} onChange={e => setEditFileType(e.target.value as FileType)}>
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
                  <select className="upload-form-select" value={editFileVisibility} onChange={e => setEditFileVisibility(e.target.value as FileVisibility)}>
                    <option value="private">🔒 Draft (Only you can see this)</option>
                    <option value="students_only">📖 Published (Your Students Only)</option>
                    <option value="tutors_coaches_only">🎓 Published (Tutors & Coaches Only)</option>
                    <option value="public">🌍 Published (Everyone)</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="upload-modal-footer">
              <button className="btn btn-outline" onClick={() => setEditingFile(null)} style={{ padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleUpdateFile}
                disabled={!editFileTitle.trim() || updatingFile}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.85rem', background: zoneColor }}
              >
                {updatingFile ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Access List Modal */}
      {accessListFile && (
        <div className="upload-modal-overlay" onClick={() => setAccessListFile(null)} style={{ zIndex: 1000, padding: '2rem' }}>
          <div 
            className="upload-modal" 
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '600px', width: '100%', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div className="upload-modal-header" style={{ padding: '1rem 1.5rem', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div style={{ padding: '0.5rem', background: '#f1f5f9', borderRadius: '8px', color: '#475569' }}>
                  <Users size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>Shared With</h3>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: '#64748b' }}>{accessListFile.title}</p>
                </div>
              </div>
              <button className="upload-modal-close" onClick={() => setAccessListFile(null)}><X size={20} /></button>
            </div>
            
            <div className="upload-modal-body" style={{ flex: 1, padding: '1rem 1.5rem', overflowY: 'auto' }}>
              {accessListLoading ? (
                <div className="empty-state" style={{ padding: '2rem 0', minHeight: 'auto' }}>
                  <div className="empty-state-icon">⏳</div>
                  <div className="empty-state-title">Loading...</div>
                </div>
              ) : fileAccessList.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem 0', minHeight: 'auto' }}>
                  <div className="empty-state-icon"><Users size={32} color="#94a3b8" /></div>
                  <div className="empty-state-title">Not shared with anyone</div>
                  <div className="empty-state-text">No students currently have direct access to this specific file.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {fileAccessList.map(student => (
                    <div key={student.student_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', border: '1px solid #e2e8f0', borderRadius: '8px', background: '#fff' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <div style={{
                          width: '32px', height: '32px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 600, color: '#475569',
                          backgroundImage: student.avatar_url ? `url(${student.avatar_url})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center'
                        }}>
                          {!student.avatar_url && student.student_name.charAt(0)}
                        </div>
                        <div>
                          <div style={{ fontSize: '0.95rem', fontWeight: 500, color: '#0f172a' }}>{student.student_name}</div>
                          <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{student.email}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {student.has_grant_all && (
                          <span style={{ fontSize: '0.75rem', background: '#f1f5f9', color: '#64748b', padding: '0.2rem 0.5rem', borderRadius: '999px', fontWeight: 500 }}>
                            Grant All
                          </span>
                        )}
                        <button 
                          className="btn btn-outline"
                          onClick={() => handleRevokeAccess(student.student_id, student.has_grant_all)}
                          style={{ padding: '0.35rem 0.6rem', fontSize: '0.8rem', color: '#ef4444', borderColor: '#fecaca' }}
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
