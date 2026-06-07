import TextbookRequestForm from '@/components/TextbookRequestForm';

export default function EditTextbookRequestPage({ params }: { params: { id: string } }) {
  return (
    <main className="main-shell">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Edit Textbook Request</h1>
            <p className="description">Update the request details and save your changes.</p>
          </div>
        </div>
        <TextbookRequestForm mode="edit" requestId={params.id} />
      </div>
    </main>
  );
}
