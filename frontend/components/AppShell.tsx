'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from './Sidebar';
import { apiFetch } from '@/lib/api';

const FULL_WIDTH_ROUTES = ['/', '/login'];
type SessionData = { fullName: string; username: string };

function TopHeader({ session }: { session: SessionData | null }) {
  return (
    <header className="top-header" style={{ justifyContent: 'space-between', padding: '0.75rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <Link href="/requests/new" className="btn" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, borderRadius: '10px' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Request
        </Link>
        <Link href="/requests" style={{ padding: '0.5rem 1.2rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, borderRadius: '10px', border: '1.5px solid #e2e8f0', color: '#374151', textDecoration: 'none', background: '#fff' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          All Requests
        </Link>
      </div>
      <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 700, flexShrink: 0, cursor: 'default', border: '2px solid #dbeafe' }}>
        {session?.fullName?.charAt(0).toUpperCase() ?? 'A'}
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [session, setSession] = useState<SessionData | null>(null);
  const hideSidebar = FULL_WIDTH_ROUTES.includes(pathname);

  useEffect(() => {
    if (hideSidebar) return;
    apiFetch('/api/auth/me')
      .then(async (res) => { if (res.ok) { const d = await res.json(); setSession(d.session); } })
      .catch(() => {});
  }, [hideSidebar]);

  if (hideSidebar) return <>{children}</>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <TopHeader session={session} />
        <div className="page-wrapper">{children}</div>
      </div>
    </div>
  );
}
