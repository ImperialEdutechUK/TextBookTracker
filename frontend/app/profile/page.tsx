'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useSession } from '@/lib/session';

const roleLabels: Record<string, string> = {
  ADMIN: 'Admin',
  CREATOR: 'Creator',
  MANAGER: 'Manager',
  VIEWER: 'Learner/ Viewer',
};

function statusClass(status: string) {
  if (status === 'ACTIVE') return 'status-pill status-active';
  if (status === 'SUSPENDED') return 'status-pill status-suspended';
  return 'status-pill status-inactive';
}

export default function ProfilePage() {
  const router = useRouter();
  const { session, loading } = useSession();

  // Bounce unauthenticated visitors back to the login screen.
  useEffect(() => {
    if (!loading && !session) {
      router.replace('/');
    }
  }, [loading, session, router]);

  if (loading || !session) {
    return (
      <main className="main-shell">
        <div className="card">
          <p>Loading...</p>
        </div>
      </main>
    );
  }

  const isLearner = session.role === 'VIEWER';

  return (
    <main className="main-shell">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">My Profile</h1>
            <p className="description">Your account details.</p>
          </div>
        </div>

        <dl className="info-grid">
          <div>
            <dt>Full Name</dt>
            <dd>{session.fullName}</dd>
          </div>
          <div>
            <dt>Email</dt>
            <dd>{session.email}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>{roleLabels[session.role] ?? session.role}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <span className={statusClass(session.status)}>{session.status}</span>
            </dd>
          </div>
          {isLearner ? (
            <>
              <div>
                <dt>Contact Number</dt>
                <dd>{session.contactNumber || '—'}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>{session.address || '—'}</dd>
              </div>
            </>
          ) : null}
        </dl>
      </div>
    </main>
  );
}
