import { Router } from 'express';
import { prisma } from '../lib/db';
import { requireAuth } from '../middleware/requireAdmin';

const router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  const session = req.session!;
  const base = { deletedAt: null as Date | null };
  const where =
    session.role === 'ADMIN' || session.role === 'MANAGER'
      ? base
      : session.role === 'CREATOR'
      ? { ...base, creatorId: BigInt(session.userId) }
      : { ...base, learnerId: BigInt(session.userId) };

  const [totalTextbooks, totalRequests, grouped, totalUsers, recentRaw] = await Promise.all([
    prisma.textbook.count(),
    prisma.textbookRequest.count({ where }),
    prisma.textbookRequest.groupBy({
      by: ['currentStatus'],
      _count: { currentStatus: true },
      where,
    }),
    session.role === 'ADMIN' ? prisma.user.count() : Promise.resolve(null),
    prisma.textbookRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        textbook: { select: { textbookName: true } },
        learner: { select: { fullName: true } },
      },
    }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const g of grouped) {
    statusCounts[g.currentStatus] = g._count.currentStatus;
  }

  return res.json({
    totalTextbooks,
    totalRequests,
    statusCounts,
    totalUsers,
    recentRequests: recentRaw.map((r) => ({
      requestId: r.id.toString(),
      textbookName: r.textbook.textbookName,
      learnerName: r.learner.fullName,
      currentStatus: r.currentStatus,
      createdAt: r.createdAt.toISOString(),
    })),
  });
});

export default router;
