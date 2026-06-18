import { Suspense } from 'react';
import RequestsPageInner from './RequestsPageInner';

export default function RequestsPage() {
  return (
    <Suspense fallback={<main className="main-shell"><p className="description">Loading...</p></main>}>
      <RequestsPageInner />
    </Suspense>
  );
}
