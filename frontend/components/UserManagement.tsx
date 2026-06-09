'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';

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

export default function UserManager() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'CREATOR', contactNumber: '', address: '' });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

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

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const payload = {
      fullName: form.fullName,
      email: form.email,
      password: form.password,
      role: form.role,
      // Contact number and address are only relevant for Learner/Viewer accounts.
      contactNumber: form.role === 'VIEWER' ? form.contactNumber : undefined,
      address: form.role === 'VIEWER' ? form.address : undefined,
    };

    const response = await apiFetch('/api/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data?.message || 'Could not create user.');
      return;
    }

    setForm({ fullName: '', email: '', password: '', role: 'CREATOR', contactNumber: '', address: '' });
    await loadUsers();
  }

  async function handleUpdateStatus(id: number, status: string) {
    const response = await apiFetch(`/api/users/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    if (response.ok) {
      await loadUsers();
    }
  }

  async function handleDisable(id: number) {
    await apiFetch(`/api/users/${id}`, { method: 'DELETE' });
    await loadUsers();
  }

  function handleSelect(user: User) {
    setSelectedUser(user);
  }

  function handleFieldChange(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  return (
    <div>
      <div className="card">
        <h2>Create New User</h2>
        <form onSubmit={handleCreate} className="form-grid">
          <label>
            Full Name
            <input
              className="input"
              type="text"
              value={form.fullName}
              onChange={(event) => handleFieldChange('fullName', event.target.value)}
              required
            />
          </label>
          <label>
            Email Address
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => handleFieldChange('email', event.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              className="input"
              type="password"
              value={form.password}
              onChange={(event) => handleFieldChange('password', event.target.value)}
              required
            />
          </label>
          <label>
            Role
            <select
              className="select"
              value={form.role}
              onChange={(event) => handleFieldChange('role', event.target.value)}
            >
              {roles.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
          </label>
          {form.role === 'VIEWER' ? (
            <>
              <label>
                Contact Number
                <input
                  className="input"
                  type="tel"
                  value={form.contactNumber}
                  onChange={(event) => handleFieldChange('contactNumber', event.target.value)}
                  placeholder="e.g. +44 7700 900123"
                  required
                />
              </label>
              <label>
                Address
                <input
                  className="input"
                  type="text"
                  value={form.address}
                  onChange={(event) => handleFieldChange('address', event.target.value)}
                  placeholder="e.g. 10 Downing Street, London"
                  required
                />
              </label>
            </>
          ) : null}
          <button className="btn" type="submit">
            Create User
          </button>
        </form>
        {error ? <div className="alert">{error}</div> : null}
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <div className="header">
          <div>
            <h2>User Directory</h2>
            <p className="description">Review all users and update account status.</p>
          </div>
        </div>
        {loading ? (
          <p>Loading users...</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Contact</th>
                  <th>Address</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.fullName}</td>
                    <td>{user.email}</td>
                    <td>{roleLabel(user.role)}</td>
                    <td>{user.contactNumber || '—'}</td>
                    <td>{user.address || '—'}</td>
                    <td>
                      <span className={statusClass(user.status)}>{user.status}</span>
                    </td>
                    <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="btn secondary" type="button" onClick={() => handleSelect(user)}>
                        Edit
                      </button>
                      <button className="btn secondary" type="button" onClick={() => handleDisable(user.id)} style={{ marginLeft: '0.5rem' }}>
                        Disable
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser ? (
        <div className="card" style={{ marginTop: '1rem' }}>
          <h2>Edit User: {selectedUser.fullName}</h2>
          <div className="form-grid two-cols">
            <label>
              Status
              <select className="select" value={selectedUser.status} onChange={(event) => handleUpdateStatus(selectedUser.id, event.target.value)}>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <p style={{ alignSelf: 'end' }}>
              Click a different status to save changes automatically.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
