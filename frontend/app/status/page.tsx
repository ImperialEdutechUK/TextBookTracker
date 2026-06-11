'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';

type SessionData = { userId: string; fullName: string; role: string };
type Request = { requestId: string; textbookName: string; learnerName: string; currentStatus: string; createdAt: string };

const STATUS_LABELS: Record<string, string> = {
  CREATED: 'Created',
  REQUESTED_BY_LEARNER: 'Requested',
  SHARED_WITH_MANAGER: 'Shared',
  SENT_TO_PRINT: 'Sent to Print',
  PRINTED: 'Printed',
};

const NEXT: Record<string, string | null> = {
  CREATED: 'REQUESTED_BY_LEARNER',
  REQUESTED_BY_LEARNER: 'SHARED_WITH_MANAGER',
  SHARED_WITH_MANAGER: 'SENT_TO_PRINT',
  SENT_TO_PRINT: 'PRINTED',
  PRINTED: null,
};

const PREV: Record<string, string | null> = {
  CREATED: null,
  REQUESTED_BY_LEARNER: 'CREATED',
  SHARED_WITH_MANAGER: 'REQUESTED_BY_LEARNER',
  SENT_TO_PRINT: 'SHARED_WITH_MANAGER',
  PRINTED: 'SENT_TO_PRINT',
};

function statusPill(s: string) {
  if (s === 'CREATED' || s === 'REQUESTED_BY_LEARNER') return 'status-pill status-pending';
  if (s === 'SHARED_WITH_MANAGER' || s === 'SENT_TO_PRINT') return 'status-pill status-approved';
  if (s === 'PRINTED') return 'status-pill status-active';
  return 'status-pill status-inactive';
}

export default function StatusTrackingPage() {
  const router = useRouter();
  const [session, setSession] = useState<SessionData | null>(null);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function loadRequests() {
    try {
      const rRes = await apiFetch('/api/textbook-requests?pageSize=50');
      if (rRes.ok) {
        const r = await rRes.json();
        setRequests(
          (r.requests ?? []).map((req: any) => ({
            requestId: req.requestId,
            textbookName: req.textbook?.name ?? 'Unknown',
            learnerName: req.learner?.fullName ?? 'Unknown',
            currentStatus: req.currentStatus,
            createdAt: req.createdAt,
          }))
        );
      } else {
        setError('Unable to load requests.');
      }
    } catch {
      setError('Unable to load requests. Check that the backend is running.');
    }
  }

  useEffect(() => {
    let active = true;
    apiFetch('/api/auth/me')
      .then(async (sRes) => {
        if (!sRes.ok) throw new Error('Unauthorized');
        const s = await sRes.json();
        if (!active) return;
        setSession(s.session);
        await loadRequests();
        if (active) setLoading(false);
      })
      .catch(() => router.replace('/login'));
    return () => { active = false; };
  }, [router]);

  async function handleTransition(requestId: string, newStatus: string) {
    setUpdating(requestId);
    setError('');
    try {
      const res = await apiFetch('/api/textbook-requests/' + requestId + '/status', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message ?? 'Failed to update status.');
      } else {
        await loadRequests();
      }
    } catch {
      setError('Failed to update status. Check that the backend is running.');
    } finally {
      setUpdating(null);
    }
  }

  const canTransition = session?.role === 'ADMIN' || session?.role === 'MANAGER' || session?.role === 'CREATOR';

  if (loading) return <main className="main-shell"><p className="description">Loading...</p></main>;

  return (
    <main className="main-shell">
      <div className="page-header">
        <h1 className="page-title">Status Tracking</h1>
        <p className="description">Advance requests through the workflow, or revert a step to correct mistakes. Every change is logged.</p>
      </div>
      {error && <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div>}
      <div className="card">
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Textbook</th>
                <th>Learner</th>
                <th>Current Status</th>
                <th>Date</th>
                {canTransition && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>No requests found</td></tr>
              )}
              {requests.map((r) => {
                const next = NEXT[r.currentStatus];
                const prev = PREV[r.currentStatus];
                return (
                  <tr key={r.requestId}>
                    <td style={{ fontWeight: 500 }}>{r.textbookName}</td>
                    <td style={{ color: '#6b7280' }}>{r.learnerName}</td>
                    <td><span className={statusPill(r.currentStatus)}>{STATUS_LABELS[r.currentStatus] ?? r.currentStatus}</span></td>
                    <td style={{ color: '#6b7280' }}>
                      {new Date(r.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    {canTransition && (
                      <td>
                        <div className="row-actions">
                          {prev && (
                            <button className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                              disabled={updating === r.requestId}
                              onClick={() => handleTransition(r.requestId, prev)}
                              title={'Revert to ' + (STATUS_LABELS[prev] ?? prev)}>
                              ← {STATUS_LABELS[prev]}
                            </button>
                          )}
                          {next ? (
                            <button className="btn" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                              disabled={updating === r.requestId}
                              onClick={() => handleTransition(r.requestId, next)}>
                              {updating === r.requestId ? 'Updating...' : (STATUS_LABELS[next] ?? next) + ' →'}
                            </button>
                          ) : (
                            <span style={{ color: '#16a34a', fontSize: '0.8rem', fontWeight: 600 }}>Complete</span>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
