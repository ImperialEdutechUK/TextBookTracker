'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { createRequest, DuplicateRequestError } from '@/lib/requests';

export default function NewRequestPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [course, setCourse] = useState('');
  const [units, setUnits] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [postcode, setPostcode] = useState('');
  const [country, setCountry] = useState('United Kingdom');

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((res) => { if (!res.ok) throw new Error('Unauthorized'); setAuthChecked(true); })
      .catch(() => router.replace('/login'));
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const contactNumber = phone.trim().startsWith('+') ? phone.trim() : `+44 ${phone.trim()}`;
    const address = [line1.trim(), line2.trim(), city.trim(), postcode.trim().toUpperCase(), country.trim()]
      .filter(Boolean).join(', ');

    if (!firstName.trim() || !lastName.trim()) { setError('Please enter the first and last name.'); return; }
    if (!line1.trim() || !city.trim() || !postcode.trim()) { setError('Please enter the postcode, address line 1, and city.'); return; }

    setSaving(true);
    const payload = { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim(), contactNumber, course: course.trim(), units: units.trim(), address };
    try {
      await createRequest(payload);
      router.push('/requests');
    } catch (err) {
      if (err instanceof DuplicateRequestError) {
        if (confirm(err.message)) {
          try {
            await createRequest(payload, true);
            router.push('/requests');
          } catch (e2) {
            setError(e2 instanceof Error ? e2.message : 'Could not create the request.');
            setSaving(false);
          }
        } else {
          setSaving(false);
        }
        return;
      }
      setError(err instanceof Error ? err.message : 'Could not create the request.');
      setSaving(false);
    }
  }

  if (!authChecked) return <main className="main-shell"><p className="description">Loading...</p></main>;

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 };
  const reqStar = <span style={{ color: '#ef4444' }}>*</span>;
  const optTag = <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span>;
  const inputStyle: React.CSSProperties = { width: '100%', height: 44, border: '1.5px solid #bfdbfe', borderRadius: 9, padding: '0 13px', fontSize: 14, color: '#1f2937', background: '#eff6ff' };
  const row2: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 };
  const field: React.CSSProperties = { marginBottom: 16 };

  return (
    <main className="main-shell">
      <div className="page-header">
        <h1 className="page-title">New Request</h1>
        <p className="description">Enter the learner's details from their request.</p>
      </div>

      <div className="card" style={{ maxWidth: 660, padding: 26 }}>
        <form onSubmit={handleSubmit}>
          <div style={row2}>
            <div style={field}><label style={labelStyle}>First Name {reqStar}</label><input style={inputStyle} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Kit" /></div>
            <div style={field}><label style={labelStyle}>Last Name {reqStar}</label><input style={inputStyle} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Lau" /></div>
          </div>

          <div style={row2}>
            <div style={field}><label style={labelStyle}>Email Address {reqStar}</label><input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kit.lau@example.com" required /></div>
            <div style={field}>
              <label style={labelStyle}>Phone Number {reqStar}</label>
              <div style={{ display: 'flex' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, border: '1.5px solid #bfdbfe', borderRight: 'none', borderRadius: '9px 0 0 9px', padding: '0 12px', background: '#dbeafe', fontSize: 14, color: '#374151', whiteSpace: 'nowrap' }}>🇬🇧 +44</div>
                <input style={{ ...inputStyle, borderRadius: '0 9px 9px 0' }} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="7123 456789" required />
              </div>
            </div>
          </div>

          <div style={row2}>
            <div style={field}><label style={labelStyle}>Course / Qualification {reqStar}</label><input style={inputStyle} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="ATHE Level 3 Diploma" required /></div>
            <div style={field}><label style={labelStyle}>Units Required {reqStar}</label><input style={inputStyle} value={units} onChange={(e) => setUnits(e.target.value)} placeholder="All (06 units)" required /></div>
          </div>

          <div style={{ border: '1px dashed #cbd5e1', borderRadius: 11, padding: 16, background: '#f8fbff', marginBottom: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#94a3b8', marginBottom: 13 }}>UK Delivery Address</div>

            <div style={field}>
              <label style={labelStyle}>Postcode {reqStar}</label>
              <input style={{ ...inputStyle, textTransform: 'uppercase' }} value={postcode} onChange={(e) => setPostcode(e.target.value.toUpperCase())} placeholder="E15 3LG" required />
            </div>

            <div style={row2}>
              <div style={field}><label style={labelStyle}>Address Line 1 {reqStar}</label><input style={inputStyle} value={line1} onChange={(e) => setLine1(e.target.value)} placeholder="167 Great Portland Street" required /></div>
              <div style={field}><label style={labelStyle}>Address Line 2 {optTag}</label><input style={inputStyle} value={line2} onChange={(e) => setLine2(e.target.value)} placeholder="5th Floor" /></div>
            </div>

            <div style={row2}>
              <div style={{ ...field, marginBottom: 0 }}><label style={labelStyle}>Town / City {reqStar}</label><input style={inputStyle} value={city} onChange={(e) => setCity(e.target.value)} placeholder="London" required /></div>
              <div style={{ ...field, marginBottom: 0 }}><label style={labelStyle}>Country {reqStar}</label><input style={inputStyle} value={country} onChange={(e) => setCountry(e.target.value)} required /></div>
            </div>
          </div>

          {error && <div className="alert" style={{ marginTop: 16 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 12, marginTop: 22 }}>
            <button type="submit" disabled={saving} style={{ flex: 1, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 9, height: 46, fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
              {saving ? 'Submitting...' : 'Submit Request'}
            </button>
            <Link href="/requests" className="btn secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 24px' }}>Cancel</Link>
          </div>
        </form>
      </div>
    </main>
  );
}
