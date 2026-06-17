'use client';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, apiUrl, getToken } from '@/lib/api';
import {
  fetchRequests, fetchRequest, deleteRequest, updateStatus, uploadPdf, deletePdf, fetchCsv,
  statusLabel, eventLabel, TextbookRequest, RequestDetail, RequestStatus, Pagination,
} from '@/lib/requests';

// Build a direct URL to a request's PDF, with the auth token as a query param.
// We open this URL natively (new tab to view, download attribute to save) so
// the BROWSER fetches the file — streaming it with HTTP Range requests — rather
// than pulling all 33MB into JS memory via fetch(), which was slow and reset
// the connection on large files.
function pdfUrl(id: string, download = false) {
  const params = new URLSearchParams();
  const token = getToken();
  if (token) params.set('token', token);
  if (download) params.set('download', '1');
  return apiUrl(`/api/textbook-requests/${id}/pdf?${params.toString()}`);
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'RECEIVED', label: 'Received' },
  { value: 'SENT_TO_PRINT', label: 'Sent to Print' },
  { value: 'PRINTED', label: 'Printed' },
];

function statusBadgeClass(s: string) {
  if (s === 'RECEIVED') return 'req-badge req-badge-received';
  if (s === 'SENT_TO_PRINT') return 'req-badge req-badge-sent';
  return 'req-badge req-badge-printed';
}

function formatSize(bytes: number | null) {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function RequestsPage() {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);
  const [requests, setRequests] = useState<TextbookRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [showFilter, setShowFilter] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState<string | null>(null);

  // "Send to print" dialog state.
  const [printDialog, setPrintDialog] = useState<TextbookRequest | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [dialogError, setDialogError] = useState('');

  // Request details popup state.
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const uploadTargetRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((res) => { if (!res.ok) throw new Error('Unauthorized'); setAuthChecked(true); })
      .catch(() => router.replace('/login'));
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await fetchRequests({ page, pageSize, search, status });
      setRequests(data.requests);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load requests.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search, status]);

  useEffect(() => {
    if (authChecked) load();
  }, [authChecked, load]);

  function applySearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  }

  async function changeStatus(req: TextbookRequest, next: RequestStatus, trackingNumber?: string) {
    setBusyId(req.requestId);
    setError('');
    try {
      await updateStatus(req.requestId, next, trackingNumber);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update status.');
    } finally {
      setBusyId(null);
    }
  }

  async function openDetails(req: TextbookRequest) {
    setDetailOpen(true);
    setDetail(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      setDetail(await fetchRequest(req.requestId));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Could not load details.');
    } finally {
      setDetailLoading(false);
    }
  }

  function openPrintDialog(req: TextbookRequest) {
    setTrackingInput('');
    setDialogError('');
    setPrintDialog(req);
  }

  async function confirmMarkPrinted() {
    if (!printDialog) return;
    const tn = trackingInput.trim();
    if (!tn) { setDialogError('Please enter the tracking number.'); return; }
    const target = printDialog;
    setPrintDialog(null);
    await changeStatus(target, 'PRINTED', tn);
  }

  async function handleDelete(req: TextbookRequest) {
    if (!confirm(`Delete the request from ${req.fullName}? This cannot be undone.`)) return;
    setBusyId(req.requestId);
    setError('');
    try {
      await deleteRequest(req.requestId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete request.');
    } finally {
      setBusyId(null);
    }
  }

  function triggerUpload(id: string) {
    uploadTargetRef.current = id;
    fileInputRef.current?.click();
  }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const id = uploadTargetRef.current;
    e.target.value = '';
    if (!file || !id) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files are allowed.'); return; }
    setBusyId(id);
    setError('');
    try {
      await uploadPdf(id, file);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload PDF.');
    } finally {
      setBusyId(null);
    }
  }

  function viewPdf(req: TextbookRequest) {
    // Open the PDF URL directly in a new tab. The browser's native PDF viewer
    // streams it (Range requests) and renders the first page quickly.
    window.open(pdfUrl(req.requestId), '_blank');
  }

  function downloadPdf(req: TextbookRequest) {
    // Navigate to the download URL via a temporary link. The backend sends
    // Content-Disposition: attachment, so the browser's download manager saves
    // the file (streamed, resumable) without leaving the page.
    const a = document.createElement('a');
    a.href = pdfUrl(req.requestId, true);
    a.download = req.originalName ?? 'textbook.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  async function handleDeletePdf(req: TextbookRequest) {
    if (!confirm(`Remove the attached PDF from ${req.fullName}'s request?`)) return;
    setBusyId(req.requestId);
    setError('');
    try {
      await deletePdf(req.requestId);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove PDF.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleExportCsv() {
    try {
      const blob = await fetchCsv({ search, status });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'textbook-requests.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not export CSV.');
    }
  }

  if (!authChecked) {
    return <main className="main-shell"><p className="description">Loading...</p></main>;
  }

  const startIndex = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endIndex = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <main className="main-shell">
      <div className="page-header">
        <h1 className="page-title">All Requests</h1>
        <p className="description">Track each request, attach the PDF, and advance to print</p>
      </div>

      <div className="req-toolbar">
        <form onSubmit={applySearch} className="req-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by name, course, email or phone..." />
        </form>
        <div className="req-toolbar-actions">
          <button type="button" className="btn outline" onClick={() => setShowFilter((v) => !v)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.4rem' }}><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
            Filter
          </button>
          <button type="button" className="btn outline" onClick={handleExportCsv}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.4rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Export CSV
          </button>
        </div>
      </div>

      {showFilter && (
        <div className="req-filter-row">
          <label className="field-label" style={{ margin: 0 }}>Status</label>
          <select className="select" style={{ width: 'auto', marginTop: 0 }} value={status} onChange={(e) => { setPage(1); setStatus(e.target.value); }}>
            {STATUS_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      )}

      {error ? <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div> : null}

      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onFileChosen} style={{ display: 'none' }} />

      {loading ? (
        <p className="description">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: '#6b7280' }}>
          No requests found. <Link href="/requests/new" className="nav-link">Create one</Link>.
        </div>
      ) : (
        <div className="req-list">
          {requests.map((r) => {
            const busy = busyId === r.requestId;
            return (
              <div key={r.requestId} className="req-card">
                <div className="req-card-top">
                  <button type="button" className="req-headline" onClick={() => openDetails(r)} title="View full details">
                    <h3 className="req-name">{r.fullName}</h3>
                    <p className="req-course">{r.course}</p>
                  </button>
                  <div className="req-card-actions">
                    <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    {r.status === 'RECEIVED' && (
                      <button className="btn outline req-action" disabled={busy} onClick={() => changeStatus(r, 'SENT_TO_PRINT')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                        Send to print
                      </button>
                    )}
                    {r.status === 'SENT_TO_PRINT' && (
                      <button className="btn outline req-action req-action-ok" disabled={busy} onClick={() => openPrintDialog(r)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                        Mark printed
                      </button>
                    )}
                    {r.status === 'SENT_TO_PRINT' && (
                      <button className="btn outline req-action" disabled={busy} onClick={() => changeStatus(r, 'RECEIVED')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Revert
                      </button>
                    )}
                    {r.status === 'PRINTED' && (
                      <button className="btn outline req-action" disabled={busy} onClick={() => changeStatus(r, 'SENT_TO_PRINT')}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                        Revert
                      </button>
                    )}
                  </div>
                </div>

                <div className="req-meta">
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {r.contactNumber}
                  </span>
                  <span className="req-meta-sep">|</span>
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    {r.units}
                  </span>
                  <span className="req-meta-sep">|</span>
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    {r.address}
                  </span>
                  <span className="req-meta-sep">|</span>
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {formatDate(r.createdAt)}
                  </span>
                </div>

                {r.trackingNumber && (
                  <p className="req-tracking">Tracking number: <span>{r.trackingNumber}</span></p>
                )}

                <div className="req-pdf">
                  {r.hasFile ? (
                    <>
                      <span className="req-pdf-file">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>
                        <span className="req-pdf-name">{r.originalName}</span>
                        <span className="req-pdf-size">{formatSize(r.fileSize)}</span>
                      </span>
                      <div className="req-pdf-actions">
                        <button className="btn outline req-action" disabled={busy} onClick={() => viewPdf(r)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                          View
                        </button>
                        <button className="btn outline req-action" disabled={busy} onClick={() => downloadPdf(r)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                          Download
                        </button>
                        <button className="btn outline req-action req-action-danger" disabled={busy} onClick={() => handleDeletePdf(r)} aria-label="Delete PDF">
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="req-pdf-file req-pdf-empty">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                        No PDF attached yet
                      </span>
                      <button className="btn req-action" disabled={busy} onClick={() => triggerUpload(r.requestId)}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        {busy ? 'Uploading...' : 'Upload PDF'}
                      </button>
                    </>
                  )}
                </div>

                <div className="req-card-foot">
                  <button className="req-link-danger" disabled={busy} onClick={() => handleDelete(r)}>Delete request</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="req-footer">
        <span className="description">
          {pagination.total === 0
            ? 'No requests'
            : `Showing ${startIndex} to ${endIndex} of ${pagination.total} requests`}
        </span>
        <div className="req-pager">
          <button className="req-pager-btn" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Previous page">‹</button>
          <span className="req-pager-current">{pagination.page}</span>
          <button className="req-pager-btn" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">›</button>
          <select className="select" style={{ width: 'auto', marginTop: 0 }} value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }}>
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>
        </div>
      </div>

      {printDialog && (
        <div className="modal-overlay" onClick={() => setPrintDialog(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Mark printed</h2>
            <p className="description">Enter the tracking number returned by the print / delivery site.</p>
            <label className="field-label" style={{ marginTop: '1rem' }}>Tracking number</label>
            <input className="input" autoFocus value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)}
              placeholder="e.g. 1Z999AA10123456784"
              onKeyDown={(e) => { if (e.key === 'Enter') confirmMarkPrinted(); }} />
            {dialogError ? <div className="alert" style={{ marginTop: '0.75rem' }}>{dialogError}</div> : null}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPrintDialog(null)}>Cancel</button>
              <button className="btn" onClick={confirmMarkPrinted}>Confirm &amp; mark printed</button>
            </div>
          </div>
        </div>
      )}

      {detailOpen && (
        <div className="modal-overlay" onClick={() => setDetailOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="detail-head">
              <div>
                <h2 className="modal-title">{detail?.fullName ?? 'Request details'}</h2>
                {detail && <p className="description" style={{ margin: '0.15rem 0 0' }}>{detail.course}</p>}
              </div>
              <div className="detail-head-right">
                {detail && <span className={statusBadgeClass(detail.status)}>{statusLabel(detail.status)}</span>}
                <button className="detail-close" onClick={() => setDetailOpen(false)} aria-label="Close">×</button>
              </div>
            </div>

            {detailLoading && <p className="description">Loading...</p>}
            {detailError && <div className="alert">{detailError}</div>}

            {detail && !detailLoading && (
              <>
                <dl className="detail-grid">
                  <div><dt>Email</dt><dd>{detail.email}</dd></div>
                  <div><dt>Contact Number</dt><dd>{detail.contactNumber}</dd></div>
                  <div><dt>Course / Qualification</dt><dd>{detail.course}</dd></div>
                  <div><dt>Units Required</dt><dd>{detail.units}</dd></div>
                  <div className="detail-wide"><dt>Delivery Address</dt><dd>{detail.address}</dd></div>
                  <div><dt>Tracking Number</dt><dd>{detail.trackingNumber
                    ? <span className="detail-tracking">{detail.trackingNumber}</span>
                    : <span className="detail-muted">Not sent to print yet</span>}</dd></div>
                  <div><dt>Attached PDF</dt><dd>{detail.hasFile
                    ? <span>{detail.originalName} <span className="detail-muted">({formatSize(detail.fileSize)})</span></span>
                    : <span className="detail-muted">No PDF attached</span>}</dd></div>
                </dl>

                <h3 className="detail-section-title">Activity timeline</h3>
                <ul className="timeline">
                  {detail.events.length === 0 && <li className="detail-muted">No activity recorded.</li>}
                  {detail.events.map((ev, i) => (
                    <li key={i} className="timeline-item">
                      <span className="timeline-marker" />
                      <div className="timeline-content">
                        <span className="timeline-status">{eventLabel(ev.type)}</span>
                        {ev.detail && <span className="timeline-meta">{ev.detail}</span>}
                        <span className="timeline-meta">
                          {new Date(ev.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
