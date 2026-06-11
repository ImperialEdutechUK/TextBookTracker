'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/session';
import { apiFetch } from '@/lib/api';
import {
  FormOptions, ListParams, Pagination, RequestSummary,
  deleteRequest, fetchFormOptions, fetchRequests, statusLabel,
} from '@/lib/textbooks';

const EMPTY_FILTERS: ListParams = { search: '', status: '', learnerId: '', dateFrom: '', dateTo: '' };

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill textbook-status status-${status.toLowerCase()}`}>
      {statusLabel(status)}
    </span>
  );
}

export default function TextbookRequestList() {
  const { session } = useSession();
  const [requests, setRequests] = useState<RequestSummary[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [options, setOptions] = useState<FormOptions | null>(null);
  const [filters, setFilters] = useState<ListParams>(EMPTY_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canCreate = session?.role === 'ADMIN' || session?.role === 'CREATOR';
  const canDelete = session?.role === 'ADMIN';

  function canEdit(request: RequestSummary) {
    if (session?.role === 'ADMIN') return true;
    return session?.role === 'CREATOR' && request.creator.id === session.userId;
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchRequests({ ...filters, page });
      setRequests(data.requests);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load textbook requests.');
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchFormOptions().then(setOptions).catch(() => setOptions(null));
  }, []);

  function updateFilter(key: keyof ListParams, value: string) {
    setPage(1);
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function handleSearchSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    updateFilter('search', searchInput.trim());
  }

  function handleReset() {
    setSearchInput('');
    setFilters(EMPTY_FILTERS);
    setPage(1);
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Delete this textbook request? This action cannot be undone.')) return;
    try {
      await deleteRequest(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete request.');
    }
  }

  async function handleExport() {
    setError('');
    try {
      const q = new URLSearchParams();
      if (filters.search) q.set('search', filters.search);
      if (filters.status) q.set('status', filters.status);
      if (filters.learnerId) q.set('learnerId', filters.learnerId);
      if (filters.dateFrom) q.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) q.set('dateTo', filters.dateTo);
      const res = await apiFetch('/api/textbook-requests/export/csv' + (q.toString() ? '?' + q.toString() : ''));
      if (!res.ok) { setError('Export failed.'); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'textbook-requests.csv';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch {
      setError('Export failed. Check that the backend is running.');
    }
  }

  const pageSize = pagination?.pageSize ?? 10;
  const total = pagination?.total ?? 0;
  const totalPages = pagination?.totalPages ?? 1;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Requests</h1>
          <p className="description">Search, filter, and manage textbook requests.</p>
        </div>
        {canCreate ? <Link className="btn" href="/textbooks/new">+ Create Request</Link> : null}
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.75rem' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 280px', maxWidth: '440px' }}>
            <input
              className="input"
              type="search"
              placeholder="Search requests..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              style={{ marginTop: 0, flex: 1 }}
            />
            <button className="btn outline" type="submit">Search</button>
          </form>
          <button className="btn outline" type="button" onClick={handleExport}>Export CSV</button>
          <button className="btn outline" type="button" onClick={() => setShowFilters(!showFilters)}>
            Filter {showFilters ? '▴' : '▾'}
          </button>
        </div>

        {showFilters && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'flex-end', padding: '0.85rem', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '10px', marginBottom: '1rem' }}>
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem' }}>Status</label>
              <select className="select" style={{ marginTop: '0.2rem', width: 'auto' }} value={filters.status} onChange={(e) => updateFilter('status', e.target.value)}>
                <option value="">All statuses</option>
                {options?.statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem' }}>Learner</label>
              <select className="select" style={{ marginTop: '0.2rem', width: 'auto' }} value={filters.learnerId} onChange={(e) => updateFilter('learnerId', e.target.value)}>
                <option value="">All learners</option>
                {options?.learners.map((l) => <option key={l.id} value={l.id}>{l.fullName}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem' }}>From</label>
              <input className="input" type="date" style={{ marginTop: '0.2rem', width: 'auto' }} value={filters.dateFrom} onChange={(e) => updateFilter('dateFrom', e.target.value)} />
            </div>
            <div>
              <label className="field-label" style={{ fontSize: '0.75rem' }}>To</label>
              <input className="input" type="date" style={{ marginTop: '0.2rem', width: 'auto' }} value={filters.dateTo} onChange={(e) => updateFilter('dateTo', e.target.value)} />
            </div>
            <button className="btn secondary" type="button" onClick={handleReset}>Reset</button>
          </div>
        )}

        {error ? <div className="alert">{error}</div> : null}

        {loading ? (
          <p className="description" style={{ padding: '1rem 0' }}>Loading requests...</p>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Requested By</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>No textbook requests found.</td></tr>
                  )}
                  {requests.map((request) => (
                    <tr key={request.requestId}>
                      <td style={{ fontWeight: 500 }}>{request.textbook.name}</td>
                      <td style={{ color: '#6b7280' }}>{request.learner.fullName}</td>
                      <td><StatusPill status={request.currentStatus} /></td>
                      <td style={{ color: '#6b7280' }}>
                        {new Date(request.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} href={`/textbooks/${request.requestId}`}>View</Link>
                          {canEdit(request) ? (
                            <Link className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }} href={`/textbooks/${request.requestId}/edit`}>Edit</Link>
                          ) : null}
                          {canDelete ? (
                            <button className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fecaca' }} type="button" onClick={() => handleDelete(request.requestId)}>Delete</button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {total > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Showing {from} to {to} of {total} entries
                </span>
                {totalPages > 1 && (
                  <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                    <button className="btn outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>‹</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                      <button key={p} className={p === page ? 'btn' : 'btn outline'} style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', minWidth: '32px' }} onClick={() => setPage(p)}>{p}</button>
                    ))}
                    <button className="btn outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }} disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>›</button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
