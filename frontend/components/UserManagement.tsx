'use client';

import { useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

// Values match the backend Role enum; labels are what we show in the UI.
const roles: { value: string; label: string }[] = [
  { value: 'ADMIN', label: 'Admin' },
  { value: 'CREATOR', label: 'Creator' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'VIEWER', label: 'Learner/ Viewer' },
];

export default function UserManager() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ fullName: '', email: '', password: '', role: 'CREATOR', contactNumber: '', address: '' });

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
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
      const data = await response.json().catch(() => null);
      setError(data?.message || 'Could not create user.');
      return;
    }

    setForm({ fullName: '', email: '', password: '', role: 'CREATOR', contactNumber: '', address: '' });
    setSuccess('User created successfully.');
  }

  function handleFieldChange(field: string, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
    setSuccess('');
  }

  return (
    <div>
      <div className="card">
        <div className="header" style={{ marginBottom: '1rem' }}>
          <div>
            <h2 style={{ margin: 0 }}>Create New User</h2>
            <p className="description" style={{ margin: '0.35rem 0 0' }}>
              Add a team member or learner and assign their role.
            </p>
          </div>
          <Link href="/admin/users/directory" className="btn secondary">
            View Available Users
          </Link>
        </div>
        <form onSubmit={handleCreate} className="form-grid two-cols">
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
          <div className="form-actions">
            <button className="btn" type="submit">
              Create User
            </button>
          </div>
        </form>
        {error ? <div className="alert">{error}</div> : null}
        {success ? <div className="alert alert-success">{success}</div> : null}
      </div>
    </div>
  );
}
