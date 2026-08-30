import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { getFolders, getFiles, downloadFile } from '../../lib/sharedDrive';
import { getSessionNotes } from '../../lib/aiNotes';
import { getZoneColor, formatFileSize } from '../../types/lms';
import type { Folder, SharedFile, FileType } from '../../types/lms';
import { ClipboardList, FileText, Film, Edit3, Book, BookOpen, Mic, Monitor, Search, Loader, Folder as FolderIcon, GraduationCap, Users, BookMarked, Sparkles, Download, Paperclip, Eye } from 'lucide-react';
import ResourceViewerModal from '../../components/dashboard/ResourceViewerModal';
import '../../styles/shared-drive.css';

const getIconForFileType = (type: FileType | string, size = 24) => {
  switch (type) {
    case 'document': return <FileText size={size} />;
    case 'video': return <Film size={size} />;
    case 'past_paper': return <Edit3 size={size} />;
    case 'notes': return <Book size={size} />;
    case 'course_material': return <BookOpen size={size} />;
    case 'recording': return <Mic size={size} />;
    default: return <Paperclip size={size} />;
  }
};

const FILE_TYPE_FILTERS: { value: FileType | ''; label: string; icon: React.ReactNode }[] = [
  { value: '', label: 'All', icon: <ClipboardList size={16} /> },
  { value: 'document', label: 'Documents', icon: <FileText size={16} /> },
  { value: 'video', label: 'Videos', icon: <Film size={16} /> },
  { value: 'past_paper', label: 'Past Papers', icon: <Edit3 size={16} /> },
  { value: 'notes', label: 'Notes', icon: <Book size={16} /> },
  { value: 'course_material', label: 'Course Material', icon: <BookOpen size={16} /> },
  { value: 'recording', label: 'Recordings', icon: <Mic size={16} /> },
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
  const [viewingFile, setViewingFile] = useState<SharedFile | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (currentFolderId === 'ai-notes') {
        const notes = await getSessionNotes();
        setFolders([]);
        setFiles(notes.map(n => ({
          id: n.id,
          title: n.title,
          description: n.summary ? n.summary.substring(0, 100) + '...' : 'AI Session Notes',
          file_type: 'document',
          file_url: '',
          file_size_bytes: 0,
          folder_id: 'ai-notes',
          owner_id: n.profile_id,
          uploader_name: 'AI Assistant',
          uploader_role: 'system',
          created_at: n.created_at,
          visibility: 'private',
          ai_summary: n.summary,
          ai_key_topics: n.key_topics,
          _aiNote: n
        } as any)));
      } else {
        const [folderData, fileData] = await Promise.all([
          getFolders(currentFolderId, undefined, activeFilter || undefined),
          getFiles({
            // Only filter by folder when we're actually inside one.
            // At root (null), show ALL accessible files regardless of folder nesting.
            folderId: currentFolderId ?? undefined,
            fileType: activeFilter || undefined,
            search: searchQuery || undefined,
          }),
        ]);
        
        setFolders(folderData);
        setFiles(fileData);
      }
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
        <h1 className="dashboard-page-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Monitor size={32} color="#2196F3" /> SharedDrive</h1>
        <p className="dashboard-page-subtitle">
          Access shared resources — past papers, recordings, notes, and course materials from tutors and coaches.
        </p>
      </div>

      {/* Search */}
      <div className="content-panel" style={{ marginBottom: '1rem' }}>
        <div style={{ padding: '0.75rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Search size={18} color="#64748b" />
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
            className={`drive-filter-chip ${activeFilter === f.value && currentFolderId !== 'ai-notes' ? 'active' : ''}`}
            onClick={() => {
              setActiveFilter(f.value as FileType | '');
              if (currentFolderId === 'ai-notes') {
                setCurrentFolderId(null);
                setFolderPath([{ id: null, name: 'SharedDrive' }]);
              }
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>{f.icon} {f.label}</span>
          </button>
        ))}
        <button
          className={`drive-filter-chip ${currentFolderId === 'ai-notes' ? 'active' : ''}`}
          onClick={() => {
            setActiveFilter('');
            setCurrentFolderId('ai-notes');
            setFolderPath([{ id: null, name: 'SharedDrive' }, { id: 'ai-notes', name: 'AI Insights & Summaries' }]);
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}><Sparkles size={16} /> AI Insights & Summaries</span>
        </button>
      </div>

      {/* Controls */}
      <div className="drive-controls">
        <div className="drive-controls-left">
          <div className="drive-path">
            {folderPath.map((crumb, i) => (
              <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {i > 0 && <span className="drive-path-separator">›</span>}
                <span
                  className={`drive-path-item ${i === folderPath.length - 1 && !activeFilter ? 'current' : ''}`}
                  onClick={() => {
                    navigateToBreadcrumb(i);
                    setActiveFilter('');
                  }}
                >
                  {crumb.name}
                </span>
              </span>
            ))}
            {activeFilter && currentFolderId !== 'ai-notes' && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <span className="drive-path-separator">›</span>
                <span className="drive-path-item current">
                  {FILE_TYPE_FILTERS.find(f => f.value === activeFilter)?.label}
                </span>
              </span>
            )}
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
          <div className="empty-state-icon"><Loader size={48} className="spin" /></div>
          <div className="empty-state-title">Loading resources...</div>
        </div>
      ) : folders.length === 0 && files.length === 0 ? (
        <div className="content-panel">
          <div className="empty-state">
            <div className="empty-state-icon"><Monitor size={48} /></div>
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
              <div className="folder-card-icon"><FolderIcon size={28} color="#fcd34d" /></div>
              <div className="folder-card-name">{folder.name}</div>
              {folder.description && <div className="folder-card-count">{folder.description}</div>}
            </div>
          ))}

          {/* Files */}
          {files.map(file => (
            <div key={file.id} className="file-card" onClick={() => setSelectedFile(file)}>
              <div className={`file-card-thumbnail ${file.file_type}`}>
                {getIconForFileType(file.file_type, 32)}
                <span className="file-card-type-badge">{file.file_type.replace('_', ' ')}</span>
              </div>
              <div className="file-card-body">
                <div className="file-card-title">{file.title}</div>
                <div className="file-card-meta">
                  <span className="file-card-uploader" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                    {file.uploader_role === 'tutor' ? <GraduationCap size={14} /> : file.uploader_role === 'coach' ? <Users size={14} /> : <BookMarked size={14} />}
                    {file.uploader_name}
                  </span>
                  <span>•</span>
                  <span>{formatFileSize(file.file_size_bytes)}</span>
                </div>
                {file.ai_summary && <div className="file-card-ai-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Sparkles size={12} /> AI Summary</div>}
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
              <h3 className="upload-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>{getIconForFileType(selectedFile.file_type, 20)} {selectedFile.title}</h3>
              <button className="upload-modal-close" onClick={() => setSelectedFile(null)}>×</button>
            </div>
            <div className="upload-modal-body">
              {/* File Info */}
              {(selectedFile.file_size_bytes ?? 0) > 0 && (
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
              )}

              {selectedFile.description && (
                <div style={{ marginBottom: '1.25rem' }}>
                  <strong style={{ fontSize: '0.85rem' }}>Description</strong>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '0.25rem' }}>
                    {selectedFile.description}
                  </p>
                </div>
              )}

              {/* AI Summary or View Action */}
              {selectedFile.ai_summary ? (
                <div className="ai-panel">
                  <div className="ai-panel-header">
                    <span className="ai-panel-icon"><Sparkles size={16} /></span>
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
                  <button
                    className="btn btn-primary"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '0.5rem',
                      padding: '0.55rem 1.25rem', fontSize: '0.88rem',
                      background: 'linear-gradient(135deg, #0284c7, #0369a1)',
                      borderColor: '#0284c7', color: '#ffffff', fontWeight: 600,
                    }}
                    onClick={() => {
                      setViewingFile(selectedFile);
                      setSelectedFile(null);
                    }}
                  >
                    <Eye size={16} /> View Resource
                  </button>
                </div>
              )}

              {/* Full Transcript for AI Notes */}
              {(selectedFile as any)._aiNote && (
                <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                  <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#1e293b' }}>
                    <FileText size={16} /> Full Transcript
                  </h4>
                  <div style={{ fontSize: '0.85rem', color: '#475569', maxHeight: '300px', overflowY: 'auto', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                    {(selectedFile as any)._aiNote.transcript || 'No transcript available.'}
                  </div>
                </div>
              )}
            </div>
            <div className="upload-modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                className="btn btn-outline"
                style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem' }}
                onClick={() => {
                  setViewingFile(selectedFile);
                  setSelectedFile(null);
                }}
              >
                <Eye size={16} /> Open in Viewer
              </button>

              {selectedFile.file_url && (
                <button
                  className="btn btn-primary"
                  style={{
                    padding: '0.5rem 1.25rem', fontSize: '0.85rem',
                    background: zone === 'tutor' ? 'var(--zone-tutor)' : zone === 'coach' ? 'var(--zone-coach)' : 'var(--zone-student)',
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    cursor: 'pointer', border: 'none',
                  }}
                  onClick={async () => {
                    try {
                      await downloadFile(selectedFile);
                    } catch (err) {
                      console.error('Download failed:', err);
                      // Fallback: open in new tab
                      window.open(selectedFile.file_url!, '_blank');
                    }
                  }}
                >
                  <Download size={16} /> Download
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Full Resource Viewer Window */}
      {viewingFile && (
        <ResourceViewerModal
          file={viewingFile}
          onClose={() => setViewingFile(null)}
          onFileUpdated={(updated) => {
            setFiles(prev => prev.map(f => f.id === updated.id ? updated : f));
            setViewingFile(updated);
          }}
        />
      )}
    </div>
  );
}
