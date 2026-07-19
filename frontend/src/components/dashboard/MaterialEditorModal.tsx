import { useState, useRef } from 'react';
import type { Folder } from '../../types/lms';

interface MaterialEditorModalProps {
  onClose: () => void;
  onSave: (file: File, title: string, description: string, folderId?: string) => Promise<void>;
  folders: Folder[];
  currentFolderId: string | null;
}

export default function MaterialEditorModal({ onClose, onSave, folders, currentFolderId }: MaterialEditorModalProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFolder, setSelectedFolder] = useState<string>(currentFolderId || 'root');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormatting = (prefix: string, suffix: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = content.substring(start, end);

    const newContent = 
      content.substring(0, start) + 
      prefix + 
      (selectedText || 'text') + 
      suffix + 
      content.substring(end);

    setContent(newContent);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + prefix.length,
        start + prefix.length + (selectedText ? selectedText.length : 4)
      );
    }, 0);
  };

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) {
      setError('Title and content are required.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      // Create a markdown file from the content
      const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeTitle}.md`;
      const file = new File([content], filename, { type: 'text/markdown' });

      await onSave(
        file, 
        title.trim(), 
        description.trim(), 
        selectedFolder === 'root' ? undefined : selectedFolder
      );
      
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save material.');
      setSaving(false);
    }
  };

  const toolbarBtnStyle = {
    background: 'none', border: '1px solid #ddd', padding: '0.25rem 0.5rem',
    borderRadius: '4px', cursor: 'pointer', fontSize: '0.9rem',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600
  };

  return (
    <div className="upload-modal-overlay" onClick={onClose} style={{ zIndex: 1100 }}>
      <div className="upload-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '90vw' }}>
        <div className="upload-modal-header">
          <h3 className="upload-modal-title">📝 Create Material</h3>
          <button className="upload-modal-close" onClick={onClose}>×</button>
        </div>
        
        <div className="upload-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', maxHeight: '75vh', overflowY: 'auto' }}>
          {error && <div style={{ color: '#d32f2f', background: '#ffebee', padding: '0.5rem', borderRadius: '4px', fontSize: '0.85rem' }}>{error}</div>}
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="upload-form-group">
              <label className="upload-form-label">Title</label>
              <input
                className="upload-form-input"
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g. Chapter 1: Introduction"
                autoFocus
              />
            </div>
            
            <div className="upload-form-group">
              <label className="upload-form-label">Folder</label>
              <select 
                className="upload-form-select"
                value={selectedFolder}
                onChange={e => setSelectedFolder(e.target.value)}
              >
                <option value="root">📁 Root / Unfiled</option>
                {folders.map(f => (
                  <option key={f.id} value={f.id}>📁 {f.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="upload-form-group">
            <label className="upload-form-label">Description (Optional)</label>
            <input
              className="upload-form-input"
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Brief summary of these notes"
            />
          </div>

          <div className="upload-form-group" style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: '350px' }}>
            <label className="upload-form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <span>Content</span>
              <span style={{ fontSize: '0.75rem', color: '#666', fontWeight: 400 }}>Supports Markdown</span>
            </label>
            
            <div style={{ display: 'flex', gap: '0.25rem', padding: '0.5rem', background: '#f5f5f5', border: '1px solid rgba(0,0,0,0.12)', borderBottom: 'none', borderRadius: '8px 8px 0 0' }}>
              <button style={toolbarBtnStyle} onClick={() => insertFormatting('**', '**')} title="Bold">B</button>
              <button style={{...toolbarBtnStyle, fontStyle: 'italic'}} onClick={() => insertFormatting('*', '*')} title="Italic">I</button>
              <div style={{ width: '1px', background: '#ccc', margin: '0 0.25rem' }} />
              <button style={toolbarBtnStyle} onClick={() => insertFormatting('### ', '')} title="Heading">H</button>
              <div style={{ width: '1px', background: '#ccc', margin: '0 0.25rem' }} />
              <button style={toolbarBtnStyle} onClick={() => insertFormatting('- ', '')} title="Bulleted List">• List</button>
              <button style={toolbarBtnStyle} onClick={() => insertFormatting('1. ', '')} title="Numbered List">1. List</button>
              <div style={{ width: '1px', background: '#ccc', margin: '0 0.25rem' }} />
              <button style={toolbarBtnStyle} onClick={() => insertFormatting('==', '==')} title="Highlight">Highlighter</button>
            </div>
            
            <textarea
              ref={textareaRef}
              className="upload-form-textarea"
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Start writing your notes here..."
              style={{ flex: 1, borderTopLeftRadius: 0, borderTopRightRadius: 0, minHeight: '300px', resize: 'vertical', fontFamily: 'monospace', fontSize: '0.9rem', lineHeight: 1.5 }}
            />
          </div>
        </div>

        <div className="upload-modal-footer">
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || !title.trim() || !content.trim()}>
            {saving ? 'Saving...' : 'Save Material'}
          </button>
        </div>
      </div>
    </div>
  );
}
