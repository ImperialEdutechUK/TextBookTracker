'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';
import { statusLabel } from '@/lib/requests';

type SessionData = { userId: string; username: string; fullName: string };
type RecentRequest = { requestId: string; fullName: string; course: string; status: string; createdAt: string };
type Stats = {
  totalRequests: number;
  received: number;
  sentToPrint: number;
  printed: number;
  recentRequests: RecentRequest[];
};

function statusPill(s: string) {
  if (s === 'RECEIVED') return 'status-pill status-pending';
  if (s === 'SENT_TO_PRINT') return 'status-pill status-approved';
  if (s === 'PRINTED') return 'status-pill status-active';
  return 'status-pill status-inactive';
}

const ICONS = {
  doc:     <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  inbox:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>,
  printer: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  check:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
};

export default function DashboardPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (sRes) => {
        if (!sRes.ok) throw new Error('Unauthorized');
        const s = await sRes.json();
        if (!active) return;
        setSession(s.session);
        apiFetch('/api/dashboard')
          .then(async (dRes) => { if (dRes.ok && active) setStats(await dRes.json()); })
          .catch(() => {})
          .finally(() => { if (active) setLoading(false); });
      })
      .catch(() => router.replace('/login'));
    return () => { active = false; };
  }, [router]);

  if (loading || !session) {
    return <main className="main-shell"><p className="description">Loading...</p></main>;
  }

  const cards = [
    { label: 'Total Requests', value: stats?.totalRequests ?? 0, icon: ICONS.doc,     bg: '#eff6ff', fg: '#2563eb' },
    { label: 'Received',       value: stats?.received ?? 0,      icon: ICONS.inbox,   bg: '#fef3c7', fg: '#d97706' },
    { label: 'Sent to Print',  value: stats?.sentToPrint ?? 0,   icon: ICONS.printer, bg: '#ede9fe', fg: '#7c3aed' },
    { label: 'Printed',        value: stats?.printed ?? 0,       icon: ICONS.check,   bg: '#dcfce7', fg: '#16a34a' },
  ];

  return (
    <main className="main-shell">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="description">Welcome back, {session.fullName}</p>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <div key={c.label} className="stat-card">
            <p className="stat-label">{c.label}</p>
            <div className="stat-card-row">
              <p className="stat-value">{c.value}</p>
              <span className="stat-icon-box" style={{ background: c.bg, color: c.fg }}>{c.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="recent-header">
          <h2 className="section-title">Recent Requests</h2>
          <Link href="/requests" className="nav-link" style={{ fontSize: '0.875rem' }}>View all requests</Link>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Learner</th>
                <th>Course</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {!stats?.recentRequests?.length && (
                <tr><td colSpan={4} style={{ textAlign: 'center', color: '#6b7280' }}>No requests yet</td></tr>
              )}
              {stats?.recentRequests?.map((r) => (
                <tr key={r.requestId}>
                  <td>{r.fullName}</td>
                  <td>{r.course}</td>
                  <td><span className={statusPill(r.status)}>{statusLabel(r.status)}</span></td>
                  <td style={{ color: '#6b7280' }}>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
