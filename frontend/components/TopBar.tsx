'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import { useSession } from '@/lib/session';

// Build short initials (max two letters) for the avatar chip.
function initials(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Application-wide top bar. Shows the logged-in user's name (linking to their
// profile), the admin-only "Create User" shortcut, and a Logout button.
export default function TopBar() {
  const router = useRouter();
  const { session, loading } = useSession();

  async function handleLogout() {
    await apiFetch('/api/auth/logout', { method: 'POST' });
    router.replace('/');
  }

  // Hide the bar until we know who is signed in (e.g. on first paint).
  if (loading || !session) return null;

  return (
    <header className="topbar">
      <div className="topbar-actions">
        {session.role === 'ADMIN' ? (
          <Link className="topbar-create" href="/admin/users">
            Create User
          </Link>
        ) : null}

        <Link className="topbar-user" href="/profile" title="View your profile">
          <span className="topbar-avatar">{initials(session.fullName)}</span>
          <span className="topbar-name">{session.fullName}</span>
        </Link>

        <button className="topbar-logout" type="button" onClick={handleLogout}>
          Logout
        </button>
      </div>
    </header>
  );
}
