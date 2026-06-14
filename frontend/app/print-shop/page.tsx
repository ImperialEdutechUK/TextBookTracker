'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PrintShopBook, fetchPrintShopBooks } from '@/lib/textbooks';

export default function PrintShopPage() {
  const router = useRouter();
  const [books, setBooks] = useState<PrintShopBook[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiThenLoad();

    async function apiThenLoad() {
      try {
        const data = await fetchPrintShopBooks();
        if (!active) return;
        setBooks(data);
        setError('');
      } catch (err) {
        if (!active) return;
        // Treat an auth failure as a redirect to login, like the other pages.
        if (err instanceof Error && /unauthor/i.test(err.message)) {
          router.replace('/login');
          return;
        }
        setError(err instanceof Error ? err.message : 'Unable to load print shop books.');
      } finally {
        if (active) setLoading(false);
      }
    }

    return () => { active = false; };
  }, [router]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return books;
    return books.filter((b) => b.textbookName.toLowerCase().includes(term));
  }, [books, search]);

  return (
    <main className="main-shell">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h1 className="page-title">Books Available in Print Shop</h1>
          <p className="description">
            Books that have already been printed and are in the print shop. Check
            here before sending a book for printing to avoid printing the same
            book again.
          </p>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: '0.75rem' }}>
          <input
            className="input"
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by book name..."
            aria-label="Search printed books by name"
            style={{ marginTop: 0, maxWidth: '420px' }}
          />
        </div>

        {error ? <div className="alert">{error}</div> : null}

        {loading ? (
          <p className="description" style={{ padding: '1rem 0' }}>Loading...</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Book Name</th>
                  <th>Author</th>
                  <th>Subject</th>
                  <th>Times Printed</th>
                  <th>Last Printed</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', color: '#6b7280', padding: '2rem' }}>
                    {books.length === 0 ? 'No books have been printed yet.' : 'No printed books match your search.'}
                  </td></tr>
                )}
                {filtered.map((b) => (
                  <tr key={b.textbookId}>
                    <td style={{ fontWeight: 500 }}>{b.textbookName}</td>
                    <td style={{ color: '#6b7280' }}>{b.author || '—'}</td>
                    <td style={{ color: '#6b7280' }}>{b.subject || '—'}</td>
                    <td style={{ color: '#6b7280' }}>{b.printedCount}</td>
                    <td style={{ color: '#6b7280' }}>
                      {new Date(b.printedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
