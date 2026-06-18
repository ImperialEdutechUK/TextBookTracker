'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { apiFetch, apiUrl, getToken } from '@/lib/api';
import {
  fetchRequests, fetchRequest, deleteRequest, updateStatus, uploadPdf, deletePdf, fetchCsv,
  statusLabel, eventLabel, TextbookRequest, RequestDetail, RequestStatus, Pagination,
} from '@/lib/requests';

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

function ProgressBar({ status }: { status: string }) {
  const steps = ['RECEIVED', 'SENT_TO_PRINT', 'PRINTED'];
  const idx = steps.indexOf(status);
  return (
    <div className="req-progress">
      {steps.map((s, i) => (
        <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
          <div className={`req-progress-step${i <= idx ? ' done' : ''}${i === idx ? ' active' : ''}`}>
            <div className="req-progress-dot" />
            <span style={{ whiteSpace: 'nowrap' }}>{statusLabel(s)}</span>
          </div>
          {i < steps.length - 1 && <div className={`req-progress-line${i < idx ? ' done' : ''}`} style={{ flex: 1, margin: '0 6px' }} />}
        </div>
      ))}
    </div>
  );
}

function KebabMenu({ onEdit, onDelete, disabled }: { onEdit: () => void; onDelete: () => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function close(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  return (
    <div className="kebab-wrap" ref={ref}>
      <button className="kebab-btn" disabled={disabled} onClick={() => setOpen(v => !v)} aria-label="More options">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
      </button>
      {open && (
        <div className="kebab-menu">
          <button className="kebab-item" onClick={() => { setOpen(false); onEdit(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit details
          </button>
          <button className="kebab-item danger" onClick={() => { setOpen(false); onDelete(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete request
          </button>
        </div>
      )}
    </div>
  );
}

export default function RequestsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(false);
  const [requests, setRequests] = useState<TextbookRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [showFilter, setShowFilter] = useState(!!searchParams.get('status'));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [printDialog, setPrintDialog] = useState<TextbookRequest | null>(null);
  const [trackingInput, setTrackingInput] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TextbookRequest | null>(null);
  const [editForm, setEditForm] = useState({ fullName: '', email: '', contactNumber: '', course: '', units: '', address: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const uploadTargetRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

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

  useEffect(() => { if (authChecked) load(); }, [authChecked, load]);

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
      showToast(next === 'SENT_TO_PRINT' ? 'Sent to print' : next === 'PRINTED' ? 'Marked as printed' : 'Status updated');
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
      showToast('Request deleted');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete request.');
    } finally {
      setBusyId(null);
    }
  }

  function openEdit(req: TextbookRequest) {
    setEditTarget(req);
    setEditForm({ fullName: req.fullName, email: req.email, contactNumber: req.contactNumber, course: req.course, units: req.units, address: req.address });
    setEditError('');
    setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editTarget) return;
    setEditSaving(true);
    setEditError('');
    try {
      await apiFetch(`/api/textbook-requests/${editTarget.requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      setEditOpen(false);
      await load();
      showToast('Request updated');
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save changes.');
    } finally {
      setEditSaving(false);
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
      showToast('PDF uploaded');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload PDF.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeletePdf(req: TextbookRequest) {
    if (!confirm(`Remove the attached PDF from ${req.fullName}'s request?`)) return;
    setBusyId(req.requestId);
    setError('');
    try {
      await deletePdf(req.requestId);
      await load();
      showToast('PDF removed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove PDF.');
    } finally {
      setBusyId(null);
    }
  }

  function viewPdf(req: TextbookRequest) { window.open(pdfUrl(req.requestId), '_blank'); }

  function downloadPdf(req: TextbookRequest) {
    const a = document.createElement('a');
    a.href = pdfUrl(req.requestId, true);
    a.download = req.originalName ?? 'textbook.pdf';
    document.body.appendChild(a);
    a.click();
    a.remove();
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

  if (!authChecked) return <main className="main-shell"><p className="description">Loading...</p></main>;

  const startIndex = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
  const endIndex = Math.min(pagination.page * pagination.pageSize, pagination.total);

  return (
    <main className="main-shell">
      {toast && (
        <div className="toast-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          {toast}
        </div>
      )}
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
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#6b7280' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" style={{ margin: '0 auto 1rem', display: 'block' }}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          No requests found. <Link href="/requests/new" className="nav-link">Create one</Link>.
        </div>
      ) : (
        <div className="req-list">
          {requests.map((r) => {
            const busy = busyId === r.requestId;
            const pdfRequired = !r.hasFile;
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
                      pdfRequired ? (
                        <span className="req-pdf-locked">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          Upload PDF first
                        </span>
                      ) : (
                        <button className="btn outline req-action" disabled={busy} onClick={() => changeStatus(r, 'SENT_TO_PRINT')}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                          Send to print
                        </button>
                      )
                    )}
                    {r.status === 'SENT_TO_PRINT' && (
                      pdfRequired ? (
                        <span className="req-pdf-locked">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          Upload PDF first
                        </span>
                      ) : (
                        <button className="btn outline req-action req-action-ok" disabled={busy} onClick={() => openPrintDialog(r)}>
                          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                          Mark printed
                        </button>
                      )
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
                    <KebabMenu onEdit={() => openEdit(r)} onDelete={() => handleDelete(r)} disabled={busy} />
                  </div>
                </div>
                <ProgressBar status={r.status} />
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
              </div>
            );
          })}
        </div>
      )}
      <div className="req-footer">
        <span className="description">
          {pagination.total === 0 ? 'No requests' : `Showing ${startIndex} to ${endIndex} of ${pagination.total} requests`}
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
      {editOpen && editTarget && (
        <div className="modal-overlay" onClick={() => setEditOpen(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
            <div className="detail-head">
              <h2 className="modal-title">Edit request</h2>
              <button className="detail-close" onClick={() => setEditOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={saveEdit} className="form-grid" style={{ marginTop: '1rem' }}>
              <div><label className="field-label">Full Name</label><input className="input" value={editForm.fullName} onChange={(e) => setEditForm(f => ({...f, fullName: e.target.value}))} required /></div>
              <div><label className="field-label">Email</label><input className="input" type="email" value={editForm.email} onChange={(e) => setEditForm(f => ({...f, email: e.target.value}))} required /></div>
              <div><label className="field-label">Contact Number</label><input className="input" value={editForm.contactNumber} onChange={(e) => setEditForm(f => ({...f, contactNumber: e.target.value}))} required /></div>
              <div><label className="field-label">Course / Qualification</label><input className="input" value={editForm.course} onChange={(e) => setEditForm(f => ({...f, course: e.target.value}))} required /></div>
              <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Units Required</label><input className="input" value={editForm.units} onChange={(e) => setEditForm(f => ({...f, units: e.target.value}))} required /></div>
              <div style={{ gridColumn: '1 / -1' }}><label className="field-label">Delivery Address</label><textarea className="input" rows={3} value={editForm.address} onChange={(e) => setEditForm(f => ({...f, address: e.target.value}))} required /></div>
              {editError && <div className="alert" style={{ gridColumn: '1 / -1' }}>{editError}</div>}
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: '0.75rem' }}>
                <button className="btn" type="submit" disabled={editSaving}>{editSaving ? 'Saving...' : 'Save changes'}</button>
                <button className="btn secondary" type="button" onClick={() => setEditOpen(false)}>Cancel</button>
              </div>
            </form>
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
                  <div><dt>Tracking Number</dt><dd>{detail.trackingNumber ? <span className="detail-tracking">{detail.trackingNumber}</span> : <span className="detail-muted">Not sent to print yet</span>}</dd></div>
                  <div><dt>Attached PDF</dt><dd>{detail.hasFile ? <span>{detail.originalName} <span className="detail-muted">({formatSize(detail.fileSize)})</span></span> : <span className="detail-muted">No PDF attached</span>}</dd></div>
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
                        <span className="timeline-meta">{new Date(ev.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
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
