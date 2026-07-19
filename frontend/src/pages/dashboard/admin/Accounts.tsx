import { useState, useEffect, useCallback } from 'react';
import type { Profile, UserRole, UserStatus } from '../../../types/lms';
import { getRoleDisplayName } from '../../../types/lms';
import { getAllAccounts, updateAccountStatus } from '../../../lib/admin';
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

  const [actionTarget, setActionTarget] = useState<{ profile: Profile; action: 'suspended' | 'blocked' | 'deleted' | 'approved' } | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

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

  const openAction = (profile: Profile, action: 'suspended' | 'blocked' | 'deleted' | 'approved') => {
    setActionTarget({ profile, action });
    setReason('');
  };

  const confirmAction = async () => {
    if (!actionTarget) return;
    setSubmitting(true);
    setError(null);
    try {
      await updateAccountStatus(actionTarget.profile.id, actionTarget.action, reason.trim() || undefined);
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

      {actionTarget && (
        <div className="modal-overlay" onClick={() => setActionTarget(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{actionLabel[actionTarget.action]} {actionTarget.profile.first_name} {actionTarget.profile.last_name}?</h3>
            <label>Reason {actionTarget.action !== 'approved' && '(shared with the account holder)'}</label>
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="admin-detail-actions">
              <button className="btn btn-outline" onClick={() => setActionTarget(null)} disabled={submitting}>Cancel</button>
              <button className="btn admin-btn-decline" onClick={confirmAction} disabled={submitting}>
                {submitting ? 'Working...' : `Confirm ${actionLabel[actionTarget.action]}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
