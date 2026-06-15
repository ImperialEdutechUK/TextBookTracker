'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { apiFetch, setToken } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function doLogin(e: string, p: string) {
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: e, password: p }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data?.token) setToken(data.token);
        router.push('/dashboard');
        return;
      }
      setError(data?.message || 'Unable to log in.');
    } catch {
      setError('Cannot connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    doLogin(email, password);
  }

  function handleLoginAsAdmin() {
    doLogin('admin@example.com', 'AdminPass123!');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link href="/" className="auth-card-brand" style={{ textDecoration: 'none', justifyContent: 'center' }}>
          <span className="brand-logo">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          </span>
          Textbook Tracker
        </Link>
        <h1 className="auth-title">Welcome Back</h1>
        <p className="auth-subtitle">Login to your account to continue</p>
        <form onSubmit={handleSubmit} className="auth-form">
          <div>
            <label className="field-label">Username</label>
            <input className="input" type="text" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="Enter your username" />
          </div>
          <div>
            <label className="field-label">Password</label>
            <div className="login-eye-wrap">
              <input className="input" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Enter your password" style={{ paddingRight: '2.75rem' }} />
              <button type="button" className="login-eye-btn" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div className="login-check-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.875rem', cursor: 'pointer', color: '#374151' }}>
              <input type="checkbox" style={{ width: 'auto', margin: 0 }} /> Remember me
            </label>
            <a href="#" style={{ fontSize: '0.875rem', color: '#2563eb', fontWeight: 500 }}>Forgot password?</a>
          </div>
          <button className="btn" type="submit" disabled={loading} style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', borderRadius: '10px', marginTop: '0.25rem' }}>
            {loading ? 'Signing in...' : 'Login'}
          </button>
          {error ? <div className="alert">{error}</div> : null}
        </form>
        <div className="login-divider">or</div>
        <button className="btn-outline-full" onClick={handleLoginAsAdmin} disabled={loading}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Login as Admin
        </button>
        <p className="login-signup">Don&apos;t have an account? <Link href="#">Sign up</Link></p>
        <p style={{ textAlign: 'center', marginTop: '0.75rem' }}>
          <Link href="/" style={{ fontSize: '0.8rem', color: '#6b7280' }}>← Back to home</Link>
        </p>
      </div>
    </div>
  );
}
