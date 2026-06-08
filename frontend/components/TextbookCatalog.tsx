'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  CatalogTextbook,
  fetchTextbooks,
  fetchTextbookFile,
} from '@/lib/textbooks';

function formatSize(bytes: number | null) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TextbookCatalog({ reloadKey = 0 }: { reloadKey?: number }) {
  const [items, setItems] = useState<CatalogTextbook[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Id of the row whose file is currently being fetched (disables its buttons).
  const [busyId, setBusyId] = useState<string | null>(null);

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
  }, [reloadKey]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((t) => t.textbookName.toLowerCase().includes(term));
  }, [items, search]);

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

  return (
    <section className="catalog">
      <div className="catalog-head">
        <h2 className="catalog-title">Added Textbooks</h2>
        <div className="filter-search">
          <input
            className="input"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by textbook name..."
            aria-label="Search textbooks by name"
          />
        </div>
      </div>

      {error ? <div className="alert">{error}</div> : null}

      {loading ? (
        <p>Loading textbooks...</p>
      ) : filtered.length === 0 ? (
        <p className="catalog-empty">
          {items.length === 0
            ? 'No textbooks have been added yet.'
            : 'No textbooks match your search.'}
        </p>
      ) : (
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Textbook Name</th>
                <th>Subject</th>
                <th>File</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t.id}>
                  <td>{t.textbookName}</td>
                  <td>{t.subject || '—'}</td>
                  <td>{t.hasFile ? formatSize(t.fileSize) || 'PDF' : 'No file'}</td>
                  <td>
                    <div className="row-actions">
                      {t.hasFile ? (
                        <>
                          <button
                            type="button"
                            className="btn"
                            onClick={() => handleView(t)}
                            disabled={busyId === t.id}
                          >
                            {busyId === t.id ? 'Opening...' : 'View'}
                          </button>
                          <button
                            type="button"
                            className="btn secondary"
                            onClick={() => handleDownload(t)}
                            disabled={busyId === t.id}
                          >
                            Download
                          </button>
                        </>
                      ) : (
                        <span className="catalog-muted">No PDF</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
