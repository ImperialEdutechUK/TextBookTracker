'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, Role } from '@/lib/session';

type NavItem = {
  label: string;
  href: string;
  // Roles allowed to see this item; omit to show it to everyone.
  roles?: Role[];
};

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Textbook Management', href: '/textbooks' },
  { label: 'Add Textbooks', href: '/textbooks/add' },
  { label: 'Status Tracking', href: '/status' },
  // Admins manage accounts; Creators/Managers get a read-only learner directory.
  { label: 'User Management', href: '/admin/users', roles: ['ADMIN'] },
  { label: 'Learners', href: '/admin/users/directory', roles: ['CREATOR', 'MANAGER'] },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { session } = useSession();

  const navItems = NAV_ITEMS.filter(
    (item) => !item.roles || (session && item.roles.includes(session.role))
  );

  // Pick the single best (most specific) match so nested routes like
  // /textbooks/add don't light up both "Textbook Management" and "Add Textbooks".
  const activeHref = navItems.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`)
  ).sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">TextBookTracker</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
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
