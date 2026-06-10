import Link from 'next/link';
import UserDirectory from '@/components/UserDirectory';

export default function AdminUserDirectoryPage() {
  return (
    <main className="main-shell main-shell-wide">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Available Users</h1>
            <p className="description">Browse, edit, disable, or remove user accounts.</p>
          </div>
          <Link href="/admin/users" className="btn secondary">
            ← Back to Create User
          </Link>
        </div>
        <UserDirectory />
      </div>
    </main>
  );
}
