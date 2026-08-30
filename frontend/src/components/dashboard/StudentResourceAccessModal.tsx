import { useState, useEffect, useCallback } from 'react';
import type { SharedFile } from '../../types/lms';
import { formatFileSize } from '../../types/lms';
import { getFiles, grantStudentResourceAccess, getStudentResourceGrants } from '../../lib/sharedDrive';
import { useModal } from '../../contexts/NotificationContext';
import {
  FileText, Film, Edit3, Book, BookOpen, Mic, Paperclip, X, Lock, CheckCircle2,
} from 'lucide-react';

interface StudentResourceAccessModalProps {
  student: { id: string; first_name: string; last_name: string };
  providerId: string;
  onClose: () => void;
  onSaved?: () => void;
}

const getIconForType = (type: string, size = 16) => {
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

/**
 * Lets a professional review and change what one student can see, at any time — not just at the
 * moment a booking is confirmed. Access is grant-based: a student sees nothing from this
 * professional unless it is granted here.
 */
export default function StudentResourceAccessModal({
  student, providerId, onClose, onSaved,
}: StudentResourceAccessModalProps) {
  const [grantOption, setGrantOption] = useState<'all' | 'specific' | 'none'>('none');
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { showModal } = useModal();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [loadedFiles, grants] = await Promise.all([
        getFiles({ uploadedBy: providerId }),
        getStudentResourceGrants(student.id, providerId),
      ]);
      setFiles(loadedFiles);
      if (grants.grantAll) {
        setGrantOption('all');
        setSelectedFileIds(new Set(loadedFiles.map((f) => f.id)));
      } else if (grants.fileIds.length > 0) {
        setGrantOption('specific');
        setSelectedFileIds(new Set(grants.fileIds));
      } else {
        setGrantOption('none');
        setSelectedFileIds(new Set());
      }
    } catch (err) {
      showModal({
        type: 'error',
        title: 'Could Not Load Access Settings',
        message: err instanceof Error ? err.message : 'Failed to load current resource access.',
        buttons: [{ label: 'Close', variant: 'primary', onClick: 'dismiss' }],
      });
    } finally {
      setLoading(false);
    }
  }, [providerId, student.id, showModal]);

  useEffect(() => { load(); }, [load]);

  const toggleFile = (id: string) => {
    setSelectedFileIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (grantOption === 'all') {
        await grantStudentResourceAccess(student.id, { grantAll: true, providerId });
      } else if (grantOption === 'specific') {
        await grantStudentResourceAccess(student.id, { fileIds: Array.from(selectedFileIds), providerId });
      } else {
        await grantStudentResourceAccess(student.id, { grantAll: false, fileIds: [], providerId });
      }
      onSaved?.();
      onClose();
    } catch (err) {
      showModal({
        type: 'error',
        title: 'Could Not Save',
        message: err instanceof Error ? err.message : 'Failed to update resource access.',
        buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }],
      });
    } finally {
      setSaving(false);
    }
  };

  const optionStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem 0.85rem',
    border: `1.5px solid ${active ? 'var(--color-primary-dark, #4A5D23)' : '#e2e8f0'}`,
    background: active ? 'rgba(139,183,63,0.08)' : '#fff',
    borderRadius: '10px', cursor: 'pointer', marginBottom: '0.5rem',
  });

  return (
    <div
      style={{
        position: 'fixed', inset: 0, backgroundColor: 'rgba(15,23,42,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '560px',
          maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.25rem', borderBottom: '1px solid #eef1f4' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Resource access</h3>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              What {student.first_name} {student.last_name} can see from your library
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '0.25rem' }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: '#64748b' }}>Loading current access…</p>
          ) : (
            <>
              <label style={optionStyle(grantOption === 'all')}>
                <input type="radio" name="grant-option" checked={grantOption === 'all'} onChange={() => setGrantOption('all')} style={{ marginTop: '0.2rem' }} />
                <span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <CheckCircle2 size={15} /> My whole library
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Includes anything you upload later.
                  </span>
                </span>
              </label>

              <label style={optionStyle(grantOption === 'specific')}>
                <input type="radio" name="grant-option" checked={grantOption === 'specific'} onChange={() => setGrantOption('specific')} style={{ marginTop: '0.2rem' }} />
                <span>
                  <span style={{ fontWeight: 600 }}>Only the files I pick</span>
                  <span style={{ display: 'block', fontSize: '0.8rem', color: '#64748b' }}>
                    New uploads stay private until you share them.
                  </span>
                </span>
              </label>

              <label style={optionStyle(grantOption === 'none')}>
                <input type="radio" name="grant-option" checked={grantOption === 'none'} onChange={() => setGrantOption('none')} style={{ marginTop: '0.2rem' }} />
                <span>
                  <span style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Lock size={15} /> Nothing
                  </span>
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    Revokes any access they currently have.
                  </span>
                </span>
              </label>

              {grantOption === 'specific' && (
                <div style={{ marginTop: '0.85rem', border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                  {files.length === 0 ? (
                    <p style={{ padding: '1rem', margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                      You haven't uploaded any resources yet.
                    </p>
                  ) : files.map((f) => (
                    <label key={f.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.6rem 0.8rem', borderBottom: '1px solid #f1f5f9', cursor: 'pointer' }}>
                      <input type="checkbox" checked={selectedFileIds.has(f.id)} onChange={() => toggleFile(f.id)} />
                      <span style={{ color: '#64748b', display: 'flex' }}>{getIconForType(f.file_type)}</span>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.title}</span>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{formatFileSize(f.file_size_bytes)}</span>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.6rem', justifyContent: 'flex-end', padding: '1rem 1.25rem', borderTop: '1px solid #eef1f4' }}>
          <button className="btn btn-outline" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || loading}>
            {saving ? 'Saving…' : 'Save access'}
          </button>
        </div>
      </div>
    </div>
  );
}
