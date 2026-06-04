'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type SessionData = {
  userId: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
};

function RoleBadge({ role }: { role: string }) {
  const className = `badge ${role === 'ADMIN' ? 'badge-admin' : role === 'MANAGER' ? 'badge-manager' : role === 'CREATOR' ? 'badge-creator' : 'badge-viewer'}`;
  return <span className={className}>{role.replace('_', ' ')}</span>;
}

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (res) => {
        if (!res.ok) throw new Error('Unauthorized');
        const data = await res.json();
        if (active) {
          setSession(data.session as SessionData);
          setLoading(false);
        }
      })
      .catch(() => {
        router.replace('/');
      });
    return () => {
      active = false;
    };
  }, [router]);

  async function handleLogout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  if (loading || !session) {
    return (
      <main className="main-shell">
        <div className="card">
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="main-shell">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="description">Welcome back, {session.fullName}. Use the navigation links to manage users and view available features.</p>
          </div>
          <div className="nav-links">
            <button className="nav-link" type="button" onClick={handleLogout}>
              Logout
            </button>
            {session.role === 'ADMIN' ? (
              <Link className="nav-link" href="/admin/users">
                Manage Users
              </Link>
            ) : null}
          </div>
        </div>

        <div className="card">
          <h2>Account Information</h2>
          <p>
            <strong>Email:</strong> {session.email}
          </p>
          <p>
            <strong>Role:</strong> <RoleBadge role={session.role} />
          </p>
          <p>
            <strong>Status:</strong>{' '}
            <span className={session.status === 'ACTIVE' ? 'status-pill status-active' : session.status === 'SUSPENDED' ? 'status-pill status-suspended' : 'status-pill status-inactive'}>
              {session.status}
            </span>
          </p>
        </div>

        <div className="card" style={{ marginTop: '1rem' }}>
          <h2>Core Access</h2>
          <ul>
            <li>Create textbooks (Creator / Admin only)</li>
            <li>Update textbook status up to requested or shared</li>
            <li>Manager can mark textbooks as sent to print and printed</li>
            <li>Admin can manage users and assign roles</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
