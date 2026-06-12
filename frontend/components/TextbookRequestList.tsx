'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/session';
import {
  FormOptions,
  ListParams,
  Pagination,
  RequestSummary,
  deleteRequest,
  fetchFormOptions,
  fetchRequests,
  statusLabel,
} from '@/lib/textbooks';

const EMPTY_FILTERS: ListParams = {
  search: '',
  status: '',
  learnerId: '',
  dateFrom: '',
  dateTo: '',
};

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
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const canCreate = session?.role === 'ADMIN' || session?.role === 'CREATOR';

  // Admins, managers and creators may edit any request.
  const canEdit =
    session?.role === 'ADMIN' ||
    session?.role === 'MANAGER' ||
    session?.role === 'CREATOR';

  // Admins and creators may delete any request.
  const canDelete = session?.role === 'ADMIN' || session?.role === 'CREATOR';

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

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchFormOptions()
      .then(setOptions)
      .catch(() => setOptions(null));
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
    if (!window.confirm('Delete this textbook request? This action cannot be undone.')) {
      return;
    }
    try {
      await deleteRequest(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete request.');
    }
  }

  return (
    <div>
      <div className="header">
        <div>
          <h1 className="page-title">Textbook Requests</h1>
          <p className="description">Search, filter, and manage textbook requests.</p>
        </div>
        {canCreate ? (
          <Link className="btn" href="/textbooks/new">
            Create Request
          </Link>
        ) : null}
      </div>

      <div className="filter-bar">
        <form onSubmit={handleSearchSubmit} className="filter-search">
          <input
            className="input"
            type="search"
            placeholder="Search by learner or textbook"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
          <button className="btn secondary" type="submit">
            Search
          </button>
        </form>

        <select
          className="select"
          value={filters.status}
          onChange={(event) => updateFilter('status', event.target.value)}
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {options?.statuses.map((status) => (
            <option key={status} value={status}>
              {statusLabel(status)}
            </option>
          ))}
        </select>

        <select
          className="select"
          value={filters.learnerId}
          onChange={(event) => updateFilter('learnerId', event.target.value)}
          aria-label="Filter by learner"
        >
          <option value="">All learners</option>
          {options?.learners.map((learner) => (
            <option key={learner.id} value={learner.id}>
              {learner.fullName}
            </option>
          ))}
        </select>

        <label className="filter-date">
          From
          <input
            className="input"
            type="date"
            value={filters.dateFrom}
            onChange={(event) => updateFilter('dateFrom', event.target.value)}
          />
        </label>
        <label className="filter-date">
          To
          <input
            className="input"
            type="date"
            value={filters.dateTo}
            onChange={(event) => updateFilter('dateTo', event.target.value)}
          />
        </label>

        <button className="btn secondary" type="button" onClick={handleReset}>
          Reset
        </button>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {loading ? (
        <p>Loading textbook requests...</p>
      ) : requests.length === 0 ? (
        <p>No textbook requests found.</p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Request ID</th>
                <th>Learner</th>
                <th>Textbook</th>
                <th>Status</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.requestId}>
                  <td>#{request.requestId}</td>
                  <td>{request.learner.fullName}</td>
                  <td>{request.textbook.name}</td>
                  <td>
                    <StatusPill status={request.currentStatus} />
                  </td>
                  <td>{new Date(request.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div className="row-actions">
                      <Link
                        className="btn secondary"
                        href={`/textbooks/${request.requestId}`}
                      >
                        View
                      </Link>
                      {canEdit ? (
                        <Link
                          className="btn secondary"
                          href={`/textbooks/${request.requestId}/edit`}
                        >
                          Edit
                        </Link>
                      ) : null}
                      {canDelete ? (
                        <button
                          className="btn secondary"
                          type="button"
                          onClick={() => handleDelete(request.requestId)}
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.totalPages > 1 ? (
        <div className="pagination">
          <button
            className="btn secondary"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
          </span>
          <button
            className="btn secondary"
            type="button"
            disabled={page >= pagination.totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
