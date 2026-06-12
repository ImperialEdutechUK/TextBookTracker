import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { prisma } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/requireAdmin';

const router = Router();

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads', 'textbooks');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const unique = crypto.randomBytes(16).toString('hex');
    cb(null, `${unique}${path.extname(file.originalname).toLowerCase()}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
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
        const message =
          err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE'
            ? 'The PDF is too large (max 25 MB).'
            : err instanceof Error
            ? err.message
            : 'Upload failed.';
        return res.status(400).json({ message });
      }

      const textbookName = (req.body?.textbookName ?? '').trim();
      const author = (req.body?.author ?? '').trim() || null;
      const subject = (req.body?.subject ?? '').trim() || null;
      const file = req.file;

      const fail = (status: number, message: string) => {
        if (file) fs.promises.unlink(file.path).catch(() => {});
        return res.status(status).json({ message });
      };

      if (!textbookName) {
        return fail(400, 'Textbook name is required.');
      }
      if (!file) {
        return res.status(400).json({ message: 'A PDF file is required.' });
      }

      try {
        const textbook = await prisma.textbook.create({
          data: {
            textbookName,
            author,
            subject,
            fileName: file.filename,
            originalName: file.originalname,
            fileSize: BigInt(file.size),
            mimeType: file.mimetype,
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
        return fail(500, 'Could not save the textbook.');
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
    select: { fileName: true, originalName: true, mimeType: true },
  });

  if (!textbook?.fileName) {
    return res.status(404).json({ message: 'No file found for this textbook.' });
  }

  const filePath = path.join(UPLOAD_DIR, textbook.fileName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ message: 'File is missing from storage.' });
  }

  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', textbook.mimeType ?? 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(textbook.originalName ?? 'textbook.pdf')}"`
  );
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
