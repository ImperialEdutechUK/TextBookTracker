import TextbookRequestForm from '@/components/TextbookRequestForm';

export default function NewTextbookRequestPage() {
  return (
    <main className="main-shell">
      <div className="card">
        <div className="header">
          <div>
            <h1 className="page-title">Create Textbook Request</h1>
            <p className="description">
              Assign a learner and textbook, then save to create the request.
            </p>
          </div>
        </div>
        <TextbookRequestForm mode="create" />
      </div>
    </main>
  );
}
