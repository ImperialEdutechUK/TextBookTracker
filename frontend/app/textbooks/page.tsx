'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CatalogTextbook, fetchTextbooks, fetchTextbookFile } from '@/lib/textbooks';
import { apiFetch } from '@/lib/api';

function formatSize(bytes: number | null) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const PAGE_SIZE = 10;

export default function TextbooksPage() {
  const [items, setItems] = useState<CatalogTextbook[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    fetchTextbooks()
      .then((data) => { setItems(data); setError(''); })
      .catch((err) => { setError(err instanceof Error ? err.message : 'Unable to load textbooks.'); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((t) =>
      t.textbookName.toLowerCase().includes(term) ||
      (t.author ?? '').toLowerCase().includes(term) ||
      (t.subject ?? '').toLowerCase().includes(term)
    );
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  async function handleView(t: CatalogTextbook) {
    setError('');
    const win = window.open('', '_blank');
    setBusyId(t.id);
    try {
      const blob = await fetchTextbookFile(t.id);
      const url = URL.createObjectURL(blob);
      if (win) { win.location.href = url; } else { window.location.href = url; }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      if (win) win.close();
      setError(err instanceof Error ? err.message : 'Unable to open the PDF.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDownload(t: CatalogTextbook) {
    setError('');
    setBusyId(t.id);
    try {
      const blob = await fetchTextbookFile(t.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = t.originalName || `${t.textbookName}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      setTimeout(() => { anchor.remove(); URL.revokeObjectURL(url); }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download the PDF.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(t: CatalogTextbook) {
    if (!window.confirm(`Delete "${t.textbookName}"? This cannot be undone.`)) return;
    setBusyId(t.id);
    setError('');
    try {
      const res = await apiFetch(`/api/textbooks/${t.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message ?? 'Failed to delete textbook.');
      } else {
        await load();
      }
    } catch {
      setError('Failed to delete. Check that the backend is running.');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="main-shell">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Textbooks</h1>
          <p className="description">Browse and manage the textbook catalog.</p>
        </div>
        <Link href="/textbooks/add" className="btn">+ Add Textbook</Link>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
          <input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search textbooks..." style={{ marginTop: 0, flex: '1 1 280px', maxWidth: '420px' }} />
        </div>

        {error ? <div className="alert">{error}</div> : null}

        {loading ? (
          <p className="description" style={{ padding: '1rem 0' }}>Loading textbooks...</p>
        ) : (
          <>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Author</th>
                    <th>Subject</th>
                    <th>File</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems.length === 0 && (
                    <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280' }}>
                      {items.length === 0 ? 'No textbooks have been added yet.' : 'No textbooks match your search.'}
                    </td></tr>
                  )}
                  {pageItems.map((t) => (
                    <tr key={t.id}>
                      <td style={{ fontWeight: 500 }}>{t.textbookName}</td>
                      <td style={{ color: '#6b7280' }}>{t.author || '—'}</td>
                      <td style={{ color: '#6b7280' }}>{t.subject || '—'}</td>
                      <td style={{ color: '#6b7280' }}>{t.hasFile ? formatSize(t.fileSize) || 'PDF' : <span style={{ color: '#9ca3af' }}>No file</span>}</td>
                      <td>
                        <div className="row-actions">
                          {t.hasFile ? (
                            <>
                              <button type="button" className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                onClick={() => handleView(t)} disabled={busyId === t.id}>
                                {busyId === t.id ? 'Opening...' : 'View'}
                              </button>
                              <button type="button" className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                                onClick={() => handleDownload(t)} disabled={busyId === t.id}>
                                Download
                              </button>
                            </>
                          ) : (
                            <span className="catalog-muted" style={{ fontSize: '0.8rem' }}>No PDF</span>
                          )}
                          <button type="button" className="btn outline" style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', color: '#dc2626', borderColor: '#fecaca' }}
                            onClick={() => handleDelete(t)} disabled={busyId === t.id}>
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Showing {(page - 1) * PAGE_SIZE + 1} to {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} entries
                </span>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <button className="btn outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                    disabled={page <= 1} onClick={() => setPage(page - 1)}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).slice(0, 5).map((p) => (
                    <button key={p} className={p === page ? 'btn' : 'btn outline'}
                      style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem', minWidth: '32px' }}
                      onClick={() => setPage(p)}>{p}</button>
                  ))}
                  <button className="btn outline" style={{ padding: '0.3rem 0.7rem', fontSize: '0.8rem' }}
                    disabled={page >= totalPages} onClick={() => setPage(page + 1)}>›</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
