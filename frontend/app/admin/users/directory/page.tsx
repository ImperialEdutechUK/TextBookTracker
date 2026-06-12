'use client';

import Link from 'next/link';
import UserDirectory from '@/components/UserDirectory';
import { useSession } from '@/lib/session';

export default function AdminUserDirectoryPage() {
  const { session } = useSession();
  const isAdmin = session?.role === 'ADMIN';

  return (
    <main className="main-shell main-shell-wide">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">{isAdmin ? 'Available Users' : 'Available Learners'}</h1>
            <p className="description">
              {isAdmin
                ? 'Browse, edit, disable, or remove user accounts.'
                : 'Browse the available learners/viewers.'}
            </p>
          </div>
          {isAdmin ? (
            <Link href="/admin/users" className="btn secondary">
              ← Back to Create User
            </Link>
          ) : (
            <Link href="/textbooks" className="btn secondary">
              ← Back to Textbooks
            </Link>
          )}
        </div>
        <UserDirectory />
      </div>
    </main>
  );
}
