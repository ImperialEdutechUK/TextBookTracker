import TextbookRequestDetails from '@/components/TextbookRequestDetails';

export default function TextbookRequestDetailPage({ params }: { params: { id: string } }) {
  return (
    <main className="main-shell">
      <TextbookRequestDetails requestId={params.id} />
    </main>
  );
}
