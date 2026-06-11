'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type Learner = {
  id: string; fullName: string; email: string; status: string;
  contactNumber: string | null; course: string | null;
  units: string | null; address: string | null;
};

const emptyForm = { fullName: '', email: '', password: '', contactNumber: '', course: '', units: '', address: '' };

export default function LearnersPage() {
  const router = useRouter();
  const [learners, setLearners] = useState<Learner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadLearners() {
    try {
      const res = await apiFetch('/api/users?role=VIEWER');
      if (res.ok) {
        const d = await res.json();
        setLearners(d.users);
        setError('');
      } else if (res.status === 403) {
        setError('Only admins can manage learners.');
      } else {
        setError('Unable to load learners.');
      }
    } catch {
      setError('Unable to load learners. Check that the backend is running.');
    }
  }

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (sRes) => {
        if (!sRes.ok) throw new Error('Unauthorized');
        if (!active) return;
        await loadLearners();
        if (active) setLoading(false);
      })
      .catch(() => router.replace('/login'));
    return () => { active = false; };
  }, [router]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await apiFetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, role: 'VIEWER' }),
      });
      if (!res.ok) { const d = await res.json(); setError(d.message ?? 'Failed to add learner.'); }
      else { setForm(emptyForm); setShowAdd(false); await loadLearners(); }
    } catch {
      setError('Failed to add learner. Check that the backend is running.');
    } finally { setSaving(false); }
  }

  async function handleSaveEdit(id: string) {
    setSaving(true); setError('');
    try {
      const res = await apiFetch(`/api/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) { const d = await res.json(); setError(d.message ?? 'Failed to update.'); }
      else { setEditId(null); await loadLearners(); }
    } catch {
      setError('Failed to update. Check that the backend is running.');
    } finally { setSaving(false); }
  }

  if (loading) {
    return <main className="main-shell"><p className="description">Loading...</p></main>;
  }

  return (
    <main className="main-shell">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h1 className="page-title">Learners</h1>
          <p className="description">Manage learner profiles and course enrolments.</p>
        </div>
        <button className="btn" onClick={() => { setShowAdd(!showAdd); setError(''); }}>
          {showAdd ? 'Cancel' : '+ Add Learner'}
        </button>
      </div>

      {showAdd && (
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 className="section-title" style={{ marginBottom: '1rem' }}>New Learner</h2>
          {error && <div className="alert">{error}</div>}
          <form onSubmit={handleAdd}>
            <div className="form-grid two-cols" style={{ marginTop: '1rem' }}>
              <div><label className="field-label">Full Name *</label><input className="input" required value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} placeholder="e.g. Ket Lau" /></div>
              <div><label className="field-label">Email *</label><input className="input" type="email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="e.g. meena@yahoo.com" /></div>
              <div><label className="field-label">Password *</label><input className="input" type="password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Set a password" /></div>
              <div><label className="field-label">Contact Number</label><input className="input" value={form.contactNumber} onChange={e => setForm({ ...form, contactNumber: e.target.value })} placeholder="e.g. 0567490236" /></div>
              <div><label className="field-label">Course</label><input className="input" value={form.course} onChange={e => setForm({ ...form, course: e.target.value })} placeholder="e.g. ATHE Level 3 Diploma in Health and Social Care" /></div>
              <div><label className="field-label">Units</label><input className="input" value={form.units} onChange={e => setForm({ ...form, units: e.target.value })} placeholder="e.g. All (06 units available)" /></div>
            </div>
            <div style={{ marginTop: '1rem' }}>
              <label className="field-label">Address</label>
              <textarea className="input" rows={2} value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="e.g. 20 Sandy Close, Bradley Stoke, BS32 8AJ, United Kingdom" style={{ resize: 'vertical' }} />
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
              <button className="btn" type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Learner'}</button>
              <button className="btn secondary" type="button" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="card">
        {error && !showAdd && <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div>}
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Contact</th><th>Course</th><th>Units</th><th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {learners.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign: 'center', color: '#6b7280' }}>No learners yet. Add one above.</td></tr>
              )}
              {learners.map((l) => (
                editId === l.id ? (
                  <tr key={l.id}>
                    <td><input className="input" style={{ marginTop: 0 }} value={editForm.fullName ?? ''} onChange={e => setEditForm({ ...editForm, fullName: e.target.value })} /></td>
                    <td style={{ color: '#6b7280', fontSize: '0.8rem' }}>{l.email}</td>
                    <td><input className="input" style={{ marginTop: 0, minWidth: '120px' }} value={editForm.contactNumber ?? ''} onChange={e => setEditForm({ ...editForm, contactNumber: e.target.value })} /></td>
                    <td><input className="input" style={{ marginTop: 0, minWidth: '160px' }} value={editForm.course ?? ''} onChange={e => setEditForm({ ...editForm, course: e.target.value })} /></td>
                    <td><input className="input" style={{ marginTop: 0, minWidth: '120px' }} value={editForm.units ?? ''} onChange={e => setEditForm({ ...editForm, units: e.target.value })} /></td>
                    <td>
                      <select className="select" style={{ marginTop: 0, width: 'auto' }} value={editForm.status ?? ''} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                        <option value="SUSPENDED">Suspended</option>
                      </select>
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => handleSaveEdit(l.id)} disabled={saving}>Save</button>
                        <button className="btn secondary" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }} onClick={() => setEditId(null)}>Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={l.id}>
                    <td style={{ fontWeight: 500 }}>{l.fullName}</td>
                    <td style={{ color: '#6b7280' }}>{l.email}</td>
                    <td>{l.contactNumber ?? <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.course ?? ''}>{l.course ?? <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>{l.units ?? <span style={{ color: '#9ca3af' }}>—</span>}</td>
                    <td>
                      <span className={`status-pill ${l.status === 'ACTIVE' ? 'status-active' : l.status === 'SUSPENDED' ? 'status-suspended' : 'status-inactive'}`}>
                        {l.status}
                      </span>
                    </td>
                    <td>
                      <button className="btn outline" style={{ padding: '0.35rem 0.7rem', fontSize: '0.8rem' }}
                        onClick={() => { setEditId(l.id); setEditForm({ fullName: l.fullName, contactNumber: l.contactNumber ?? '', course: l.course ?? '', units: l.units ?? '', address: l.address ?? '', status: l.status }); }}>
                        Edit
                      </button>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
