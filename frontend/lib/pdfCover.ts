// Renders the first page of a PDF File to a small JPEG Blob entirely in the
// browser (via pdf.js). Done once at upload time so the catalog grid can show a
// lightweight ~20-40 KB cover image per card instead of loading the whole PDF
// into an iframe — which is what made the page slow and crash-prone at scale.
//
// Best-effort: if anything fails (unsupported PDF, no canvas, etc.) it returns
// null and the upload proceeds without a cover, falling back to a placeholder.
export async function generatePdfCover(
  pdf: File,
  maxWidth = 520
): Promise<Blob | null> {
  try {
    const pdfjs = await import('pdfjs-dist');
    // Self-hosted worker copied into public/ by scripts/copy-pdf-worker.js, so
    // its version always matches the installed pdfjs-dist. (Bundling it via
    // `new URL(..., import.meta.url)` breaks the production build — webpack tries
    // to minify the ESM worker as a plain script.)
    pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

    const data = await pdf.arrayBuffer();
    const doc = await pdfjs.getDocument({ data }).promise;
    const page = await doc.getPage(1);

    const base = page.getViewport({ scale: 1 });
    // Cap the scale so huge pages don't produce oversized canvases.
    const scale = Math.min(2, maxWidth / base.width);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      doc.destroy();
      return null;
    }
    // White backdrop so PDFs with transparent backgrounds don't render black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    doc.destroy();

    return await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.82)
    );
  } catch {
    return null;
  }
}
