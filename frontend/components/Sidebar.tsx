'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { apiFetch, clearToken } from '@/lib/api';

const NAV_ITEMS = [
  { label: 'Dashboard',    href: '/dashboard',    icon: 'M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z' },
  { label: 'New Request',  href: '/requests/new', icon: 'M12 5v14M5 12h14' },
  { label: 'All Requests', href: '/requests',     icon: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01' },
];

function NavIcon({ d }: { d: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d={d} />
    </svg>
  );
}

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  // "/requests/new" should highlight New Request, not All Requests, so match the
  // longest href whose path the current route starts with.
  const activeHref = NAV_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(item.href + '/')
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  async function handleLogout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    clearToken();
    router.replace('/login');
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-logo">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.2" style={{ flexShrink: 0 }}>
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
          </svg>
        </span>
        Textbook Request Tracker
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <Link key={item.href} href={item.href}
            className={'sidebar-link' + (item.href === activeHref ? ' sidebar-link-active' : '')}>
            <NavIcon d={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="sidebar-footer">
        <button className="sidebar-link sidebar-footer-btn" onClick={handleLogout}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </div>
    </aside>
  );
}
