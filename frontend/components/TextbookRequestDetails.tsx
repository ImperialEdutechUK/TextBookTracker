'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from '@/lib/session';
import { RequestDetail, fetchRequest, statusLabel } from '@/lib/textbooks';

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString();
}

export default function TextbookRequestDetails({ requestId }: { requestId: string }) {
  const { session } = useSession();
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    fetchRequest(requestId)
      .then((data) => {
        if (active) setRequest(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load request.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [requestId]);

  if (loading) return <p>Loading...</p>;
  if (error) return <div className="alert">{error}</div>;
  if (!request) return null;

  const canEdit =
    session?.role === 'ADMIN' ||
    session?.role === 'MANAGER' ||
    session?.role === 'CREATOR';

  return (
    <div>
      <div className="header">
        <div>
          <h1 className="page-title">{request.textbook.name}</h1>
          <p className="description">Request #{request.requestId}</p>
        </div>
        <div className="row-actions">
          <Link className="btn secondary" href="/textbooks">
            Back to list
          </Link>
          {canEdit ? (
            <Link className="btn" href={`/textbooks/${request.requestId}/edit`}>
              Edit
            </Link>
          ) : null}
        </div>
      </div>

      <div className="card">
        <h2>Information</h2>
        <dl className="info-grid">
          <div>
            <dt>Request ID</dt>
            <dd>#{request.requestId}</dd>
          </div>
          <div>
            <dt>Learner</dt>
            <dd>{request.learner.fullName}</dd>
          </div>
          <div>
            <dt>Textbook Name</dt>
            <dd>{request.textbook.name}</dd>
          </div>
          <div>
            <dt>Author / Creator</dt>
            <dd>{request.creator.fullName}</dd>
          </div>
          <div>
            <dt>Current Status</dt>
            <dd>
              <span
                className={`status-pill textbook-status status-${request.currentStatus.toLowerCase()}`}
              >
                {statusLabel(request.currentStatus)}
              </span>
            </dd>
          </div>
          <div>
            <dt>Created Date</dt>
            <dd>{formatDateTime(request.createdAt)}</dd>
          </div>
          <div>
            <dt>Last Updated Date</dt>
            <dd>{formatDateTime(request.updatedAt)}</dd>
          </div>
        </dl>
      </div>

      <div className="card" style={{ marginTop: '1rem' }}>
        <h2>Status History</h2>
        {request.statusHistory.length === 0 ? (
          <p>No status changes recorded yet.</p>
        ) : (
          <ol className="timeline">
            {request.statusHistory.map((entry, index) => (
              <li key={`${entry.status}-${entry.changedAt}-${index}`} className="timeline-item">
                <div className="timeline-marker" aria-hidden="true" />
                <div className="timeline-content">
                  <span className="timeline-status">{statusLabel(entry.status)}</span>
                  <span className="timeline-meta">
                    {formatDateTime(entry.changedAt)} &middot; {entry.changedBy}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
