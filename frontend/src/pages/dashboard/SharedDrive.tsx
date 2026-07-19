import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getFolders, getFiles } from '../../lib/sharedDrive';
import { getZoneColor, getFileTypeIcon, formatFileSize } from '../../types/lms';
import type { Folder, SharedFile, FileType } from '../../types/lms';
import '../../styles/shared-drive.css';

const FILE_TYPE_FILTERS: { value: FileType | ''; label: string; icon: string }[] = [
  { value: '', label: 'All', icon: '📋' },
  { value: 'document', label: 'Documents', icon: '📄' },
  { value: 'video', label: 'Videos', icon: '🎬' },
  { value: 'past_paper', label: 'Past Papers', icon: '📝' },
  { value: 'notes', label: 'Notes', icon: '📒' },
  { value: 'course_material', label: 'Course Material', icon: '📚' },
  { value: 'recording', label: 'Recordings', icon: '🎙️' },
];

export default function SharedDrive() {
  const { profile } = useAuth();
  const zone = getZoneColor(profile?.role ?? 'customer');

  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [folderPath, setFolderPath] = useState<{ id: string | null; name: string }[]>([
    { id: null, name: 'SharedDrive' },
  ]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<FileType | ''>('');
  const [selectedFile, setSelectedFile] = useState<SharedFile | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [folderData, fileData] = await Promise.all([
        getFolders(currentFolderId),
        getFiles({
          folderId: currentFolderId,
          fileType: activeFilter || undefined,
          search: searchQuery || undefined,
        }),
      ]);
      setFolders(folderData);
      setFiles(fileData);
    } catch (err) {
      console.error('Failed to load shared drive:', err);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, activeFilter, searchQuery]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const navigateToFolder = (folder: Folder) => {
    setCurrentFolderId(folder.id);
    setFolderPath(prev => [...prev, { id: folder.id, name: folder.name }]);
  };

  const navigateToBreadcrumb = (index: number) => {
    const target = folderPath[index];
    setCurrentFolderId(target.id);
    setFolderPath(prev => prev.slice(0, index + 1));
  };

  return (
    <div className="animate-slide-up">
      <div className="dashboard-page-header">
        <h1 className="dashboard-page-title">🖥️ SharedDrive</h1>
        <p className="dashboard-page-subtitle">
          Access shared resources — past papers, recordings, notes, and course materials from tutors and coaches.
        </p>
      </div>

      {/* Search */}
      <div className="content-panel" style={{ marginBottom: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '1.1rem' }}>🔍</span>
          <input
            type="text"
            placeholder="Search resources by title..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{
              flex: 1, border: 'none', outline: 'none', fontFamily: 'inherit',
              fontSize: '0.9rem', background: 'transparent',
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--color-text-muted)' }}
            >✕</button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="drive-filters">
        {FILE_TYPE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`drive-filter-chip ${activeFilter === f.value ? 'active' : ''}`}
            onClick={() => setActiveFilter(f.value as FileType | '')}
          >
            {f.icon} {f.label}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="drive-controls">
        <div className="drive-controls-left">
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
          <div className="view-toggle">
            <button className={`view-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}>⊞</button>
            <button className={`view-toggle-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}>☰</button>
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="empty-state">
          <div className="empty-state-icon">⏳</div>
          <div className="empty-state-title">Loading resources...</div>
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="content-panel">
          <div className="empty-state">
            <div className="empty-state-icon">🖥️</div>
            <div className="empty-state-title">
              {searchQuery ? 'No results found' : 'Nothing here yet'}
            </div>
            <div className="empty-state-text">
              {searchQuery
                ? `No resources match "${searchQuery}". Try a different search term.`
                : (profile?.role === 'tutor' || profile?.role === 'coach' || profile?.role === 'admin')
                  ? 'Upload resources and share lesson files, notes and materials with students.'
                  : 'Resources shared by tutors and coaches will appear here.'
              }
            </div>
            {!searchQuery && (profile?.role === 'tutor' || profile?.role === 'coach' || profile?.role === 'admin') && (
              <a href="/dashboard/resources" className="btn btn-primary" style={{ marginTop: '1rem', textDecoration: 'none' }}>
                Go to My Resources to upload
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className={`file-grid ${viewMode === 'list' ? 'list-view' : ''}`}>
          {/* Folders */}
          {folders.map(folder => (
            <div key={folder.id} className="folder-card" onClick={() => navigateToFolder(folder)}>
              <div className="folder-card-icon">📁</div>
              <div className="folder-card-name">{folder.name}</div>
              {folder.description && <div className="folder-card-count">{folder.description}</div>}
            </div>
          ))}

          {/* Files */}
          {files.map(file => (
            <div key={file.id} className="file-card" onClick={() => setSelectedFile(file)}>
              <div className={`file-card-thumbnail ${file.file_type}`}>
                {getFileTypeIcon(file.file_type)}
                <span className="file-card-type-badge">{file.file_type.replace('_', ' ')}</span>
              </div>
              <div className="file-card-body">
                <div className="file-card-title">{file.title}</div>
                <div className="file-card-meta">
                  <span className="file-card-uploader">
                    {file.uploader_role === 'tutor' ? '🎓' : file.uploader_role === 'coach' ? '🤝' : '📖'}
                    {file.uploader_name}
                  </span>
                  <span>•</span>
                  <span>{formatFileSize(file.file_size_bytes)}</span>
                </div>
                {file.ai_summary && <div className="file-card-ai-badge">✨ AI Summary</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* File Detail Modal */}
      {selectedFile && (
        <div className="upload-modal-overlay" onClick={() => setSelectedFile(null)}>
          <div className="upload-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <div className="upload-modal-header">
              <h3 className="upload-modal-title">{getFileTypeIcon(selectedFile.file_type)} {selectedFile.title}</h3>
              <button className="upload-modal-close" onClick={() => setSelectedFile(null)}>×</button>
            </div>
            <div className="upload-modal-body">
              {/* File Info */}
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem',
                fontSize: '0.85rem', marginBottom: '1.25rem',
              }}>
                <div><strong>Type:</strong> {selectedFile.file_type.replace('_', ' ')}</div>
                <div><strong>Size:</strong> {formatFileSize(selectedFile.file_size_bytes)}</div>
                <div><strong>Uploaded by:</strong> {selectedFile.uploader_name}</div>
                <div><strong>Date:</strong> {new Date(selectedFile.created_at).toLocaleDateString()}</div>
                <div><strong>Visibility:</strong> {selectedFile.visibility.replace('_', ' ')}</div>
              </div>

              {selectedFile.description && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Description</strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    {selectedFile.description}
                  </p>
                </div>
              )}

              {/* AI Summary */}
              {selectedFile.ai_summary ? (
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <span className="ai-panel-icon">✨</span>
                    <span className="ai-panel-title">AI Summary</span>
                  </div>
                  <div className="ai-panel-content">{selectedFile.ai_summary}</div>
                  {selectedFile.ai_key_topics && selectedFile.ai_key_topics.length > 0 && (
                    <div className="ai-panel-topics">
                      {selectedFile.ai_key_topics.map((topic, i) => (
                        <span key={i} className="ai-topic-tag">{topic}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="ai-action-btn">✨ Summarise</button>
                  <button className="ai-action-btn">🔍 Extract Topics</button>
                </div>
              )}
            </div>
            <div className="upload-modal-footer">
              {selectedFile.file_url && (
                <a
                  href={selectedFile.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem', fontSize: '0.85rem',
                    background: zone === 'tutor' ? 'var(--zone-tutor)' : zone === 'coach' ? 'var(--zone-coach)' : 'var(--zone-student)',
                    textDecoration: 'none',
                  }}
                >
                  ⬇️ Download
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
