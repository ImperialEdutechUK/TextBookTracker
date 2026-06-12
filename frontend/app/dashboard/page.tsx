'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api';

type SessionData = { userId: string; email: string; fullName: string; role: string; status: string };
type RecentRequest = { requestId: string; textbookName: string; learnerName: string; currentStatus: string; createdAt: string };
type Stats = {
  totalTextbooks: number;
  totalRequests: number;
  statusCounts: Record<string, number>;
  totalUsers: number | null;
  recentRequests: RecentRequest[];
};

function statusPill(s: string) {
  if (s === 'CREATED' || s === 'REQUESTED_BY_LEARNER') return 'status-pill status-pending';
  if (s === 'SHARED_WITH_MANAGER' || s === 'SENT_TO_PRINT') return 'status-pill status-approved';
  if (s === 'PRINTED') return 'status-pill status-active';
  return 'status-pill status-inactive';
}

function statusLabel(s: string) {
  const map: Record<string, string> = { CREATED: 'Pending', REQUESTED_BY_LEARNER: 'Requested', SHARED_WITH_MANAGER: 'Shared', SENT_TO_PRINT: 'Sent to Print', PRINTED: 'Printed' };
  return map[s] ?? s;
}

const ICONS = {
  book:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  clock:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  share:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>,
  printer: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
  check:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  users:   <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
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

  const sc = stats?.statusCounts ?? {};
  const pending = (sc['CREATED'] ?? 0) + (sc['REQUESTED_BY_LEARNER'] ?? 0);

  const cards = [
    { label: 'Total Textbooks',     value: stats?.totalTextbooks ?? 0,    icon: ICONS.book,    bg: '#eff6ff', fg: '#2563eb', href: '/textbooks' },
    { label: 'Pending',             value: pending,                        icon: ICONS.clock,   bg: '#fef3c7', fg: '#d97706', href: '/status' },
    { label: 'Shared with Manager', value: sc['SHARED_WITH_MANAGER'] ?? 0, icon: ICONS.share,   bg: '#ede9fe', fg: '#7c3aed', href: '/status' },
    { label: 'Sent to Print',       value: sc['SENT_TO_PRINT'] ?? 0,       icon: ICONS.printer, bg: '#fce7f3', fg: '#db2777', href: '/status' },
    { label: 'Printed',             value: sc['PRINTED'] ?? 0,             icon: ICONS.check,   bg: '#dcfce7', fg: '#16a34a', href: '/status' },
    ...(session.role === 'ADMIN' ? [{ label: 'Users', value: stats?.totalUsers ?? 0, icon: ICONS.users, bg: '#f3e8ff', fg: '#9333ea', href: '/admin/users' }] : []),
  ];

  return (
    <main className="main-shell">
      <div className="page-header">
        <h1 className="page-title">Dashboard</h1>
        <p className="description">Welcome back, {session.fullName}</p>
      </div>

      <div className="stat-grid">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s ease, transform 0.15s ease' }}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(15,23,42,0.1)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = ''; (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
              <p className="stat-label">{c.label}</p>
              <div className="stat-card-row">
                <p className="stat-value">{c.value}</p>
                <span className="stat-icon-box" style={{ background: c.bg, color: c.fg }}>{c.icon}</span>
              </div>
            </div>
          </Link>
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
                <th>Title</th>
                <th>Requested By</th>
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
                  <td>{r.textbookName}</td>
                  <td>{r.learnerName}</td>
                  <td><span className={statusPill(r.currentStatus)}>{statusLabel(r.currentStatus)}</span></td>
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
