import { useState, useEffect, useCallback } from 'react';
import { getRoleDisplayName } from '../../../types/lms';
import {
  getPendingApplications,
  getApplicationDetail,
  reviewApplication,
  type ApplicationSummary,
  type ApplicationDetail,
} from '../../../lib/admin';
import '../../../styles/admin.css';
import '../../../styles/messaging.css';
import '../../../styles/vetting.css';

export default function Applications() {
  const [applications, setApplications] = useState<ApplicationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ApplicationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadApplications = useCallback(async () => {
    setLoading(true);
    try {
      setApplications(await getPendingApplications());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadApplications(); }, [loadApplications]);

  const openDetail = async (id: string) => {
    setSelectedId(id);
    setReason('');
    setLoadingDetail(true);
    try {
      setDetail(await getApplicationDetail(id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load application detail');
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleDecision = async (decision: 'approved' | 'declined') => {
    if (!selectedId) return;
    if (decision === 'declined' && !reason.trim()) {
      setError('A reason is required when declining an application.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reviewApplication(selectedId, decision, reason.trim() || undefined);
      setSelectedId(null);
      setDetail(null);
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit decision');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="admin-page">
      <h2>Professional Applications</h2>
      <p className="admin-page-subtitle">Review and approve or decline pending tutor/coach applications.</p>

      {error && <div className="admin-error">{error}</div>}

      {loading ? (
        <p>Loading...</p>
      ) : applications.length === 0 ? (
        <p className="admin-empty-state">No pending applications right now.</p>
      ) : (
        <div className="admin-list">
          {applications.map((app) => (
            <div key={app.id} className="admin-list-row" onClick={() => openDetail(app.id)}>
              <div className="admin-list-row-avatar">
                {app.provider_details?.avatar_url
                  ? <img src={app.provider_details.avatar_url} alt="" />
                  : <span>{app.first_name[0]}{app.last_name[0]}</span>}
              </div>
              <div>
                <strong>{app.first_name} {app.last_name}</strong>
                <div className="admin-list-row-meta">{getRoleDisplayName(app.role)} &middot; {app.email}</div>
              </div>
              <button className="btn btn-outline btn-sm">View application</button>
            </div>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="modal-overlay" onClick={() => setSelectedId(null)}>
          <div className="modal-content admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            {loadingDetail || !detail ? (
              <p>Loading...</p>
            ) : (
              <>
                <h3>{detail.profile.first_name} {detail.profile.last_name} — {getRoleDisplayName(detail.profile.role)} Application</h3>

                {detail.providerDetails?.avatar_url && (
                  <img src={detail.providerDetails.avatar_url} alt="" className="admin-detail-photo" />
                )}

                <h4>About</h4>
                <p>{detail.providerDetails?.bio || '—'}</p>

                <h4>Specialities</h4>
                <div className="vetting-tag-list">
                  {(detail.providerDetails?.specialties ?? []).map((s) => (
                    <span key={s} className="vetting-tag">{s}</span>
                  ))}
                  {!(detail.providerDetails?.specialties ?? []).length && <span>—</span>}
                </div>

                <h4>Details</h4>
                <ul className="admin-detail-facts">
                  <li>Years of experience: {detail.providerDetails?.years_of_experience ?? '—'}</li>
                  <li>Location: {detail.providerDetails?.location ?? '—'}</li>
                  <li>Phone: {detail.providerDetails?.phone_number ?? '—'}</li>
                  <li>Preferred contact: {detail.providerDetails?.contact_preference ?? '—'}</li>
                  <li>Delivery: {[detail.providerDetails?.offers_virtual && 'Virtual', detail.providerDetails?.offers_in_person && 'In-person'].filter(Boolean).join(', ') || '—'}</li>
                </ul>

                <h4>Work history</h4>
                {detail.workExperiences.length === 0 ? <p>—</p> : detail.workExperiences.map((we) => (
                  <div key={we.id} className="vetting-list-item">
                    <div>
                      <strong>{we.title}</strong> at {we.company}
                      <div className="vetting-list-item-meta">{we.start_date ?? '—'} to {we.end_date ?? 'Present'}</div>
                      {we.description && <p>{we.description}</p>}
                    </div>
                  </div>
                ))}

                <h4>References</h4>
                {detail.references.length === 0 ? <p>—</p> : detail.references.map((r) => (
                  <div key={r.id} className="vetting-list-item">
                    <div>
                      <strong>{r.reference_name}</strong> {r.relationship && `(${r.relationship})`}
                      <div className="vetting-list-item-meta">{r.contact_info}</div>
                      {r.comment && <p>{r.comment}</p>}
                    </div>
                  </div>
                ))}

                <h4>Decision reason (required to decline, shared with the applicant)</h4>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />

                <div className="admin-detail-actions">
                  <button className="btn btn-outline" onClick={() => setSelectedId(null)} disabled={submitting}>Cancel</button>
                  <button className="btn admin-btn-decline" onClick={() => handleDecision('declined')} disabled={submitting}>Decline</button>
                  <button className="btn btn-primary" onClick={() => handleDecision('approved')} disabled={submitting}>Approve</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
