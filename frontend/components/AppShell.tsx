'use client';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import Sidebar from './Sidebar';
import { apiFetch } from '@/lib/api';
import { statusLabel } from '@/lib/textbooks';

const FULL_WIDTH_ROUTES = ['/', '/login'];
type SessionData = { fullName: string; role: string };
type Notification = {
  id: string; requestId: string; textbookName: string;
  learnerName: string; status: string; changedBy: string; changedAt: string;
};

function TopHeader({ session }: { session: SessionData | null }) {
  const [open, setOpen] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const [items, setItems] = useState<Notification[]>([]);

  async function loadNotifications() {
    try {
      const res = await apiFetch('/api/notifications');
      if (res.ok) {
        const d = await res.json();
        setUnseen(d.unseenCount ?? 0);
        setItems(d.notifications ?? []);
      }
    } catch {}
  }

  useEffect(() => { loadNotifications(); }, []);

  async function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next) {
      await loadNotifications();
      apiFetch('/api/notifications/seen', { method: 'POST' }).catch(() => {});
      setUnseen(0);
    }
  }

  const initials = session?.fullName
    ? session.fullName.split(' ').slice(0, 2).map((n) => n[0]).join('').toUpperCase()
    : '';

  return (
    <header className="top-header">
      <div className="top-header-right">
        <div className="notif-wrap">
          <button className="icon-btn" aria-label="Notifications" onClick={toggleOpen}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unseen > 0 && <span className="notif-badge">{unseen > 9 ? '9+' : unseen}</span>}
          </button>
          {open && (
            <div className="notif-panel">
              <div className="notif-panel-head">Notifications</div>
              {items.length === 0 ? (
                <p className="notif-empty">No notifications yet.</p>
              ) : (
                items.map((n) => (
                  <Link key={n.id} href={`/textbooks/${n.requestId}`} className="notif-item" onClick={() => setOpen(false)}>
                    <span className="notif-item-title">{n.textbookName}</span>
                    <span className="notif-item-meta">
                      → {statusLabel(n.status)} by {n.changedBy}
                    </span>
                    <span className="notif-item-time">
                      {new Date(n.changedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
        <div className="user-chip">
          <div className="user-avatar">{initials}</div>
          <span className="user-name">{session?.fullName ?? ''}</span>
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
