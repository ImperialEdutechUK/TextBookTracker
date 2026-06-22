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

const STATUS_FILTERS = [
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
function splitName(full: string) {
  const parts = (full || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { first: parts[0] || '', last: '' };
  return { first: parts[0], last: parts.slice(1).join(' ') };
}
function extractPostcode(address: string) {
  const parts = (address || '').split(',').map(s => s.trim()).filter(Boolean);
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    if (/united kingdom|^uk$|england|scotland|wales|northern ireland/i.test(last))
      return parts[parts.length - 2] || '';
    return last;
  }
  return parts[0] || '';
}
function buildCopyAll(r: TextbookRequest) {
  const sp = splitName(r.fullName);
  const first = r.firstName ?? sp.first;
  const last = r.lastName ?? sp.last;
  const postcode = extractPostcode(r.address);
  const addr = (r.address || '').split(',').map(s => s.trim()).filter(Boolean).join('\n');
  return [
    `First Name: ${first}`,
    `Last Name: ${last}`,
    `Phone: ${r.contactNumber}`,
    `Email: ${r.email}`,
    `Course: ${r.course}`,
    `Units: ${r.units}`,
    `Postcode: ${postcode}`,
    ``,
    `Address:`,
    addr,
  ].join('\n');
}

const copyIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
);

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
  <div style={{ width: 27, height: 27, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, background: done ? '#16a34a' : active ? '#2563eb' : '#e2e8f0', color: done || active ? '#fff' : '#94a3b8' }}>
    {done ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> : num}
  </div>
);
const bigBtn = (label: string, color: string, icon: React.ReactNode, onClick: () => void, disabled: boolean) => (
  <button disabled={disabled} onClick={onClick} style={{ width: '100%', border: 'none', borderRadius: 8, height: 40, fontSize: 13.5, fontWeight: 600, letterSpacing: '0.01em', color: '#fff', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, boxShadow: '0 1px 2px rgba(16,24,40,0.08)' }}>{icon}{label}</button>
);
const undoBtn = (onClick: () => void, disabled: boolean) => (
  <button disabled={disabled} onClick={onClick} style={{ width: '100%', background: '#fff', color: '#475569', border: '1px solid #d8dde3', borderRadius: 8, padding: '8px 0', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>← Undo</button>
);
const lockNote = (text: string) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#a8b3c0', justifyContent: 'center', height: 44 }}>
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>{text}
  </div>
);
const arrow = (on: boolean) => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, flexShrink: 0, color: on ? '#2563eb' : '#cbd5e1' }}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
  </div>
);
const tBox = (bg: string, border: string): React.CSSProperties => ({ flex: 1, borderRadius: 14, padding: '15px 15px 17px', display: 'flex', flexDirection: 'column', gap: 11, border: `1.5px solid ${border}`, background: bg });

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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
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

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(''), 2500); }
  async function copyText(text: string, label: string) {
    try { await navigator.clipboard.writeText(text); showToast(`${label} copied ✓`); }
    catch { showToast('Could not copy'); }
  }

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

  // debounced search — filters as you type
  useEffect(() => {
    const t = setTimeout(() => { setPage(1); setSearch(searchInput.trim()); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

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

  const boxStyle: React.CSSProperties = { background: '#f9fafb', border: '1px solid #ecedf1', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 9 };
  const copyableStyle: React.CSSProperties = { ...boxStyle };
  const blLabel: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', color: '#9aa6b5', marginBottom: 4 };
  const bvVal: React.CSSProperties = { fontSize: 14, color: '#111827', fontWeight: 600 };
  const copyBtnStyle: React.CSSProperties = { flexShrink: 0, width: 28, height: 28, borderRadius: 7, border: '1px solid #e5e7eb', background: '#fff', color: '#94a3b8', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' };

  return (
    <main className="main-shell">
      {toast && (
        <div className="toast-success">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>{toast}
        </div>
      )}

      <div className="page-header">
        <h1 className="page-title">All Requests</h1>
        <p className="description">Track each request through to print</p>
      </div>

      <div className="req-toolbar">
        <form onSubmit={applySearch} className="req-search">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input autoFocus value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Type a name, course, email or phone to find a learner..." />
          {searchInput && (
            <button type="button" onClick={() => { setSearchInput(''); setPage(1); setSearch(''); }} aria-label="Clear search" style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: 4 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </form>
        <div className="req-toolbar-actions">
          <button type="button" className="btn outline" onClick={handleExportCsv}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '0.4rem' }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export CSV
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 18, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => {
          const active = status === f.value;
          const theme: Record<string, { on: string; offBg: string; offText: string; offBorder: string }> = {
            '': { on: '#1e293b', offBg: '#fff', offText: '#475569', offBorder: '#e2e8f0' },
            'RECEIVED': { on: '#f59e0b', offBg: '#fffbeb', offText: '#b45309', offBorder: '#fde68a' },
            'SENT_TO_PRINT': { on: '#2563eb', offBg: '#eff6ff', offText: '#1d4ed8', offBorder: '#bfdbfe' },
            'PRINTED': { on: '#16a34a', offBg: '#f0fdf4', offText: '#15803d', offBorder: '#bbf7d0' },
          };
          const t = theme[f.value] || theme[''];
          return (
            <button key={f.value} type="button" onClick={() => { setPage(1); setStatus(f.value); }}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '11px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                border: `2px solid ${active ? t.on : t.offBorder}`,
                background: active ? t.on : t.offBg,
                color: active ? '#fff' : t.offText,
                boxShadow: active ? '0 2px 8px rgba(15,23,42,0.12)' : 'none' }}>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: active ? '#fff' : t.on, display: 'inline-block' }} />
              {f.label}
            </button>
          );
        })}
      </div>

      <p style={{ fontSize: 13, color: '#64748b', margin: '0 0 14px' }}>
        {loading ? 'Searching...' : `${pagination.total} ${pagination.total === 1 ? 'request' : 'requests'}${(search || status) ? ' found' : ''}`}
      </p>
      {error ? <div className="alert" style={{ marginBottom: '1rem' }}>{error}</div> : null}
      <input ref={fileInputRef} type="file" accept="application/pdf" onChange={onFileChosen} style={{ display: 'none' }} />

      {loading ? (
        <p className="description">Loading requests...</p>
      ) : requests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2.5rem', color: '#6b7280' }}>
          No requests found. <Link href="/requests/new" className="nav-link">Create one</Link>.
        </div>
      ) : (
        <div className="req-list">
          {requests.map((r) => {
            const busy = busyId === r.requestId;
            const open = openId === r.requestId;
            const hasPdf = r.hasFile;
            const isReceived = r.status === 'RECEIVED';
            const isSent = r.status === 'SENT_TO_PRINT';
            const isPrinted = r.status === 'PRINTED';
            const sp = splitName(r.fullName);
            const first = r.firstName ?? sp.first;
            const last = r.lastName ?? sp.last;
            const postcode = extractPostcode(r.address);
            const addrLines = (r.address || '').split(',').map(s => s.trim()).filter(Boolean);
            const topBorder = isPrinted ? '4px solid #16a34a' : isSent ? '4px solid #2563eb' : '4px solid #f59e0b';

            return (
              <div key={r.requestId} className="req-card" style={{ borderTop: topBorder, background: '#f6f7f9' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, background: '#fff', border: '1px solid #e7eaef', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                  <button type="button" className="req-headline" onClick={() => openDetails(r)} style={{ textAlign: 'left' }}>
                    <h3 className="req-name">{r.fullName}</h3>
                    <p className="req-course">{r.course}</p>
                    <p style={{ fontSize: 13, color: '#374151', margin: '4px 0 0', fontWeight: 600 }}>Entered {formatDate(r.createdAt)}</p>
                  </button>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    <button onClick={() => copyText(buildCopyAll(r), 'All details')} disabled={busy} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(16,24,40,0.08)' }}>{copyIcon}Copy All</button>
                    <span className={statusBadgeClass(r.status)}>{statusLabel(r.status)}</span>
                    <button onClick={() => openEdit(r)} disabled={busy} style={{ fontSize: 13, fontWeight: 600, color: '#475569', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '7px 13px', cursor: 'pointer' }}>Edit</button>
                    <KebabMenu onDelete={() => handleDelete(r)} disabled={busy} />
                  </div>
                </div>

                <div style={{ background: '#fff', border: '1px solid #e7eaef', borderRadius: 12, padding: 16, marginBottom: 12 }}>
                <button type="button" onClick={() => setOpenId(open ? null : r.requestId)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#64748b', margin: open ? '0 0 12px' : 0, padding: 0, width: '100%' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}><polyline points="9 18 15 12 9 6"/></svg>
                  {open ? 'Hide learner details' : 'Show learner details & copy fields'}
                </button>
                {open && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 11 }}>
                  <div style={copyableStyle}>
                    <div><div style={blLabel}>First Name</div><div style={bvVal}>{first || '—'}</div></div>
                    <button style={copyBtnStyle} onClick={() => copyText(first, 'First name')} aria-label="Copy first name">{copyIcon}</button>
                  </div>
                  <div style={copyableStyle}>
                    <div><div style={blLabel}>Last Name</div><div style={bvVal}>{last || '—'}</div></div>
                    <button style={copyBtnStyle} onClick={() => copyText(last, 'Last name')} aria-label="Copy last name">{copyIcon}</button>
                  </div>
                  <div style={copyableStyle}>
                    <div><div style={blLabel}>Phone</div><div style={bvVal}>{r.contactNumber}</div></div>
                    <button style={copyBtnStyle} onClick={() => copyText(r.contactNumber, 'Phone')} aria-label="Copy phone">{copyIcon}</button>
                  </div>
                  <div style={copyableStyle}><div><div style={blLabel}>Email</div><div style={bvVal}>{r.email}</div></div><button style={copyBtnStyle} onClick={() => copyText(r.email, 'Email')} aria-label="Copy email">{copyIcon}</button></div>
                  <div style={copyableStyle}><div><div style={blLabel}>Course</div><div style={bvVal}>{r.course}</div></div><button style={copyBtnStyle} onClick={() => copyText(r.course, 'Course')} aria-label="Copy course">{copyIcon}</button></div>
                  <div style={copyableStyle}><div><div style={blLabel}>Units</div><div style={bvVal}>{r.units}</div></div><button style={copyBtnStyle} onClick={() => copyText(r.units, 'Units')} aria-label="Copy units">{copyIcon}</button></div>

                  <div style={{ gridColumn: '1 / -1', background: '#f9fafb', border: '1px solid #ecedf1', borderRadius: 10, padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: '#eff4ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      </div>
                      <div><div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#94a3b8' }}>Postcode</div><div style={{ fontSize: 17, fontWeight: 700, color: '#111827', letterSpacing: '.02em' }}>{postcode || '—'}</div></div>
                    </div>
                    <button onClick={() => copyText(postcode, 'Postcode')} style={{ display: 'flex', alignItems: 'center', gap: 7, background: '#2563eb', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer', boxShadow: '0 1px 2px rgba(16,24,40,0.08)' }}>{copyIcon}Copy postcode</button>
                  </div>

                  <div style={{ gridColumn: '1 / -1', background: '#f8fafc', border: '1px solid #eef1f5', borderRadius: 11, padding: '11px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div style={blLabel}>Full Delivery Address</div><button style={copyBtnStyle} onClick={() => copyText(addrLines.join(String.fromCharCode(10)), 'Address')} aria-label="Copy address">{copyIcon}</button></div>
                    <div style={{ fontSize: 14, color: '#1f2937', fontWeight: 600, lineHeight: 1.55 }}>
                      {addrLines.length ? addrLines.map((l, i) => <div key={i}>{l}</div>) : <span style={{ color: '#94a3b8' }}>No address</span>}
                    </div>
                  </div>
                </div>
                )}
                </div>

                <div style={{ background: '#fff', border: '1px solid #e7eaef', borderRadius: 12, padding: 16, marginBottom: 0 }}>
                <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.05em', textTransform: 'uppercase', color: '#475569', margin: '0 0 12px' }}>Status — complete the steps in order</p>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>
                  <div style={tBox(hasPdf ? '#f0fdf4' : '#eff6ff', hasPdf ? '#bbf7d0' : '#bfdbfe')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>{stepCircle(hasPdf, !hasPdf, 1)}<div style={{ fontSize: 13.5, fontWeight: 700, color: hasPdf ? '#15803d' : '#1e3a8a' }}>{hasPdf ? 'PDF Uploaded' : 'Upload PDF'}</div></div>
                    {hasPdf ? (
                      <div style={{ display: 'flex', gap: 7 }}>
                        <button onClick={() => viewPdf(r)} disabled={busy} style={{ flex: 1, fontSize: 12, padding: '8px 0', borderRadius: 8, border: '1.5px solid #cdebd6', background: '#fff', color: '#15803d', cursor: 'pointer', fontWeight: 600 }}>View</button>
                        <button onClick={() => downloadPdf(r)} disabled={busy} style={{ flex: 1, fontSize: 12, padding: '8px 0', borderRadius: 8, border: '1.5px solid #cdebd6', background: '#fff', color: '#15803d', cursor: 'pointer', fontWeight: 600 }}>Save</button>
                        <button onClick={() => handleDeletePdf(r)} disabled={busy} style={{ fontSize: 12, padding: '8px 10px', borderRadius: 8, border: '1px solid #fecaca', background: '#fff', color: '#dc2626', cursor: 'pointer' }} aria-label="Remove PDF">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
                        </button>
                      </div>
                    ) : bigBtn(busy ? 'Uploading...' : 'Upload PDF', '#2563eb', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>, () => triggerUpload(r.requestId), busy)}
                  </div>

                  {arrow(hasPdf)}

                  <div style={tBox((isSent || isPrinted) ? '#f0fdf4' : '#f8fafc', (isSent || isPrinted) ? '#bbf7d0' : '#eef1f5')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>{stepCircle(isSent || isPrinted, hasPdf && isReceived, 2)}<div style={{ fontSize: 13.5, fontWeight: 700, color: (isSent || isPrinted) ? '#15803d' : hasPdf && isReceived ? '#1e3a8a' : '#94a3b8' }}>{(isSent || isPrinted) ? 'Sent to Print' : 'Send to Print'}</div></div>
                    {isReceived && hasPdf && bigBtn('Send to Print', '#2563eb', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>, () => changeStatus(r, 'SENT_TO_PRINT'), busy)}
                    {isReceived && !hasPdf && lockNote('Upload PDF first')}
                    {isSent && undoBtn(() => changeStatus(r, 'RECEIVED'), busy)}
                    {isPrinted && <div style={{ height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#16a34a', fontWeight: 600 }}>Done ✓</div>}
                  </div>

                  {arrow(isSent || isPrinted)}

                  <div style={tBox(isPrinted ? '#f0fdf4' : isSent ? '#eff6ff' : '#f8fafc', isPrinted ? '#bbf7d0' : isSent ? '#bfdbfe' : '#eef1f5')}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>{stepCircle(isPrinted, isSent, 3)}<div style={{ fontSize: 13.5, fontWeight: 700, color: isPrinted ? '#15803d' : isSent ? '#1e3a8a' : '#94a3b8' }}>{isPrinted ? 'Printed' : 'Mark Printed'}</div></div>
                    {isPrinted ? (
                      <>
                        <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '.03em', textTransform: 'uppercase', color: '#9aa6b5' }}>Tracking number</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: -4 }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#15803d', wordBreak: 'break-all' }}>{r.trackingNumber || '\u2014'}</span>
                          {r.trackingNumber && (
                            <button onClick={() => copyText(r.trackingNumber || '', 'Tracking number')} style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 7, border: '1px solid #bbf7d0', background: '#fff', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} aria-label="Copy tracking number">{copyIcon}</button>
                          )}
                        </div>
                        {undoBtn(() => changeStatus(r, 'SENT_TO_PRINT'), busy)}
                      </>
                    ) : isSent ? (
                      <>
                        {bigBtn('Mark Printed', '#2563eb', <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.4"><polyline points="20 6 9 17 4 12"/></svg>, () => openPrintDialog(r), busy)}
                        {undoBtn(() => changeStatus(r, 'RECEIVED'), busy)}
                      </>
                    ) : lockNote('Tracking number')}
                  </div>
                </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="req-footer">
        <span className="description">{pagination.total === 0 ? 'No requests' : `Showing ${startIndex} to ${endIndex} of ${pagination.total} requests`}</span>
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
            <input className="input" autoFocus value={trackingInput} onChange={(e) => setTrackingInput(e.target.value)} placeholder="e.g. 1Z999AA10123456784" onKeyDown={(e) => { if (e.key === 'Enter') confirmMarkPrinted(); }} />
            {dialogError ? <div className="alert" style={{ marginTop: '0.75rem' }}>{dialogError}</div> : null}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPrintDialog(null)}>Cancel</button>
              <button className="btn" style={{ background: '#2563eb', borderColor: '#2563eb' }} onClick={confirmMarkPrinted}>Confirm &amp; mark printed</button>
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
