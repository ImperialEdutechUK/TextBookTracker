import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/requireAdmin';

const router = Router();

// Buffer the upload in memory so we can persist the raw bytes to the database
// (the `file_data` BYTEA column). No file ever touches the local disk, so the
// app works the same across multiple instances / ephemeral filesystems.
// No file-size limit is imposed: textbook PDFs can be arbitrarily large.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    // `pdf` must be a PDF; the optional `cover` is a generated JPEG thumbnail.
    if (file.fieldname === 'cover') {
      cb(null, file.mimetype.startsWith('image/'));
      return;
    }
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

// `pdf` is required; `cover` is an optional pre-rendered first-page thumbnail.
const uploadFields = upload.fields([
  { name: 'pdf', maxCount: 1 },
  { name: 'cover', maxCount: 1 },
]);

// Any authenticated user may read the textbook catalog (needed to populate the
// "Textbook Name" dropdown when creating a request).
router.use(requireAuth);

router.get('/', async (_req, res) => {
  // Never select `fileData` here — listing must not pull every PDF's bytes into
  // memory. `originalName`/`fileSize` are always set alongside the bytes, so
  // they're enough to tell whether a file is present.
  const textbooksRaw = await prisma.textbook.findMany({
    orderBy: { textbookName: 'asc' },
    select: {
      id: true,
      textbookName: true,
      subject: true,
      originalName: true,
      fileSize: true,
      mimeType: true,
      coverMimeType: true,
      createdAt: true,
    },
  });

  const textbooks = textbooksRaw.map((t) => ({
    id: t.id.toString(),
    textbookName: t.textbookName,
    subject: t.subject,
    hasFile: Boolean(t.originalName),
    hasCover: Boolean(t.coverMimeType),
    originalName: t.originalName,
    fileSize: t.fileSize ? Number(t.fileSize) : null,
    createdAt: t.createdAt.toISOString(),
  }));

  return res.json({ textbooks });
});

// Create a textbook with an uploaded PDF. Restricted to roles that manage the
// catalog. multer parses the multipart body; `pdf` is the file field.
router.post(
  '/',
  requireRole('ADMIN', 'CREATOR', 'MANAGER'),
  (req, res) => {
    uploadFields(req, res, async (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        return res.status(400).json({ message });
      }

      const textbookName = (req.body?.textbookName ?? '').trim();
      const subject = (req.body?.subject ?? '').trim() || null;
      const files = req.files as Record<string, Express.Multer.File[]> | undefined;
      const file = files?.pdf?.[0];
      const cover = files?.cover?.[0];

      if (!textbookName) {
        return res.status(400).json({ message: 'Textbook name is required.' });
      }
      if (!file) {
        return res.status(400).json({ message: 'A PDF file is required.' });
      }

      try {
        const textbook = await prisma.textbook.create({
          data: {
            textbookName,
            subject,
            // `file.buffer` holds the raw PDF (memory storage); persisted as BYTEA.
            fileData: file.buffer,
            originalName: file.originalname,
            fileSize: BigInt(file.size),
            mimeType: file.mimetype,
            // Optional pre-rendered first-page thumbnail (small JPEG).
            coverImage: cover?.buffer ?? null,
            coverMimeType: cover?.mimetype ?? null,
          },
          select: { id: true, textbookName: true, subject: true, createdAt: true },
        });

        return res.status(201).json({
          textbook: {
            id: textbook.id.toString(),
            textbookName: textbook.textbookName,
            subject: textbook.subject,
            createdAt: textbook.createdAt.toISOString(),
          },
        });
      } catch (err) {
        console.error('Failed to save textbook:', err);
        return res.status(500).json({ message: 'Could not save the textbook.' });
      }
    });
  }
);

// Serve the small cover thumbnail (first page of the PDF). Used by the catalog
// grid so cards load a ~30 KB image instead of the whole PDF.
router.get('/:id/cover', async (req, res) => {
  let id: bigint;
  try {
    id = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ message: 'Invalid textbook id.' });
  }

  const textbook = await prisma.textbook.findUnique({
    where: { id },
    select: { coverImage: true, coverMimeType: true },
  });

  if (!textbook?.coverImage) {
    return res.status(404).json({ message: 'No cover found for this textbook.' });
  }

  const body = Buffer.from(textbook.coverImage);
  res.setHeader('Content-Type', textbook.coverMimeType ?? 'image/jpeg');
  res.setHeader('Content-Length', String(body.length));
  // Covers are immutable for a given textbook id, so let the browser cache them.
  res.setHeader('Cache-Control', 'private, max-age=86400');
  return res.send(body);
});

// Stream the stored PDF for download/inline viewing.
router.get('/:id/file', async (req, res) => {
  let id: bigint;
  try {
    id = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ message: 'Invalid textbook id.' });
  }

  const textbook = await prisma.textbook.findUnique({
    where: { id },
    select: { fileData: true, originalName: true, mimeType: true },
  });

  if (!textbook?.fileData) {
    return res.status(404).json({ message: 'No file found for this textbook.' });
  }

  // Prisma returns BYTEA as a Node Buffer; send it straight back.
  const body = Buffer.from(textbook.fileData);

  // `?download=1` forces a save dialog; otherwise the PDF opens inline in the
  // browser's viewer so the whole book can be read in-app.
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', textbook.mimeType ?? 'application/pdf');
  res.setHeader('Content-Length', String(body.length));
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(textbook.originalName ?? 'textbook.pdf')}"`
  );
  return res.send(body);
});

// Delete a textbook from the catalog. Restricted to the roles that manage it.
router.delete('/:id', requireRole('ADMIN', 'CREATOR', 'MANAGER'), async (req, res) => {
  let id: bigint;
  try {
    id = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ message: 'Invalid textbook id.' });
  }

  try {
    await prisma.textbook.delete({ where: { id } });
    return res.status(204).send();
  } catch (err) {
    // P2025: row not found. P2003: still referenced by a textbook request.
    const code = (err as { code?: string })?.code;
    if (code === 'P2025') {
      return res.status(404).json({ message: 'Textbook not found.' });
    }
    if (code === 'P2003') {
      return res.status(409).json({
        message: 'This textbook is linked to one or more requests and cannot be deleted.',
      });
    }
    console.error('Failed to delete textbook:', err);
    return res.status(500).json({ message: 'Could not delete the textbook.' });
  }
});

export default router;
