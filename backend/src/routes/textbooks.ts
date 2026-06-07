import { Router } from 'express';
import { prisma } from '../lib/db';
import { requireAuth } from '../middleware/requireAdmin';

const router = Router();

// Any authenticated user may read the textbook catalog (needed to populate the
// "Textbook Name" dropdown when creating a request).
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const textbooksRaw = await prisma.textbook.findMany({
    orderBy: { textbookName: 'asc' },
    select: { id: true, textbookName: true, subject: true, createdAt: true },
  });

  const textbooks = textbooksRaw.map((t) => ({
    id: t.id.toString(),
    textbookName: t.textbookName,
    subject: t.subject,
    createdAt: t.createdAt.toISOString(),
  }));

  return res.json({ textbooks });
});

export default router;
