'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  label: string;
  href: string;
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Textbook Management', href: '/textbooks' },
  { label: 'Add Textbooks', href: '/textbooks/add' },
  { label: 'Status Tracking', href: '/status' },
  { label: 'User Management', href: '/admin/users' },
];

export default function Sidebar() {
  const pathname = usePathname();

  // Pick the single best (most specific) match so nested routes like
  // /textbooks/add don't light up both "Textbook Management" and "Add Textbooks".
  const activeHref = NAV_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">TextBookTracker</div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === activeHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link${isActive ? ' sidebar-link-active' : ''}`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
