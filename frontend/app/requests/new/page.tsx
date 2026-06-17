'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { createRequest, NewRequestInput } from '@/lib/requests';

const EMPTY: NewRequestInput = {
  fullName: '', email: '', contactNumber: '', course: '', units: '', address: '',
};

export default function NewRequestPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [form, setForm] = useState<NewRequestInput>(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((res) => { if (!res.ok) throw new Error('Unauthorized'); setAuthChecked(true); })
      .catch(() => router.replace('/login'));
  }, [router]);

  function update<K extends keyof NewRequestInput>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createRequest(form);
      router.push('/requests');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit the request.');
      setSubmitting(false);
    }
  }

  if (!authChecked) {
    return <main className="main-shell"><p className="description">Loading...</p></main>;
  }

  return (
    <main className="main-shell">
      <div className="page-header">
        <p className="description" style={{ marginBottom: '0.5rem' }}>
          <Link href="/dashboard" className="nav-link">Dashboard</Link> &nbsp;›&nbsp; New Request
        </p>
        <h1 className="page-title">New Request</h1>
        <p className="description">Enter the learner&apos;s details from their request email.</p>
      </div>

      <div className="card" style={{ maxWidth: 560 }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <label className="field-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required placeholder="e.g. Kit Lau" />
          </div>
          <div>
            <label className="field-label">Email Address <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required placeholder="e.g. laukitshan@ygvomo.com" />
          </div>
          <div>
            <label className="field-label">Contact Number <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} required placeholder="e.g. 07329879190" />
          </div>
          <div>
            <label className="field-label">Course / Qualification <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.course} onChange={(e) => update('course', e.target.value)} required placeholder="e.g. ATHE Level 3 Diploma" />
          </div>
          <div>
            <label className="field-label">Units Required <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.units} onChange={(e) => update('units', e.target.value)} required placeholder="e.g. All (06 units available)" />
          </div>
          <div>
            <label className="field-label">Delivery Address <span style={{ color: '#ef4444' }}>*</span></label>
            <textarea value={form.address} onChange={(e) => update('address', e.target.value)} required rows={3} placeholder="e.g. 2 Sandy Close, Bradley Stoke, Bristol BS32 8AJ, United Kingdom" />
          </div>

          <button className="btn" type="submit" disabled={submitting} style={{ width: '100%', padding: '0.75rem', borderRadius: '10px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.5rem' }}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
          {error ? <div className="alert">{error}</div> : null}
        </form>
        <p className="description" style={{ marginTop: '1rem' }}><span style={{ color: '#ef4444' }}>*</span> Required fields</p>
      </div>
    </main>
  );
}
