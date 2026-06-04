'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await apiFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (response.ok) {
      router.push('/dashboard');
      return;
    }

    const data = await response.json();
    setError(data?.message || 'Unable to log in.');
  }

  return (
    <main className="main-shell">
      <div className="card" style={{ maxWidth: '520px', margin: '0 auto' }}>
        <div className="header">
          <div>
            <h1 className="page-title">TextBookTracker</h1>
            <p className="description">Secure login for textbook sharing and print tracking.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <label>
            Email address
            <input
              className="input"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              placeholder="you@example.com"
            />
          </label>

          <label>
            Password
            <input
              className="input"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              placeholder="••••••••"
            />
          </label>

          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>

          {error ? <div className="alert">{error}</div> : null}
        </form>
      </div>
    </main>
  );
}
