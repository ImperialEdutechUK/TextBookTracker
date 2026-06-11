'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CatalogTextbook,
  fetchTextbooks,
  fetchTextbookFile,
  deleteTextbook,
} from '@/lib/textbooks';

function formatSize(bytes: number | null) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// First letters of the textbook name, used for the placeholder cover when a
// textbook has no PDF to render a real front page from.
function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? '')
    .join('');
}

// Cards per page — two full rows of four. Pagination only appears once the
// catalog grows beyond this, so a partly-filled first page never shows controls.
const PAGE_SIZE = 8;

export default function AddedTextbooksGrid() {
  const [items, setItems] = useState<CatalogTextbook[]>([]);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Id of the card whose file is currently being fetched (disables its buttons).
  const [busyId, setBusyId] = useState<string | null>(null);
  // The textbook whose details popup is open (null = closed).
  const [selected, setSelected] = useState<CatalogTextbook | null>(null);
  // The textbook pending deletion (drives the confirmation dialog).
  const [deleteTarget, setDeleteTarget] = useState<CatalogTextbook | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchTextbooks()
      .then((data) => {
        if (active) {
          setItems(data);
          setError('');
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Unable to load textbooks.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((t) => t.textbookName.toLowerCase().includes(term));
  }, [items, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Keep the current page in range when the result set shrinks (e.g. searching).
  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page]
  );

  // Open the PDF in a new tab. The window is opened synchronously (inside the
  // click gesture) so the popup blocker allows it, then pointed at the blob URL
  // once the bytes have downloaded.
  async function handleView(t: CatalogTextbook) {
    setError('');
    const win = window.open('', '_blank');
    setBusyId(t.id);
    try {
      const blob = await fetchTextbookFile(t.id);
      const url = URL.createObjectURL(blob);
      if (win) {
        win.location.href = url;
      } else {
        // Popup was blocked — fall back to navigating the current tab.
        window.location.href = url;
      }
      // Give the viewer time to load before reclaiming the object URL.
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
      // Defer cleanup: revoking the object URL synchronously can cancel the
      // download before the browser has read the bytes.
      setTimeout(() => {
        anchor.remove();
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to download the PDF.');
    } finally {
      setBusyId(null);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    setError('');
    try {
      await deleteTextbook(deleteTarget.id);
      setItems((current) => current.filter((t) => t.id !== deleteTarget.id));
      setDeleteTarget(null);
      // Close the details popup too if it was showing the deleted book.
      setSelected((current) => (current?.id === deleteTarget.id ? null : current));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete the textbook.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="directory-toolbar">
        <p className="description" style={{ margin: 0 }}>
          {loading
            ? 'Loading textbooks...'
            : `${items.length} textbook${items.length === 1 ? '' : 's'} in the catalog.`}
        </p>
        <div className="search-field">
          <span className="search-icon" aria-hidden>
            🔍
          </span>
          <input
            className="input search-input"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search by textbook name..."
            aria-label="Search textbooks by name"
          />
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {!loading && filtered.length === 0 ? (
        <p className="catalog-empty">
          {items.length === 0
            ? 'No textbooks have been added yet.'
            : 'No textbooks match your search.'}
        </p>
      ) : (
        <div className="book-grid">
          {pageItems.map((t) => (
            // The whole card is the click target; it opens a details popup with
            // the actions, keeping the grid clean and uncluttered.
            <article
              key={t.id}
              className="book-card"
              role="button"
              tabIndex={0}
              onClick={() => setSelected(t)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelected(t);
                }
              }}
              aria-label={`View details for ${t.textbookName}`}
            >
              <div className="book-cover">
                {t.hasCover ? (
                  // Lightweight pre-rendered first-page thumbnail (a small JPEG),
                  // lazy-loaded so a large catalog stays fast and never loads
                  // whole PDFs just to show covers.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    className="book-cover-img"
                    src={`/api/textbook-cover/${t.id}`}
                    alt={`${t.textbookName} cover`}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="book-cover-fallback">{initials(t.textbookName)}</div>
                )}
                <span className="book-cover-spine" aria-hidden />
              </div>

              <div className="book-body">
                <h2 className="book-title" title={t.textbookName}>
                  {t.textbookName}
                </h2>
                <p className="book-subject">{t.subject || 'No subject'}</p>
                <p className="book-meta">
                  {t.hasFile ? formatSize(t.fileSize) || 'PDF' : 'No file attached'}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Only shown once the catalog overflows a full page — no endless scroll. */}
      {totalPages > 1 ? (
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
            Page {page} of {totalPages} ({filtered.length} total)
          </span>
          <button
            className="btn secondary"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      ) : null}

      {selected ? (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setSelected(null)}
        >
          <div
            className="modal modal-wide book-detail"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="book-detail-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              ×
            </button>

            <div className="book-detail-grid">
              <div className="book-detail-cover">
                {selected.hasCover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/textbook-cover/${selected.id}`}
                    alt={`${selected.textbookName} cover`}
                    decoding="async"
                  />
                ) : (
                  <div className="book-cover-fallback">{initials(selected.textbookName)}</div>
                )}
              </div>

              <div className="book-detail-info">
                <h2 className="book-detail-title">{selected.textbookName}</h2>

                <dl className="book-detail-meta">
                  <div>
                    <dt>Subject</dt>
                    <dd>{selected.subject || '—'}</dd>
                  </div>
                  <div>
                    <dt>File</dt>
                    <dd>
                      {selected.hasFile
                        ? formatSize(selected.fileSize) || 'PDF'
                        : 'No file attached'}
                    </dd>
                  </div>
                  <div>
                    <dt>Added</dt>
                    <dd>{new Date(selected.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>

                <div className="book-detail-actions">
                  {selected.hasFile ? (
                    <>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => handleView(selected)}
                        disabled={busyId === selected.id}
                      >
                        {busyId === selected.id ? 'Opening...' : 'View'}
                      </button>
                      <button
                        type="button"
                        className="btn secondary"
                        onClick={() => handleDownload(selected)}
                        disabled={busyId === selected.id}
                      >
                        Download
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => setDeleteTarget(selected)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="modal-overlay modal-overlay-top" role="dialog" aria-modal="true">
          <div className="modal">
            <h2 className="modal-title">Delete textbook</h2>
            <p className="modal-text">
              Are you sure want to delete <strong>{deleteTarget.textbookName}</strong>?
              <br />
              This action cannot be undone.
            </p>
            <div className="modal-actions">
              <button
                className="btn ghost"
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes'}
              </button>
              <button
                className="btn danger"
                type="button"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                No
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
