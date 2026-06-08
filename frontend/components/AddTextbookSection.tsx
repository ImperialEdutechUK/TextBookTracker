'use client';

import { useState } from 'react';
import AddTextbookForm from '@/components/AddTextbookForm';
import TextbookCatalog from '@/components/TextbookCatalog';

export default function AddTextbookSection() {
  // Bumped after each successful upload so the catalog refetches.
  const [reloadKey, setReloadKey] = useState(0);

  return (
    <>
      <AddTextbookForm onAdded={() => setReloadKey((key) => key + 1)} />
      <TextbookCatalog reloadKey={reloadKey} />
    </>
  );
}
