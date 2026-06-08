import AddTextbookSection from '@/components/AddTextbookSection';

export default function AddTextbookPage() {
  return (
    <main className="main-shell">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Add Textbook</h1>
            <p className="description">
              Add a textbook to the catalog by entering its name and uploading the
              PDF.
            </p>
          </div>
        </div>
        <AddTextbookSection />
      </div>
    </main>
  );
}
