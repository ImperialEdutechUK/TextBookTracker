import UserManager from '@/components/UserManagement';

export default function AdminUsersPage() {
  return (
    <main className="main-shell">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Admin User Management</h1>
            <p className="description">Create new users, update existing accounts, and manage role assignments.</p>
          </div>
        </div>
        <UserManager />
      </div>
    </main>
  );
}
