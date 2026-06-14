import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/requireAdmin';

const router = Router();

// Legacy on-disk location. New uploads are stored in the database (see below),
// but we still read from here as a fallback so files uploaded before this change
// (and local-dev files) keep working.
const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'textbooks');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Keep the bytes in memory so we can persist them to the database. Hosts like
// Railway have an ephemeral filesystem, so anything written to local disk is
// lost on the next redeploy/restart — the DB is the only durable store.
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed.'));
    }
  },
});

router.use(requireAuth);

router.get('/', async (_req, res) => {
  const textbooksRaw = await prisma.textbook.findMany({
    orderBy: { textbookName: 'asc' },
    select: {
      id: true,
      textbookName: true,
      author: true,
      subject: true,
      fileName: true,
      originalName: true,
      fileSize: true,
      mimeType: true,
      createdAt: true,
    },
  });

  const textbooks = textbooksRaw.map((t) => ({
    id: t.id.toString(),
    textbookName: t.textbookName,
    author: t.author,
    subject: t.subject,
    hasFile: Boolean(t.fileName),
    originalName: t.originalName,
    fileSize: t.fileSize ? Number(t.fileSize) : null,
    createdAt: t.createdAt.toISOString(),
  }));

  return res.json({ textbooks });
});

router.post(
  '/',
  requireRole('ADMIN', 'CREATOR', 'MANAGER'),
  (req, res) => {
    upload.single('pdf')(req, res, async (err: unknown) => {
      if (err) {
        const message = err instanceof Error ? err.message : 'Upload failed.';
        return res.status(400).json({ message });
      }

      const textbookName = (req.body?.textbookName ?? '').trim();
      const author = (req.body?.author ?? '').trim() || null;
      const subject = (req.body?.subject ?? '').trim() || null;
      const file = req.file;

      if (!textbookName) {
        return res.status(400).json({ message: 'Textbook name is required.' });
      }
      if (!file) {
        return res.status(400).json({ message: 'A PDF file is required.' });
      }

      try {
        // fileName is kept as a lightweight "has a file" flag/identifier; the
        // actual bytes live in fileData so they persist across redeploys.
        const fileName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
        const textbook = await prisma.textbook.create({
          data: {
            textbookName,
            author,
            subject,
            fileName,
            originalName: file.originalname,
            fileSize: BigInt(file.size),
            mimeType: file.mimetype,
            fileData: file.buffer,
          },
          select: { id: true, textbookName: true, author: true, subject: true, createdAt: true },
        });

        return res.status(201).json({
          textbook: {
            id: textbook.id.toString(),
            textbookName: textbook.textbookName,
            author: textbook.author,
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

router.get('/:id/file', async (req, res) => {
  let id: bigint;
  try {
    id = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ message: 'Invalid textbook id.' });
  }

  const textbook = await prisma.textbook.findUnique({
    where: { id },
    select: { fileName: true, originalName: true, mimeType: true, fileData: true },
  });

  if (!textbook || (!textbook.fileData && !textbook.fileName)) {
    return res.status(404).json({ message: 'No file found for this textbook.' });
  }

  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', textbook.mimeType ?? 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(textbook.originalName ?? 'textbook.pdf')}"`
  );

  // Preferred path: bytes stored in the database (durable across redeploys).
  if (textbook.fileData) {
    const buffer = Buffer.from(textbook.fileData);
    res.setHeader('Content-Length', String(buffer.length));
    return res.end(buffer);
  }

  // Fallback for legacy/local uploads still on disk.
  const filePath = path.join(UPLOAD_DIR, textbook.fileName as string);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File is missing from storage.' });
  }
  return res.sendFile(filePath);
});

export default router;

router.delete('/:id', requireRole('ADMIN', 'CREATOR', 'MANAGER'), async (req, res) => {
  let id: bigint;
  try {
    id = BigInt(req.params.id);
  } catch {
    return res.status(400).json({ message: 'Invalid textbook id.' });
  }

  const textbook = await prisma.textbook.findUnique({
    where: { id },
    select: { fileName: true },
  });

  if (!textbook) {
    return res.status(404).json({ message: 'Textbook not found.' });
  }

  if (textbook.fileName) {
    const filePath = path.join(UPLOAD_DIR, textbook.fileName);
    fs.promises.unlink(filePath).catch(() => {});
  }

  await prisma.textbook.delete({ where: { id } });
  return res.json({ message: 'Textbook deleted successfully.' });
});
