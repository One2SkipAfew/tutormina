import { useState, useEffect, useCallback } from 'react';
import type { Profile, UserRole, UserStatus, StudentType } from '../../../types/lms';
import { getRoleDisplayName } from '../../../types/lms';
import {
  getAllAccounts,
  updateAccountStatus,
  promoteToAdmin,
  getAccountEditDetail,
  adminUpdateProfileName,
  adminUpdateProviderDetails,
  adminUpdateStudentDetails,
} from '../../../lib/admin';
import '../../../styles/admin.css';
import '../../../styles/messaging.css';

const ROLE_OPTIONS: UserRole[] = ['customer', 'tutor', 'coach', 'admin'];
const STATUS_OPTIONS: UserStatus[] = ['pending', 'approved', 'declined', 'suspended', 'blocked', 'deleted'];

export default function Accounts() {
  const [accounts, setAccounts] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<UserStatus | ''>('');
  const [search, setSearch] = useState('');

  const [actionTarget, setActionTarget] = useState<{ profile: Profile; action: 'suspended' | 'blocked' | 'deleted' | 'approved' | 'make_admin' } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [editTarget, setEditTarget] = useState<Profile | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editBio, setEditBio] = useState('');
  const [editQualifications, setEditQualifications] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editYearsExperience, setEditYearsExperience] = useState('');
  const [editStudentType, setEditStudentType] = useState<StudentType | ''>('');
  const [editSchoolName, setEditSchoolName] = useState('');
  const [editGrade, setEditGrade] = useState('');
  const [editInstitutionName, setEditInstitutionName] = useState('');
  const [editCourseOfStudy, setEditCourseOfStudy] = useState('');
  const [editOccupation, setEditOccupation] = useState('');
  const [editEmployer, setEditEmployer] = useState('');
  const [editGoals, setEditGoals] = useState('');

  const isEditingProvider = editTarget?.role === 'tutor' || editTarget?.role === 'coach';

  const openEdit = async (profile: Profile) => {
    setEditTarget(profile);
    setEditLoading(true);
    try {
      const detail = await getAccountEditDetail(profile.id);
      setEditFirstName(detail.profile.first_name);
      setEditLastName(detail.profile.last_name);
      setEditBio(detail.providerDetails?.bio ?? '');
      setEditQualifications(detail.providerDetails?.qualifications ?? '');
      setEditLocation(detail.providerDetails?.location ?? detail.studentDetails?.location ?? '');
      setEditPhone(detail.providerDetails?.phone_number ?? '');
      setEditYearsExperience(detail.providerDetails?.years_of_experience?.toString() ?? '');
      setEditStudentType(detail.studentDetails?.student_type ?? '');
      setEditSchoolName(detail.studentDetails?.school_name ?? '');
      setEditGrade(detail.studentDetails?.grade ?? '');
      setEditInstitutionName(detail.studentDetails?.institution_name ?? '');
      setEditCourseOfStudy(detail.studentDetails?.course_of_study ?? '');
      setEditOccupation(detail.studentDetails?.occupation ?? '');
      setEditEmployer(detail.studentDetails?.employer ?? '');
      setEditGoals(detail.studentDetails?.goals ?? '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load account details');
      setEditTarget(null);
    } finally {
      setEditLoading(false);
    }
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setEditSaving(true);
    setError(null);
    try {
      await adminUpdateProfileName(editTarget.id, editFirstName, editLastName);
      if (isEditingProvider) {
        await adminUpdateProviderDetails(editTarget.id, {
          bio: editBio,
          qualifications: editQualifications,
          location: editLocation,
          phone_number: editPhone,
          years_of_experience: editYearsExperience ? Number(editYearsExperience) : null,
        });
      } else if (editTarget.role === 'customer') {
        await adminUpdateStudentDetails(editTarget.id, {
          student_type: editStudentType || null,
          school_name: editSchoolName,
          grade: editGrade,
          institution_name: editInstitutionName,
          course_of_study: editCourseOfStudy,
          occupation: editOccupation,
          employer: editEmployer,
          goals: editGoals,
        });
      }
      setEditTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save account');
    } finally {
      setEditSaving(false);
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setAccounts(await getAllAccounts({
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        search: search || undefined,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts');
    } finally {
      setLoading(false);
    }
  }, [roleFilter, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const openAction = (profile: Profile, action: 'suspended' | 'blocked' | 'deleted' | 'approved' | 'make_admin') => {
    setActionTarget({ profile, action });
    setReason('');
  };

  const confirmAction = async () => {
    if (!actionTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      if (actionTarget.action === 'make_admin') {
        await promoteToAdmin(actionTarget.profile.id);
      } else {
        await updateAccountStatus(actionTarget.profile.id, actionTarget.action, reason.trim() || undefined);
      }
      setActionTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
    } finally {
      setSubmitting(false);
    }
  };

  const actionLabel: Record<string, string> = {
    suspended: 'Suspend',
    blocked: 'Block',
    deleted: 'Deactivate',
    approved: 'Reactivate',
    make_admin: 'Make Admin',
  };

  return (
    <div className="admin-page">
      <h2>Manage Accounts</h2>
      <p className="admin-page-subtitle">Suspend, block, reactivate, or deactivate student and professional accounts.</p>

      {error && <div className="admin-error">{error}</div>}

      <div className="admin-filters">
        <input type="text" placeholder="Search name or email..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value as UserRole | '')}>
          <option value="">All roles</option>
          {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{getRoleDisplayName(r)}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as UserStatus | '')}>
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : accounts.length === 0 ? (
        <p className="admin-empty-state">No accounts match these filters.</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id}>
                <td>{a.first_name} {a.last_name}</td>
                <td>{a.email}</td>
                <td>{getRoleDisplayName(a.role)}</td>
                <td><span className={`admin-status-badge admin-status-${a.status}`}>{a.status}</span></td>
                <td className="admin-table-actions">
                  <button className="btn btn-outline btn-sm" onClick={() => openEdit(a)}>Edit</button>
                  {a.role !== 'admin' && <button className="btn btn-outline btn-sm" onClick={() => openAction(a, 'make_admin')}>Make Admin</button>}
                  {a.status !== 'suspended' && <button className="btn btn-outline btn-sm" onClick={() => openAction(a, 'suspended')}>Suspend</button>}
                  {a.status !== 'blocked' && <button className="btn btn-outline btn-sm" onClick={() => openAction(a, 'blocked')}>Block</button>}
                  {a.status !== 'approved' && <button className="btn btn-outline btn-sm" onClick={() => openAction(a, 'approved')}>Reactivate</button>}
                  {a.status !== 'deleted' && <button className="btn btn-outline btn-sm" onClick={() => openAction(a, 'deleted')}>Deactivate</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {editTarget && (
        <div className="modal-overlay" onClick={() => !editSaving && setEditTarget(null)}>
          <div className="modal-content admin-detail-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Edit {editTarget.first_name} {editTarget.last_name}</h3>
            {editLoading ? (
              <p>Loading...</p>
            ) : (
              <>
                <label>First name</label>
                <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
                <label>Last name</label>
                <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />

                {isEditingProvider && (
                  <>
                    <label>Bio</label>
                    <textarea rows={3} value={editBio} onChange={(e) => setEditBio(e.target.value)} />
                    <label>Qualifications</label>
                    <input type="text" value={editQualifications} onChange={(e) => setEditQualifications(e.target.value)} />
                    <label>Location</label>
                    <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} />
                    <label>Phone</label>
                    <input type="text" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
                    <label>Years of experience</label>
                    <input type="number" min={0} value={editYearsExperience} onChange={(e) => setEditYearsExperience(e.target.value)} />
                  </>
                )}

                {editTarget.role === 'customer' && (
                  <>
                    <label>Student type</label>
                    <select value={editStudentType} onChange={(e) => setEditStudentType(e.target.value as StudentType | '')}>
                      <option value="">—</option>
                      <option value="scholar">Scholar</option>
                      <option value="student">Student</option>
                      <option value="professional">Professional</option>
                    </select>
                    {editStudentType === 'scholar' && (
                      <>
                        <label>School name</label>
                        <input type="text" value={editSchoolName} onChange={(e) => setEditSchoolName(e.target.value)} />
                        <label>Grade</label>
                        <input type="text" value={editGrade} onChange={(e) => setEditGrade(e.target.value)} />
                      </>
                    )}
                    {editStudentType === 'student' && (
                      <>
                        <label>Institution</label>
                        <input type="text" value={editInstitutionName} onChange={(e) => setEditInstitutionName(e.target.value)} />
                        <label>Course of study</label>
                        <input type="text" value={editCourseOfStudy} onChange={(e) => setEditCourseOfStudy(e.target.value)} />
                      </>
                    )}
                    {editStudentType === 'professional' && (
                      <>
                        <label>Occupation</label>
                        <input type="text" value={editOccupation} onChange={(e) => setEditOccupation(e.target.value)} />
                        <label>Employer</label>
                        <input type="text" value={editEmployer} onChange={(e) => setEditEmployer(e.target.value)} />
                        <label>Goals</label>
                        <textarea rows={2} value={editGoals} onChange={(e) => setEditGoals(e.target.value)} />
                      </>
                    )}
                  </>
                )}

                <div className="admin-detail-actions">
                  <button className="btn btn-outline" onClick={() => setEditTarget(null)} disabled={editSaving}>Cancel</button>
                  <button className="btn btn-primary" onClick={saveEdit} disabled={editSaving}>{editSaving ? 'Saving...' : 'Save Changes'}</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {actionTarget && (
        <div className="modal-overlay" onClick={() => setActionTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{actionLabel[actionTarget.action]} {actionTarget.profile.first_name} {actionTarget.profile.last_name}?</h3>
            {actionTarget.action === 'make_admin' ? (
              <p>This grants full admin access, including managing accounts, applications, and platform settings.</p>
            ) : (
              <>
                <label>Reason {actionTarget.action !== 'approved' && '(shared with the account holder)'}</label>
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </>
            )}
            <div className="admin-detail-actions">
              <button className="btn btn-outline" onClick={() => setActionTarget(null)} disabled={submitting}>Cancel</button>
              <button className={`btn ${actionTarget.action === 'make_admin' ? '' : 'admin-btn-decline'}`} onClick={confirmAction} disabled={submitting}>
                {submitting ? 'Working...' : `Confirm ${actionLabel[actionTarget.action]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
