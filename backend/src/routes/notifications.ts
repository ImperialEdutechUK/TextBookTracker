import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/db';
import { requireAuth } from '../middleware/requireAdmin';
import { SessionPayload } from '../lib/auth';

const router = Router();
router.use(requireAuth);

function requestAccess(session: SessionPayload): Prisma.TextbookRequestWhereInput {
  switch (session.role) {
    case 'ADMIN':
    case 'MANAGER':
      return {};
    case 'CREATOR':
      return { creatorId: BigInt(session.userId) };
    default:
      return { learnerId: BigInt(session.userId) };
  }
}

router.get('/', async (req, res) => {
  const session = req.session!;
  const userId = BigInt(session.userId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationsSeenAt: true },
  });
  const seenAt = user?.notificationsSeenAt ?? null;

  const where: Prisma.TextbookStatusHistoryWhereInput = {
    request: { deletedAt: null, ...requestAccess(session) },
  };

  const [items, unseenCount] = await Promise.all([
    prisma.textbookStatusHistory.findMany({
      where,
      orderBy: { changedAt: 'desc' },
      take: 10,
      include: {
        request: {
          select: {
            id: true,
            textbook: { select: { textbookName: true } },
            learner: { select: { fullName: true } },
          },
        },
        changedByUser: { select: { fullName: true } },
      },
    }),
    prisma.textbookStatusHistory.count({
      where: seenAt ? { AND: [where, { changedAt: { gt: seenAt } }] } : where,
    }),
  ]);

  return res.json({
    unseenCount,
    notifications: items.map((h) => ({
      id: h.id.toString(),
      requestId: h.request.id.toString(),
      textbookName: h.request.textbook.textbookName,
      learnerName: h.request.learner.fullName,
      status: h.status,
      changedBy: h.changedByUser.fullName,
      changedAt: h.changedAt.toISOString(),
    })),
  });
});

router.post('/seen', async (req, res) => {
  const session = req.session!;
  await prisma.user.update({
    where: { id: BigInt(session.userId) },
    data: { notificationsSeenAt: new Date() },
  });
  return res.json({ message: 'Notifications marked as seen.' });
});

export default router;
