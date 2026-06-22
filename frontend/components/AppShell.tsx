'use client';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Sidebar from './Sidebar';

const FULL_WIDTH_ROUTES = ['/', '/login'];

function TopHeader() {
  return (
    <header className="top-header" style={{ justifyContent: 'flex-start', padding: '0.85rem 2rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <Link href="/requests/new" className="btn" style={{ padding: '0.75rem 1.7rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, borderRadius: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Request
        </Link>
        <Link href="/requests" style={{ padding: '0.75rem 1.7rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, borderRadius: '10px', border: '1.5px solid #cbd5e1', color: '#334155', textDecoration: 'none', background: '#fff' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
          All Requests
        </Link>
      </div>
    </header>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const hideSidebar = FULL_WIDTH_ROUTES.includes(pathname);

  if (hideSidebar) return <>{children}</>;

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="app-content">
        <TopHeader />
        <div className="page-wrapper">{children}</div>
      </div>
    </div>
  );
}
