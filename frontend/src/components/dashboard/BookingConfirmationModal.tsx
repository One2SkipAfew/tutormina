import { useState, useEffect } from 'react';
import type { SharedFile, StudentDetails, Booking } from '../../types/lms';
import { getFiles, grantStudentResourceAccess } from '../../lib/sharedDrive';
import { getStudentTypeLabels } from '../../lib/studentDetails';
import { useModal } from '../../contexts/NotificationContext';
import { formatFileSize } from '../../types/lms';
import {
  Calendar,
  Clock,
  BookOpen,
  FileText,
  Film,
  Edit3,
  Book,
  Mic,
  Paperclip,
  CheckCircle2,
  Lock,
  X
} from 'lucide-react';

export interface PopulatedBooking extends Booking {
  customer: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    avatar_url: string | null;
    student_details: StudentDetails | StudentDetails[] | null;
  };
}

interface BookingConfirmationModalProps {
  booking: PopulatedBooking;
  providerId: string;
  onClose: () => void;
  onConfirm: (booking: PopulatedBooking, grantOption: 'all' | 'specific' | 'none', selectedFileIds: string[]) => Promise<void>;
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

export default function BookingConfirmationModal({
  booking,
  providerId,
  onClose,
  onConfirm,
}: BookingConfirmationModalProps) {
  const [grantOption, setGrantOption] = useState<'all' | 'specific' | 'none'>('all');
  const [files, setFiles] = useState<SharedFile[]>([]);
  const [selectedFileIds, setSelectedFileIds] = useState<Set<string>>(new Set());
  const [loadingResources, setLoadingResources] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { showModal } = useModal();

  const sessionTime = new Date(booking.session_date);
  const endTime = new Date(sessionTime.getTime() + booking.duration_minutes * 60000);
  const isIntroCall = booking.booking_type === 'intro_call';

  const studentDetails = Array.isArray(booking.customer?.student_details)
    ? booking.customer.student_details[0]
    : booking.customer?.student_details;

  const studentLabels = studentDetails?.student_type ? getStudentTypeLabels(studentDetails.student_type) : null;

  useEffect(() => {
    async function loadProviderResources() {
      setLoadingResources(true);
      try {
        const loadedFiles = await getFiles({ uploadedBy: providerId });
        setFiles(loadedFiles);
        // By default select all if switching to specific
        setSelectedFileIds(new Set(loadedFiles.map(f => f.id)));
      } catch (err) {
        console.error('Failed to load resources for booking confirmation:', err);
      } finally {
        setLoadingResources(false);
      }
    }
    loadProviderResources();
  }, [providerId]);

  const toggleFile = (id: string) => {
    setSelectedFileIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleApprove = async () => {
    setSubmitting(true);
    try {
      // 1. Grant resource access based on chosen option
      if (grantOption === 'all') {
        await grantStudentResourceAccess(booking.customer.id, { grantAll: true, providerId });
      } else if (grantOption === 'specific') {
        await grantStudentResourceAccess(booking.customer.id, { fileIds: Array.from(selectedFileIds), providerId });
      } else {
        // Option 'none'
        await grantStudentResourceAccess(booking.customer.id, { grantAll: false, fileIds: [], providerId });
      }

      // 2. Call parent to confirm booking status
      await onConfirm(booking, grantOption, Array.from(selectedFileIds));
      onClose();
    } catch (err) {
      // Without this the professional clicks Approve and simply sees nothing happen.
      console.error('Error approving booking and setting resource access:', err);
      showModal({
        type: 'error',
        title: 'Could Not Approve Booking',
        message: err instanceof Error ? err.message : 'Something went wrong approving this booking. Please try again.',
        buttons: [{ label: 'Try Again', variant: 'primary', onClick: 'dismiss' }],
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '680px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 20px 40px -10px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '1.25rem 1.5rem',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={22} color="#16a34a" /> Confirm Link &amp; Resource Access
            </h2>
            <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem', color: '#64748b' }}>
              Review the prospective student's request and specify which resources they can access.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              color: '#94a3b8',
              padding: '0.4rem',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Student Card */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
              padding: '1rem',
              background: '#f8fafc',
              borderRadius: '12px',
              border: '1px solid #e2e8f0',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: '#e2e8f0',
                backgroundImage: booking.customer.avatar_url ? `url(${booking.customer.avatar_url})` : undefined,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.1rem',
                fontWeight: 700,
                color: '#64748b',
                flexShrink: 0,
              }}
            >
              {!booking.customer.avatar_url && `${booking.customer.first_name?.[0] ?? ''}${booking.customer.last_name?.[0] ?? ''}`}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#1e293b' }}>
                  {booking.customer.first_name} {booking.customer.last_name}
                </h4>
                {studentLabels && (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#e0f2fe',
                      color: '#0369a1',
                      fontWeight: 600,
                    }}
                  >
                    {studentLabels.typeLabel}
                  </span>
                )}
                {isIntroCall ? (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#fef3c7',
                      color: '#92400e',
                      fontWeight: 700,
                    }}
                  >
                    ☕ Free Intro Call
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '0.72rem',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background: '#dcfce7',
                      color: '#15803d',
                      fontWeight: 700,
                    }}
                  >
                    📅 Session Booking
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '0.2rem' }}>
                {booking.customer.email}
                {studentDetails?.grade && ` • Grade ${studentDetails.grade}`}
                {studentDetails?.school_name && ` • ${studentDetails.school_name}`}
                {studentDetails?.institution_name && ` • ${studentDetails.institution_name}`}
                {studentDetails?.course_of_study && ` • ${studentDetails.course_of_study}`}
                {studentDetails?.occupation && ` • ${studentDetails.occupation}`}
              </div>
            </div>
          </div>

          {/* Session Details */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '0.75rem',
              padding: '0.9rem',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              fontSize: '0.85rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155' }}>
              <Calendar size={16} color="#0284c7" />
              <span><strong>Date:</strong> {sessionTime.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#334155' }}>
              <Clock size={16} color="#0284c7" />
              <span><strong>Time:</strong> {sessionTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({booking.duration_minutes} min)</span>
            </div>
            {(booking.student_topic || booking.student_note) && (
              <div style={{ gridColumn: '1 / -1', marginTop: '0.25rem', paddingTop: '0.5rem', borderTop: '1px solid #f1f5f9' }}>
                {booking.student_topic && <div style={{ color: '#0f172a' }}><strong>Requested Topic:</strong> {booking.student_topic}</div>}
                {booking.student_note && <div style={{ color: '#64748b', marginTop: '0.2rem', fontStyle: 'italic' }}>"{booking.student_note}"</div>}
              </div>
            )}
          </div>

          {/* Resource Access Selection */}
          <div>
            <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', marginBottom: '0.4rem' }}>
              Resource Access Permissions
            </label>
            <p style={{ fontSize: '0.82rem', color: '#64748b', margin: '0 0 0.75rem 0' }}>
              Choose which resources this student will be able to view and download in their SharedDrive.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              {/* Option 1: All Resources */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: `2px solid ${grantOption === 'all' ? '#16a34a' : '#e2e8f0'}`,
                  background: grantOption === 'all' ? '#f0fdf4' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="resource_grant"
                  checked={grantOption === 'all'}
                  onChange={() => setGrantOption('all')}
                  style={{ marginTop: '0.2rem', accentColor: '#16a34a' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <BookOpen size={16} color="#16a34a" /> Grant access to all my student resources <span style={{ fontSize: '0.72rem', background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '8px' }}>Recommended</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    The student will be able to access all current and future resources uploaded with "Students Only" or "Public" visibility.
                  </div>
                </div>
              </label>

              {/* Option 2: Specific Resources */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: `2px solid ${grantOption === 'specific' ? '#0284c7' : '#e2e8f0'}`,
                  background: grantOption === 'specific' ? '#f0f9ff' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="resource_grant"
                  checked={grantOption === 'specific'}
                  onChange={() => setGrantOption('specific')}
                  style={{ marginTop: '0.2rem', accentColor: '#0284c7' }}
                />
                <div style={{ width: '100%' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Edit3 size={16} color="#0284c7" /> Select specific resources
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    Grant access only to chosen study materials, past papers, or recordings.
                  </div>
                </div>
              </label>

              {/* Specific Resource Checklist Drawer */}
              {grantOption === 'specific' && (
                <div
                  style={{
                    padding: '0.75rem',
                    background: '#f8fafc',
                    borderRadius: '10px',
                    border: '1px solid #cbd5e1',
                    maxHeight: '220px',
                    overflowY: 'auto',
                  }}
                >
                  {loadingResources ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      Loading your resources...
                    </div>
                  ) : files.length === 0 ? (
                    <div style={{ padding: '1rem', textAlign: 'center', color: '#64748b', fontSize: '0.85rem' }}>
                      You have not uploaded any resources to your SharedDrive yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.4rem', borderBottom: '1px solid #e2e8f0', fontSize: '0.78rem', color: '#64748b' }}>
                        <span>{selectedFileIds.size} of {files.length} items selected</span>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedFileIds(new Set(files.map(f => f.id)))}
                            style={{ border: 'none', background: 'none', color: '#0284c7', cursor: 'pointer', fontWeight: 600, fontSize: '0.78rem' }}
                          >
                            Select All
                          </button>
                          <span>•</span>
                          <button
                            type="button"
                            onClick={() => setSelectedFileIds(new Set())}
                            style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer', fontSize: '0.78rem' }}
                          >
                            Clear
                          </button>
                        </div>
                      </div>

                      {/* Files checklist */}
                      {files.map(file => (
                        <label
                          key={file.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.6rem',
                            padding: '0.4rem 0.5rem',
                            background: '#ffffff',
                            borderRadius: '6px',
                            border: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            fontSize: '0.83rem',
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedFileIds.has(file.id)}
                            onChange={() => toggleFile(file.id)}
                            style={{ accentColor: '#0284c7' }}
                          />
                          <span style={{ color: '#0284c7', display: 'flex', alignItems: 'center' }}>
                            {getIconForType(file.file_type)}
                          </span>
                          <span style={{ flex: 1, fontWeight: 600, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {file.title}
                          </span>
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', flexShrink: 0 }}>
                            {formatFileSize(file.file_size_bytes)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Option 3: None */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '0.75rem',
                  padding: '0.85rem 1rem',
                  borderRadius: '10px',
                  border: `2px solid ${grantOption === 'none' ? '#94a3b8' : '#e2e8f0'}`,
                  background: grantOption === 'none' ? '#f8fafc' : '#ffffff',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <input
                  type="radio"
                  name="resource_grant"
                  checked={grantOption === 'none'}
                  onChange={() => setGrantOption('none')}
                  style={{ marginTop: '0.2rem', accentColor: '#64748b' }}
                />
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Lock size={16} color="#64748b" /> Confirm booking link only (no resource access)
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.2rem' }}>
                    The student can join your session, but will not see your uploaded resources until you grant access later.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '1rem 1.5rem',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '0.75rem',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '0.6rem 1.25rem', fontSize: '0.9rem' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleApprove}
            disabled={submitting || (grantOption === 'specific' && selectedFileIds.size === 0 && files.length > 0)}
            style={{
              padding: '0.6rem 1.5rem',
              fontSize: '0.9rem',
              background: '#16a34a',
              borderColor: '#16a34a',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontWeight: 700,
            }}
          >
            {submitting ? 'Confirming...' : 'Approve & Confirm Access'}
          </button>
        </div>
      </div>
    </div>
  );
}
