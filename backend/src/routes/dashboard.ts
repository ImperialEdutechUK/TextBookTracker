import { prisma } from '../lib/db';
import { makeRouter } from '../lib/router';
import { requireAuth } from '../middleware/requireAdmin';

const router = makeRouter();
router.use(requireAuth);

router.get('/', async (_req, res) => {
  const where = { deletedAt: null };

  const [total, grouped, recentRaw] = await Promise.all([
    prisma.textbookRequest.count({ where }),
    prisma.textbookRequest.groupBy({
      by: ['status'],
      _count: { status: true },
      where,
    }),
    prisma.textbookRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      // Only the fields the response below uses — never the multi-MB `fileData`
      // blob, which would otherwise be transferred for every recent request.
      select: { id: true, fullName: true, course: true, status: true, createdAt: true },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of grouped) {
    statusCounts[g.status] = g._count.status;
  }

  return res.json({
    totalRequests: total,
    received: statusCounts['RECEIVED'] ?? 0,
    sentToPrint: statusCounts['SENT_TO_PRINT'] ?? 0,
    printed: statusCounts['PRINTED'] ?? 0,
    recentRequests: recentRaw.map((r) => ({
      requestId: r.id.toString(),
      fullName: r.fullName,
      course: r.course,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
