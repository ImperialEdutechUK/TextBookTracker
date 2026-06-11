import Link from 'next/link';
import AddedTextbooksGrid from '@/components/AddedTextbooksGrid';

export default function AddedTextbooksPage() {
  return (
    <main className="main-shell main-shell-wide">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Added Textbooks</h1>
            <p className="description">
              Browse every textbook in the catalog. Each card shows the front
              cover of the uploaded PDF.
            </p>
          </div>
          <Link href="/textbooks/add" className="btn secondary">
            Add Textbook
          </Link>
        </div>
        <AddedTextbooksGrid />
      </div>
    </main>
  );
}
