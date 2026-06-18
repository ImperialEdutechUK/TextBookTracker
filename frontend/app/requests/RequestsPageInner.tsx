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

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

function KebabMenu({ onDelete, disabled }: { onDelete: () => void; disabled: boolean }) {
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
          <button className="kebab-item danger" onClick={() => { setOpen(false); onDelete(); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            Delete request
          </button>
        </div>
      )}
    </div>
  );
}

const stepCircle = (done: boolean, active: boolean, num: number) => (
  <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, background: done ? '#16a34a' : active ? '#2563eb' : '#e2e8f0', color: done || active ? '#fff' : '#94a3b8' }}>
    {done ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : num}
  </div>
);

const actionBtn = (label: string, color: string, icon: React.ReactNode, onClick: () => void, disabled: boolean) => (
  <button disabled={disabled} onClick={onClick} style={{ background: color, color: '#fff', border: 'none', borderRadius: 8, padding: '0.55rem 1.2rem', fontSize: '0.85rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: 6, opacity: disabled ? 0.7 : 1 }}>
    {icon}{label}
  </button>
);

const undoBtn = (label: string, onClick: () => void, disabled: boolean) => (
  <button disabled={disabled} onClick={onClick} style={{ background: '#fff', color: '#6b7280', border: '1px solid #d1d5db', borderRadius: 8, padding: '0.45rem 0.9rem', fontSize: '0.8rem', fontWeight: 500, cursor: 'pointer' }}>
    {label}
  </button>
);

export default function RequestsPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [authChecked, setAuthChecked] = useState(false);
  const [requests, setRequests] = useState<TextbookRequest[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, pageSize: 10, total: 0, totalPages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [searchInput, setSearchInput] = useState(searchParams.get('search') ?? '');
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
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

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 3000); }

  useEffect(() => {
    apiFetch('/api/auth/me')
      .then((res) => { if (!res.ok) throw new Error('Unauthorized'); setAuthChecked(true); })
      .catch(() => router.replace('/login'));
  }, [router]);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const data = await fetchRequests({ page, pageSize, search, status });
      setRequests(data.requests); setPagination(data.pagination);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not load requests.'); }
    finally { setLoading(false); }
  }, [page, pageSize, search, status]);

  useEffect(() => { if (authChecked) load(); }, [authChecked, load]);

  function applySearch(e: React.FormEvent) { e.preventDefault(); setPage(1); setSearch(searchInput.trim()); }

  async function changeStatus(req: TextbookRequest, next: RequestStatus, trackingNumber?: string) {
    setBusyId(req.requestId); setError('');
    try {
      await updateStatus(req.requestId, next, trackingNumber);
      await load();
      showToast(next === 'SENT_TO_PRINT' ? 'Sent to print ✓' : next === 'PRINTED' ? 'Marked as printed ✓' : 'Status updated');
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not update status.'); }
    finally { setBusyId(null); }
  }

  async function openDetails(req: TextbookRequest) {
    setDetailOpen(true); setDetail(null); setDetailError(''); setDetailLoading(true);
    try { setDetail(await fetchRequest(req.requestId)); }
    catch (err) { setDetailError(err instanceof Error ? err.message : 'Could not load details.'); }
    finally { setDetailLoading(false); }
  }

  function openPrintDialog(req: TextbookRequest) { setTrackingInput(''); setDialogError(''); setPrintDialog(req); }

  async function confirmMarkPrinted() {
    if (!printDialog) return;
    const tn = trackingInput.trim();
    if (!tn) { setDialogError('Please enter the tracking number.'); return; }
    const target = printDialog; setPrintDialog(null);
    await changeStatus(target, 'PRINTED', tn);
  }

  async function handleDelete(req: TextbookRequest) {
    if (!confirm(`Delete the request from ${req.fullName}? This cannot be undone.`)) return;
    setBusyId(req.requestId); setError('');
    try { await deleteRequest(req.requestId); await load(); showToast('Request deleted'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not delete request.'); }
    finally { setBusyId(null); }
  }

  function openEdit(req: TextbookRequest) {
    setEditTarget(req);
    setEditForm({ fullName: req.fullName, email: req.email, contactNumber: req.contactNumber, course: req.course, units: req.units, address: req.address });
    setEditError(''); setEditOpen(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editTarget) return;
    setEditSaving(true); setEditError('');
    try {
      await apiFetch(`/api/textbook-requests/${editTarget.requestId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm) });
      setEditOpen(false); await load(); showToast('Request updated');
    } catch (err) { setEditError(err instanceof Error ? err.message : 'Could not save changes.'); }
    finally { setEditSaving(false); }
  }

  function triggerUpload(id: string) { uploadTargetRef.current = id; fileInputRef.current?.click(); }

  async function onFileChosen(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; const id = uploadTargetRef.current; e.target.value = '';
    if (!file || !id) return;
    if (file.type !== 'application/pdf') { setError('Only PDF files are allowed.'); return; }
    setBusyId(id); setError('');
    try { await uploadPdf(id, file); await load(); showToast('PDF uploaded ✓'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not upload PDF.'); }
    finally { setBusyId(null); }
  }

  async function handleDeletePdf(req: TextbookRequest) {
    if (!confirm(`Remove the PDF from ${req.fullName}'s request?`)) return;
    setBusyId(req.requestId); setError('');
    try { await deletePdf(req.requestId); await load(); showToast('PDF removed'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not remove PDF.'); }
    finally { setBusyId(null); }
  }

  function viewPdf(req: TextbookRequest) { window.open(pdfUrl(req.requestId), '_blank'); }
  function downloadPdf(req: TextbookRequest) {
    const a = document.createElement('a'); a.href = pdfUrl(req.requestId, true);
    a.download = req.originalName ?? 'textbook.pdf'; document.body.appendChild(a); a.click(); a.remove();
  }

  async function handleExportCsv() {
    try {
      const blob = await fetchCsv({ search, status });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'textbook-requests.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not export CSV.'); }
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
        <p className="description">Track each request through to print</p>
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
            const hasPdf = r.hasFile;
            const isSentToPrint = r.status === 'SENT_TO_PRINT';
            const isPrinted = r.status === 'PRINTED';
            const days = daysAgo(r.createdAt);
            const urgent = days >= 3 && !isPrinted;

            return (
              <div key={r.requestId} className="req-card" style={{ borderLeft: urgent ? '3px solid #f59e0b' : isPrinted ? '3px solid #16a34a' : '3px solid #e2e8f0' }}>

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <button type="button" className="req-headline" onClick={() => openDetails(r)} style={{ textAlign: 'left' }}>
                    <h3 className="req-name">{r.fullName}</h3>
                    <p className="req-course">{r.course}</p>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    {urgent && <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#b45309', background: '#fef3c7', padding: '2px 8px', borderRadius: 999 }}>{days}d waiting</span>}
                    <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    <button onClick={() => openEdit(r)} disabled={busy} style={{ fontSize: '0.78rem', fontWeight: 500, color: '#2563eb', background: 'none', border: '1px solid #dbeafe', borderRadius: 6, padding: '0.3rem 0.7rem', cursor: 'pointer' }}>Edit</button>
                    <KebabMenu onDelete={() => handleDelete(r)} disabled={busy} />
                  </div>
                </div>

                <div className="req-meta" style={{ marginBottom: '0.6rem' }}>
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                    {r.contactNumber}
                  </span>
                  <span className="req-meta-sep">|</span>
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    {r.email}
                  </span>
                  <span className="req-meta-sep">|</span>
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
                    {r.units}
                  </span>
                  <span className="req-meta-sep">|</span>
                  <span className="req-meta-item">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                    {formatDate(r.createdAt)}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, margin: '0.4rem 0 0.6rem', fontSize: '0.82rem', color: '#6b7280' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" style={{ flexShrink: 0, marginTop: 2 }}><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  <div style={{ lineHeight: 1.6 }}>
                    {r.address.split(', ').map((line: string, i: number) => (
                      <div key={i}>{line}</div>
                    ))}
                  </div>
                </div>

                {r.trackingNumber && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: '0.75rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: '6px 12px', fontSize: '0.82rem' }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2"><path d="M5 12h14"/><path d="M12 5l7 7-7 7"/></svg>
                    <span style={{ color: '#15803d', fontWeight: 600 }}>Tracking number: {r.trackingNumber}</span>
                  </div>
                )}

                {isPrinted ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 12, padding: '0.85rem 1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                      </div>
                      <div>
                        <p style={{ margin: 0, fontWeight: 700, fontSize: '0.875rem', color: '#15803d' }}>All done — printed and complete</p>
                        {hasPdf && <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#16a34a' }}>{r.originalName} · {formatSize(r.fileSize)}</p>}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                      {hasPdf && <>
                        <button className="btn outline req-action" disabled={busy} onClick={() => viewPdf(r)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>View PDF</button>
                        <button className="btn outline req-action" disabled={busy} onClick={() => downloadPdf(r)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>Download</button>
                      </>}
                      {undoBtn('← Undo', () => changeStatus(r, 'SENT_TO_PRINT'), busy)}
                    </div>
                  </div>
                ) : (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '1rem', marginTop: '0.25rem' }}>
                    <p style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#94a3b8', margin: '0 0 0.85rem 0' }}>What to do next</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {stepCircle(hasPdf, !hasPdf, 1)}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <div>
                            <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: hasPdf ? '#16a34a' : '#1e293b' }}>Upload course materials PDF</p>
                            {hasPdf && <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#64748b' }}>{r.originalName} · {formatSize(r.fileSize)}</p>}
                          </div>
                          {hasPdf ? (
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button className="btn outline req-action" disabled={busy} onClick={() => viewPdf(r)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>View</button>
                              <button className="btn outline req-action" disabled={busy} onClick={() => downloadPdf(r)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>Download</button>
                              <button disabled={busy} onClick={() => handleDeletePdf(r)} style={{ fontSize: '0.78rem', padding: '0.3rem 0.5rem', border: '1px solid #fecaca', borderRadius: 6, background: '#fff', cursor: 'pointer', color: '#dc2626' }} aria-label="Remove PDF">
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              </button>
                            </div>
                          ) : (
                            actionBtn(busy ? 'Uploading...' : 'Upload PDF', '#2563eb',
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
                              () => triggerUpload(r.requestId), busy)
                          )}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', opacity: !hasPdf ? 0.45 : 1 }}>
                        {stepCircle(isSentToPrint, hasPdf && !isSentToPrint, 2)}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: isSentToPrint ? '#16a34a' : '#1e293b' }}>Send to print</p>
                          {r.status === 'RECEIVED' && hasPdf && (
                            actionBtn('Send to Print', '#2563eb',
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>,
                              () => changeStatus(r, 'SENT_TO_PRINT'), busy)
                          )}
                          {isSentToPrint && undoBtn('← Undo', () => changeStatus(r, 'RECEIVED'), busy)}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', opacity: !isSentToPrint ? 0.45 : 1 }}>
                        {stepCircle(false, isSentToPrint, 3)}
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                          <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>Mark as printed</p>
                          {isSentToPrint && (
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                              {actionBtn('Mark Printed', '#16a34a',
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>,
                                () => openPrintDialog(r), busy)}
                              {undoBtn('← Undo', () => changeStatus(r, 'RECEIVED'), busy)}
                            </div>
                          )}
                        </div>
                      </div>

                    </div>
                  </div>
                )}
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
            <h2 className="modal-title">Mark as Printed</h2>
            <p className="description">Enter the tracking number from the print / delivery site before confirming.</p>
            <label className="field-label" style={{ marginTop: '1rem' }}>Tracking number <span style={{ color: '#ef4444' }}>*</span></label>
            <input className="input" autoFocus value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)}
              placeholder="e.g. 1Z999AA10123456784"
              onKeyDown={(e) => { if (e.key === 'Enter') confirmMarkPrinted(); }} />
            {dialogError ? <div className="alert" style={{ marginTop: '0.75rem' }}>{dialogError}</div> : null}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPrintDialog(null)}>Cancel</button>
              <button className="btn" style={{ background: '#16a34a', borderColor: '#16a34a' }} onClick={confirmMarkPrinted}>
                Confirm &amp; mark printed
              </button>
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
                  <div><dt>Tracking Number</dt><dd>{detail.trackingNumber ? <span className="detail-tracking">{detail.trackingNumber}</span> : <span className="detail-muted">Not yet sent to print</span>}</dd></div>
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
