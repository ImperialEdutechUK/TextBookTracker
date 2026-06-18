'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { createRequest } from '@/lib/requests';

type FormState = {
  fullName: string;
  email: string;
  contactNumber: string;
  course: string;
  units: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postcode: string;
  country: string;
};

const EMPTY: FormState = {
  fullName: '', email: '', contactNumber: '', course: '', units: '',
  addressLine1: '', addressLine2: '', city: '', postcode: '', country: 'United Kingdom',
};

function buildAddress(f: FormState): string {
  return [f.addressLine1, f.addressLine2, f.city, f.postcode, f.country]
    .filter(Boolean).join(', ');
}

export default function NewRequestPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((res) => { if (!res.ok) throw new Error('Unauthorized'); setAuthChecked(true); })
      .catch(() => router.replace('/login'));
  }, [router]);

  function update<K extends keyof FormState>(key: K, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createRequest({
        fullName: form.fullName,
        email: form.email,
        contactNumber: form.contactNumber,
        course: form.course,
        units: form.units,
        address: buildAddress(form),
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        router.push('/requests');
      }, 1500);
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
      {success && (
        <div style={{ position: 'fixed', top: '1.5rem', right: '1.5rem', background: '#16a34a', color: '#fff', padding: '0.75rem 1.25rem', borderRadius: '10px', fontWeight: 600, fontSize: '0.9rem', zIndex: 9999, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          Request submitted successfully
        </div>
      )}

      <div className="page-header">
        <p className="description" style={{ marginBottom: '0.5rem' }}>
          <Link href="/dashboard" className="nav-link">Dashboard</Link> &nbsp;›&nbsp; New Request
        </p>
        <h1 className="page-title">New Request</h1>
        <p className="description">Enter the learner&apos;s details from their request email.</p>
      </div>

      <div className="card" style={{ maxWidth: 600 }}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div>
            <label className="field-label">Full Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} required placeholder="e.g. Kit Lau" />
          </div>
          <div>
            <label className="field-label">Email Address <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required placeholder="e.g. laukitshan@example.com" />
          </div>
          <div>
            <label className="field-label">Contact Number <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.contactNumber} onChange={(e) => update('contactNumber', e.target.value)} required placeholder="e.g. 07329879190" />
          </div>
          <div>
            <label className="field-label">Course / Qualification <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.course} onChange={(e) => update('course', e.target.value)} required placeholder="e.g. ATHE Level 3 Diploma in Health and Social Care" />
          </div>
          <div>
            <label className="field-label">Units Required <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" value={form.units} onChange={(e) => update('units', e.target.value)} required placeholder="e.g. All (06 units available)" />
          </div>

          <div style={{ gridColumn: '1 / -1' }}>
            <p className="field-label" style={{ marginBottom: '0.75rem', fontSize: '0.8rem', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Delivery Address <span style={{ color: '#ef4444' }}>*</span></p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <div>
                <label className="field-label">Address Line 1</label>
                <input className="input" value={form.addressLine1} onChange={(e) => update('addressLine1', e.target.value)} required placeholder="e.g. 2 Sandy Close" />
              </div>
              <div>
                <label className="field-label">Address Line 2 <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input className="input" value={form.addressLine2} onChange={(e) => update('addressLine2', e.target.value)} placeholder="e.g. Bradley Stoke" />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                <div>
                  <label className="field-label">City / Town</label>
                  <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} required placeholder="e.g. Bristol" />
                </div>
                <div>
                  <label className="field-label">Postcode</label>
                  <input className="input" value={form.postcode} onChange={(e) => update('postcode', e.target.value.toUpperCase())} required placeholder="e.g. BS32 8AJ" style={{ textTransform: 'uppercase' }} />
                </div>
              </div>
              <div>
                <label className="field-label">Country</label>
                <input className="input" value={form.country} onChange={(e) => update('country', e.target.value)} required placeholder="United Kingdom" />
              </div>
            </div>
          </div>

          {error ? <div className="alert" style={{ gridColumn: '1 / -1' }}>{error}</div> : null}

          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
            <button className="btn" type="submit" disabled={submitting} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
            <Link href="/requests" className="btn secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 1.5rem' }}>Cancel</Link>
          </div>
          <p style={{ gridColumn: '1 / -1', fontSize: '0.78rem', color: '#9ca3af' }}>* Required fields</p>
        </form>
      </div>
    </main>
  );
}
