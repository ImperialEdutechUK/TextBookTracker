'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/session';

type User = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
  contactNumber?: string | null;
  address?: string | null;
  createdAt: string;
};

// Values match the backend Role enum; labels are what we show in the UI.
const roles: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'CREATOR', label: 'Creator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'VIEWER', label: 'Learner/ Viewer' },
];
const statuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

function roleLabel(role: string) {
  return roles.find((r) => r.value === role)?.label ?? role;
}

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'status-pill status-active';
  if (status === 'SUSPENDED') return 'status-pill status-suspended';
  return 'status-pill status-inactive';
}

function roleBadgeClass(role: string) {
  if (role === 'ADMIN') return 'badge badge-admin';
  if (role === 'MANAGER') return 'badge badge-manager';
  if (role === 'CREATOR') return 'badge badge-creator';
  return 'badge badge-viewer';
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase() || '?';
}

type EditForm = {
  fullName: string;
  contactNumber: string;
  address: string;
  status: string;
};

export default function UserDirectory() {
  const { session } = useSession();
  // Only admins manage accounts here. Creators/Managers get a read-only
  // directory of learners (the backend already scopes the list to VIEWERs).
  const isAdmin = session?.role === 'ADMIN';

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');

  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editForm, setEditForm] = useState<EditForm | null>(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  // The user pending permanent deletion (drives the confirmation dialog).
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);

  async function loadUsers() {
    setLoading(true);
    const response = await apiFetch('/api/users');
    if (!response.ok) {
      setError('Unable to load users.');
      setLoading(false);
      return;
    }
    const data = await response.json();
    setUsers(data.users);
    setError('');
    setLoading(false);
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedUser || !editForm) return;
    setEditError('');
    setSaving(true);

    const response = await apiFetch(`/api/users/${selectedUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: editForm.fullName,
        contactNumber: editForm.contactNumber,
        address: editForm.address,
        status: editForm.status,
      }),
    });

    setSaving(false);

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setEditError(data?.message || 'Could not update user.');
      return;
    }

    closeEdit();
    await loadUsers();
  }

  async function handleDisable(id: number) {
    await apiFetch(`/api/users/${id}/disable`, { method: 'PATCH' });
    await loadUsers();
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setError('');
    const response = await apiFetch(`/api/users/${deleteTarget.id}`, { method: 'DELETE' });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      setError(data?.message || 'Could not delete user.');
      setDeleteTarget(null);
      return;
    }

    // Clear the edit panel if it was showing the user we just removed.
    if (selectedUser?.id === deleteTarget.id) closeEdit();
    setDeleteTarget(null);
    await loadUsers();
  }

  function openEdit(user: User) {
    setSelectedUser(user);
    setEditForm({
      fullName: user.fullName,
      contactNumber: user.contactNumber ?? '',
      address: user.address ?? '',
      status: user.status,
    });
    setEditError('');
  }

  function closeEdit() {
    setSelectedUser(null);
    setEditForm(null);
    setEditError('');
  }

  function handleEditFieldChange(field: keyof EditForm, value: string) {
    setEditForm((current) => (current ? { ...current, [field]: value } : current));
  }

  const query = search.trim().toLowerCase();
  const filteredUsers = query
    ? users.filter((user) => user.fullName.toLowerCase().includes(query))
    : users;

  return (
    <>
      <div className="directory-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>User Directory</h2>
          <p className="description" style={{ margin: '0.35rem 0 0' }}>
            {loading
              ? 'Loading users…'
              : query
                ? `${filteredUsers.length} of ${users.length} ${users.length === 1 ? 'user' : 'users'} matching “${search.trim()}”.`
                : `${users.length} ${users.length === 1 ? 'user' : 'users'} in total.`}
          </p>
        </div>
        <div className="search-field">
          <span className="search-icon" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            className="input search-input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name…"
            aria-label="Search users by name"
          />
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {loading ? (
        <p>Loading users...</p>
      ) : users.length === 0 ? (
        <p className="catalog-empty">No users found.</p>
      ) : filteredUsers.length === 0 ? (
        <p className="catalog-empty">No users match “{search.trim()}”.</p>
      ) : (
        <div className="user-grid">
          {filteredUsers.map((user) => (
            <article key={user.id} className="user-card">
              <div className="user-card-top">
                <span className="user-avatar" aria-hidden="true">
                  {initials(user.fullName)}
                </span>
                <div className="user-card-identity">
                  <h3 className="user-card-name">{user.fullName}</h3>
                  <span className="user-card-email">{user.email}</span>
                </div>
              </div>

              <div className="user-card-tags">
                <span className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</span>
                <span className={statusClass(user.status)}>{user.status}</span>
              </div>

              <dl className="user-card-details">
                <div>
                  <dt>Contact</dt>
                  <dd>{user.contactNumber || '—'}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{user.address || '—'}</dd>
                </div>
                <div>
                  <dt>Created</dt>
                  <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
                </div>
              </dl>

              {isAdmin ? (
                <div className="user-card-actions">
                  <button className="btn sm secondary" type="button" onClick={() => openEdit(user)}>
                    Edit
                  </button>
                  <button className="btn sm ghost" type="button" onClick={() => handleDisable(user.id)}>
                    Disable
                  </button>
                  <button className="btn sm danger" type="button" onClick={() => setDeleteTarget(user)}>
                    Delete
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}

      {selectedUser && editForm ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal modal-wide">
            <h2 className="modal-title">Edit User</h2>
            <p className="modal-text" style={{ marginBottom: '1.25rem' }}>
              Update profile details. Email and role are locked.
            </p>

            {/* Read-only identity fields. */}
            <div className="readonly-grid">
              <div className="readonly-field">
                <span className="readonly-label">Email</span>
                <span className="readonly-value">{selectedUser.email}</span>
              </div>
              <div className="readonly-field">
                <span className="readonly-label">Role</span>
                <span className="readonly-value">{roleLabel(selectedUser.role)}</span>
              </div>
            </div>

            <form onSubmit={handleSaveEdit} className="form-grid two-cols" style={{ marginTop: '1.25rem' }}>
              <label>
                Full Name
                <input
                  className="input"
                  type="text"
                  value={editForm.fullName}
                  onChange={(event) => handleEditFieldChange('fullName', event.target.value)}
                  required
                />
              </label>
              <label>
                Status
                <select
                  className="select"
                  value={editForm.status}
                  onChange={(event) => handleEditFieldChange('status', event.target.value)}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Contact Number
                <input
                  className="input"
                  type="tel"
                  value={editForm.contactNumber}
                  onChange={(event) => handleEditFieldChange('contactNumber', event.target.value)}
                  placeholder="e.g. +44 7700 900123"
                />
              </label>
              <label>
                Address
                <input
                  className="input"
                  type="text"
                  value={editForm.address}
                  onChange={(event) => handleEditFieldChange('address', event.target.value)}
                  placeholder="e.g. 10 Downing Street, London"
                />
              </label>

              <div className="form-actions">
                <button className="btn ghost" type="button" onClick={closeEdit} disabled={saving}>
                  Cancel
                </button>
                <button className="btn" type="submit" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>

            {editError ? <div className="alert">{editError}</div> : null}
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal">
            <h2 className="modal-title">Delete user</h2>
            <p className="modal-text">
              Sure want to delete user <strong>{deleteTarget.fullName}</strong>?
              <br />
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button className="btn ghost" type="button" onClick={handleConfirmDelete}>
                Yes
              </button>
              <button className="btn danger" type="button" onClick={() => setDeleteTarget(null)}>
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
