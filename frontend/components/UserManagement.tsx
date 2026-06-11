'use client';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '@/lib/api';

type User = {
  id: number;
  fullName: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
};

const roles = ['ADMIN', 'CREATOR', 'MANAGER', 'VIEWER'];
const statuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'status-pill status-active';
  if (status === 'SUSPENDED') return 'status-pill status-suspended';
  return 'status-pill status-inactive';
}

function roleClass(role: string) {
  if (role === 'ADMIN') return 'badge badge-admin';
  if (role === 'MANAGER') return 'badge badge-manager';
  if (role === 'CREATOR') return 'badge badge-creator';
  return 'badge badge-viewer';
}

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'CREATOR' });
  const [editId, setEditId] = useState<number | null>(null);
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

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
    setLoading(false);
  }

  useEffect(() => { loadUsers(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((u) =>
      u.fullName.toLowerCase().includes(term) ||
      u.email.toLowerCase().includes(term) ||
      u.role.toLowerCase().includes(term)
    );
  }, [users, search]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      const response = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data?.message || 'Could not create user.');
        return;
      }
      setForm({ fullName: '', email: '', password: '', role: 'CREATOR' });
      setShowAdd(false);
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: editRole, status: editStatus }),
      });
      if (!response.ok) {
        const data = await response.json();
        setError(data?.message || 'Could not update user.');
        return;
      }
      setEditId(null);
      await loadUsers();
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable(id: number) {
    if (!window.confirm('Disable this user account?')) return;
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    await loadUsers();
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Users</h1>
          <p className="description">Create accounts, update roles, and manage account status.</p>
        </div>
        <button className="btn" onClick={() => { setShowAdd(!showAdd); setError(''); }}>
          {showAdd ? 'Cancel' : '+ Add User'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>Create New User</h2>
          {error && <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div>}
          <form onSubmit={handleCreate}>
            <div className="form-grid two-cols">
              <div>
                <label className="field-label">Full Name *</label>
                <input className="input" type="text" required value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Jane Admin" />
              </div>
              <div>
                <label className="field-label">Email Address *</label>
                <input className="input" type="email" required value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. jane@example.com" />
              </div>
              <div>
                <label className="field-label">Password *</label>
                <input className="input" type="password" required value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set a password" />
              </div>
              <div>
                <label className="field-label">Role *</label>
                <select className="select" value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}>
                  {roles.map((role) => <option key={role} value={role}>{role}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
              <button className="btn secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {error && !showAdd && <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div>}

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..." style={{ marginTop: 0, flex: '1 1 280px', maxWidth: '420px' }} />
        </div>

        {loading ? (
          <p className="description" style={{ padding: '1rem 0' }}>Loading users...</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={6} style={{ textAlign: 'center', color: '#6b7280' }}>
                    {users.length === 0 ? 'No users found.' : 'No users match your search.'}
                  </td></tr>
                )}
                {filtered.map((user) => editId === user.id ? (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 500 }}>{user.fullName}</td>
                    <td style={{ color: '#6b7280' }}>{user.email}</td>
                    <td>
                      <select className="select" style={{ marginTop: 0, width: 'auto' }} value={editRole}
                        onChange={(e) => setEditRole(e.target.value)}>
                        {roles.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td>
                      <select className="select" style={{ marginTop: 0, width: 'auto' }} value={editStatus}
                        onChange={(e) => setEditStatus(e.target.value)}>
                        {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ color: '#6b7280' }}>{new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => handleSaveEdit(user.id)} disabled={saving}>Save</button>
                        <button className="btn secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={user.id}>
                    <td style={{ fontWeight: 500 }}>{user.fullName}</td>
                    <td style={{ color: '#6b7280' }}>{user.email}</td>
                    <td><span className={roleClass(user.role)}>{user.role}</span></td>
                    <td><span className={statusClass(user.status)}>{user.status}</span></td>
                    <td style={{ color: '#6b7280' }}>{new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                    <td>
                      <div className="row-actions">
                        <button className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                          onClick={() => { setEditId(user.id); setEditRole(user.role); setEditStatus(user.status); }}>Edit</button>
                        <button className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fecaca' }}
                          onClick={() => handleDisable(user.id)}>Disable</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
