import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/requireAdmin';

const router = Router();

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

// Buffer the upload in memory so we can persist the raw bytes to the database
// (the `file_data` BYTEA column). No file ever touches the local disk, so the
// app works the same across multiple instances / ephemeral filesystems.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

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
      createdAt: true,
    },
  });

  const textbooks = textbooksRaw.map((t) => ({
    id: t.id.toString(),
    textbookName: t.textbookName,
    subject: t.subject,
    hasFile: Boolean(t.originalName),
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
    upload.single('pdf')(req, res, async (err: unknown) => {
      if (err) {
        const message =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'The PDF is too large (max 25 MB).'
            : err instanceof Error
            ? err.message
            : 'Upload failed.';
        return res.status(400).json({ message });
      }

      const textbookName = (req.body?.textbookName ?? '').trim();
      const subject = (req.body?.subject ?? '').trim() || null;
      const file = req.file;

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
      } catch {
        return res.status(500).json({ message: 'Could not save the textbook.' });
      }
    });
  }
);

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

export default router;
