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
  thisWeek: number;
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
  week:    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
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
    { label: 'Total Requests', value: stats?.totalRequests ?? 0, icon: ICONS.doc,     bg: '#eff6ff', fg: '#2563eb', href: '/requests' },
    { label: 'Received',       value: stats?.received ?? 0,      icon: ICONS.inbox,   bg: '#fef3c7', fg: '#d97706', href: '/requests?status=RECEIVED' },
    { label: 'Sent to Print',  value: stats?.sentToPrint ?? 0,   icon: ICONS.printer, bg: '#ede9fe', fg: '#7c3aed', href: '/requests?status=SENT_TO_PRINT' },
    { label: 'Printed',        value: stats?.printed ?? 0,       icon: ICONS.check,   bg: '#dcfce7', fg: '#16a34a', href: '/requests?status=PRINTED' },
    { label: 'This Week',      value: stats?.thisWeek ?? 0,      icon: ICONS.week,    bg: '#fff7ed', fg: '#ea580c', href: '/requests' },
  ];

  return (
    <main className="main-shell">
      <div style={{ marginBottom: '1.75rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-muted)', marginTop: '0.25rem', fontSize: '0.9rem' }}>Welcome back, {session.fullName}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {cards.slice(0, 4).map((c) => (
          <Link key={c.label} href={c.href} style={{ textDecoration: 'none' }}>
            <div className="stat-card" style={{ cursor: 'pointer', transition: 'box-shadow 0.15s, transform 0.15s' }}
              onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 4px 16px rgba(15,23,42,0.1)'; el.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = ''; el.style.transform = ''; }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{c.label}</p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{c.value}</p>
                <span style={{ width: 40, height: 40, borderRadius: 10, background: c.bg, color: c.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{c.icon}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 3fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <Link href={cards[4].href} style={{ textDecoration: 'none' }}>
          <div className="stat-card" style={{ cursor: 'pointer', height: '100%', transition: 'box-shadow 0.15s, transform 0.15s' }}
            onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = '0 4px 16px rgba(15,23,42,0.1)'; el.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = ''; el.style.transform = ''; }}>
            <p style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>{cards[4].label}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
              <p style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', margin: 0, lineHeight: 1 }}>{cards[4].value}</p>
              <span style={{ width: 40, height: 40, borderRadius: 10, background: cards[4].bg, color: cards[4].fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{cards[4].icon}</span>
            </div>
          </div>
        </Link>

        <div className="stat-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 1.5rem', borderBottom: '1px solid var(--border)' }}>
            <h2 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text)', margin: 0 }}>Recent Requests</h2>
            <Link href="/requests" style={{ fontSize: '0.82rem', color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}>View all →</Link>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '0.65rem 1.5rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Learner</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Course</th>
                <th style={{ padding: '0.65rem 1rem', textAlign: 'left', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                <th style={{ padding: '0.65rem 1.5rem', textAlign: 'right', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {!stats?.recentRequests?.length && (
                <tr><td colSpan={4} style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>No requests yet</td></tr>
              )}
              {stats?.recentRequests?.map((r, i) => (
                <tr key={r.requestId} style={{ borderBottom: i < (stats.recentRequests.length - 1) ? '1px solid var(--border)' : 'none', cursor: 'pointer' }}
                  onClick={() => router.push('/requests')}
                  onMouseEnter={e => (e.currentTarget as HTMLTableRowElement).style.background = '#f8fafc'}
                  onMouseLeave={e => (e.currentTarget as HTMLTableRowElement).style.background = ''}>
                  <td style={{ padding: '0.75rem 1.5rem', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text)' }}>{r.fullName}</td>
                  <td style={{ padding: '0.75rem 1rem', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.course}</td>
                  <td style={{ padding: '0.75rem 1rem' }}><span className={statusPill(r.status)}>{statusLabel(r.status)}</span></td>
                  <td style={{ padding: '0.75rem 1.5rem', fontSize: '0.82rem', color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
