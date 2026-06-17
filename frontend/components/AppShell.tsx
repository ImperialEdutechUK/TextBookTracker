'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import { apiFetch } from '@/lib/api';

const FULL_WIDTH_ROUTES = ['/', '/login'];
type SessionData = { fullName: string; username: string };

function TopHeader({ session }: { session: SessionData | null }) {
  return (
    <header className="top-header">
      <div className="top-header-right">
        <div className="user-chip">
          <span className="user-name">{session?.fullName ?? 'Administrator'}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ color: '#9ca3af', flexShrink: 0 }}>
            <polyline points="6 9 12 15 18 9"/>
          </svg>
        </div>
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
