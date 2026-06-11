import { Router } from 'express';
import { Prisma, TextbookStatus } from '@prisma/client';
import { prisma } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/requireAdmin';
import { SessionPayload } from '../lib/auth';

const router = Router();
router.use(requireAuth);

const VALID_STATUSES = Object.values(TextbookStatus);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

const requestInclude = {
  learner: { select: { id: true, fullName: true } },
  creator: { select: { id: true, fullName: true } },
  textbook: { select: { id: true, textbookName: true } },
} satisfies Prisma.TextbookRequestInclude;

type RequestWithRelations = Prisma.TextbookRequestGetPayload<{
  include: typeof requestInclude;
}>;

function serializeRequest(r: RequestWithRelations) {
  return {
    requestId: r.id.toString(),
    learner: { id: r.learnerId.toString(), fullName: r.learner.fullName },
    textbook: { id: r.textbookId.toString(), name: r.textbook.textbookName },
    creator: { id: r.creatorId.toString(), fullName: r.creator.fullName },
    currentStatus: r.currentStatus,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function accessFilter(session: SessionPayload): Prisma.TextbookRequestWhereInput {
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

function parseId(value: unknown): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  try {
    return BigInt(str);
  } catch {
    return null;
  }
}

router.get('/options', async (_req, res) => {
  const [learnersRaw, textbooksRaw] = await Promise.all([
    prisma.user.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { fullName: 'asc' },
      select: { id: true, fullName: true },
    }),
    prisma.textbook.findMany({
      orderBy: { textbookName: 'asc' },
      select: { id: true, textbookName: true },
    }),
  ]);
  return res.json({
    learners: learnersRaw.map((u) => ({ id: u.id.toString(), fullName: u.fullName })),
    textbooks: textbooksRaw.map((t) => ({ id: t.id.toString(), name: t.textbookName })),
    statuses: VALID_STATUSES,
  });
});

router.get('/', async (req, res) => {
  const session = req.session!;
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE));
  const filters: Prisma.TextbookRequestWhereInput[] = [{ deletedAt: null }, accessFilter(session)];

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    filters.push({
      OR: [
        { learner: { fullName: { contains: search, mode: 'insensitive' } } },
        { textbook: { textbookName: { contains: search, mode: 'insensitive' } } },
        { textbook: { subject: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }

  const status = req.query.status;
  if (typeof status === 'string' && status) {
    if (!VALID_STATUSES.includes(status as TextbookStatus)) {
      return res.status(400).json({ message: 'Invalid status filter.' });
    }
    filters.push({ currentStatus: status as TextbookStatus });
  }

  const learnerId = req.query.learnerId ? parseId(req.query.learnerId) : null;
  if (learnerId) filters.push({ learnerId });

  const creatorId = req.query.creatorId ? parseId(req.query.creatorId) : null;
  if (creatorId) filters.push({ creatorId });

  const createdAt: Prisma.DateTimeFilter = {};
  if (typeof req.query.dateFrom === 'string' && req.query.dateFrom) {
    const from = new Date(req.query.dateFrom);
    if (!Number.isNaN(from.getTime())) createdAt.gte = from;
  }
  if (typeof req.query.dateTo === 'string' && req.query.dateTo) {
    const to = new Date(req.query.dateTo);
    if (!Number.isNaN(to.getTime())) createdAt.lte = to;
  }
  if (Object.keys(createdAt).length > 0) filters.push({ createdAt });

  const where: Prisma.TextbookRequestWhereInput = { AND: filters };
  const [rows, total] = await prisma.$transaction([
    prisma.textbookRequest.findMany({
      where,
      include: requestInclude,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.textbookRequest.count({ where }),
  ]);

  return res.json({
    requests: rows.map(serializeRequest),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

router.get('/export/csv', async (req, res) => {
  const session = req.session!;
  const filters: Prisma.TextbookRequestWhereInput[] = [{ deletedAt: null }, accessFilter(session)];

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    filters.push({
      OR: [
        { learner: { fullName: { contains: search, mode: 'insensitive' } } },
        { textbook: { textbookName: { contains: search, mode: 'insensitive' } } },
        { textbook: { subject: { contains: search, mode: 'insensitive' } } },
      ],
    });
  }
  const status = req.query.status;
  if (typeof status === 'string' && status && VALID_STATUSES.includes(status as TextbookStatus)) {
    filters.push({ currentStatus: status as TextbookStatus });
  }
  const learnerId = req.query.learnerId ? parseId(req.query.learnerId) : null;
  if (learnerId) filters.push({ learnerId });
  const createdAt: Prisma.DateTimeFilter = {};
  if (typeof req.query.dateFrom === 'string' && req.query.dateFrom) {
    const from = new Date(req.query.dateFrom);
    if (!Number.isNaN(from.getTime())) createdAt.gte = from;
  }
  if (typeof req.query.dateTo === 'string' && req.query.dateTo) {
    const to = new Date(req.query.dateTo);
    if (!Number.isNaN(to.getTime())) createdAt.lte = to;
  }
  if (Object.keys(createdAt).length > 0) filters.push({ createdAt });

  const rows = await prisma.textbookRequest.findMany({
    where: { AND: filters },
    orderBy: { createdAt: 'desc' },
    take: 5000,
    include: {
      learner: { select: { fullName: true } },
      creator: { select: { fullName: true } },
      textbook: { select: { textbookName: true, author: true, subject: true } },
    },
  });

  const esc = (v: string | null | undefined) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const header = ['Request ID', 'Textbook', 'Author', 'Subject', 'Learner', 'Creator', 'Status', 'Created At', 'Updated At'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.id.toString()),
      esc(r.textbook.textbookName),
      esc(r.textbook.author),
      esc(r.textbook.subject),
      esc(r.learner.fullName),
      esc(r.creator.fullName),
      esc(r.currentStatus),
      esc(r.createdAt.toISOString()),
      esc(r.updatedAt.toISOString()),
    ].join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="textbook-requests.csv"');
  return res.send(lines.join('\n'));
});

router.get('/:id', async (req, res) => {
  const session = req.session!;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const request = await prisma.textbookRequest.findFirst({
    where: { AND: [{ id }, { deletedAt: null }, accessFilter(session)] },
    include: {
      ...requestInclude,
      statusHistory: {
        orderBy: { changedAt: 'asc' },
        include: { changedByUser: { select: { fullName: true } } },
      },
    },
  });
  if (!request) return res.status(404).json({ message: 'Textbook request not found.' });

  return res.json({
    request: {
      ...serializeRequest(request),
      statusHistory: request.statusHistory.map((h) => ({
        status: h.status,
        changedAt: h.changedAt.toISOString(),
        changedBy: h.changedByUser.fullName,
      })),
    },
  });
});

router.post('/', requireRole('CREATOR', 'ADMIN'), async (req, res) => {
  const session = req.session!;
  const { learnerId: rawLearnerId, textbookId: rawTextbookId } = req.body ?? {};

  const learnerId = parseId(rawLearnerId);
  if (!learnerId) return res.status(400).json({ message: 'A valid learner must be selected.' });

  const textbookId = parseId(rawTextbookId);
  if (!textbookId) return res.status(400).json({ message: 'A valid textbook must be selected.' });

  const [learner, textbook] = await Promise.all([
    prisma.user.findUnique({ where: { id: learnerId }, select: { status: true } }),
    prisma.textbook.findUnique({ where: { id: textbookId }, select: { id: true } }),
  ]);

  if (!learner || learner.status !== 'ACTIVE') {
    return res.status(400).json({ message: 'Selected learner is not a valid active user.' });
  }
  if (!textbook) return res.status(400).json({ message: 'Selected textbook does not exist.' });

  const creatorId = BigInt(session.userId);
  const created = await prisma.textbookRequest.create({
    data: {
      learnerId,
      textbookId,
      creatorId,
      currentStatus: 'CREATED',
      statusHistory: { create: { status: 'CREATED', changedBy: creatorId } },
    },
    select: { id: true },
  });

  return res.status(201).json({ requestId: created.id.toString(), message: 'Textbook request created successfully' });
});

router.put('/:id', requireRole('CREATOR', 'ADMIN'), async (req, res) => {
  const session = req.session!;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { creatorId: true },
  });
  if (!existing) return res.status(404).json({ message: 'Textbook request not found.' });

  if (session.role !== 'ADMIN' && existing.creatorId !== BigInt(session.userId)) {
    return res.status(403).json({ message: 'You can only edit requests you created.' });
  }

  const { learnerId: rawLearnerId, textbookId: rawTextbookId } = req.body ?? {};
  const data: Prisma.TextbookRequestUpdateInput = {};

  if (rawLearnerId !== undefined) {
    const learnerId = parseId(rawLearnerId);
    if (!learnerId) return res.status(400).json({ message: 'A valid learner must be selected.' });
    const learner = await prisma.user.findUnique({ where: { id: learnerId }, select: { status: true } });
    if (!learner || learner.status !== 'ACTIVE') {
      return res.status(400).json({ message: 'Selected learner is not a valid active user.' });
    }
    data.learner = { connect: { id: learnerId } };
  }

  if (rawTextbookId !== undefined) {
    const textbookId = parseId(rawTextbookId);
    if (!textbookId) return res.status(400).json({ message: 'A valid textbook must be selected.' });
    const textbook = await prisma.textbook.findUnique({ where: { id: textbookId }, select: { id: true } });
    if (!textbook) return res.status(400).json({ message: 'Selected textbook does not exist.' });
    data.textbook = { connect: { id: textbookId } };
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No valid update fields were provided.' });
  }

  await prisma.textbookRequest.update({ where: { id }, data });
  return res.json({ message: 'Textbook request updated successfully.' });
});

router.delete('/:id', requireRole('ADMIN'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ message: 'Textbook request not found.' });

  await prisma.textbookRequest.update({ where: { id }, data: { deletedAt: new Date() } });
  return res.json({ message: 'Textbook request deleted successfully.' });
});

// Allowed moves in BOTH directions. Forward = normal workflow; backward =
// revert one step (logged in history like any other change).
const TRANSITIONS: Array<{ from: TextbookStatus; to: TextbookStatus; roles: string[] }> = [
  { from: 'CREATED',              to: 'REQUESTED_BY_LEARNER', roles: ['CREATOR', 'ADMIN'] },
  { from: 'REQUESTED_BY_LEARNER', to: 'SHARED_WITH_MANAGER',  roles: ['MANAGER', 'ADMIN'] },
  { from: 'SHARED_WITH_MANAGER',  to: 'SENT_TO_PRINT',        roles: ['MANAGER', 'ADMIN'] },
  { from: 'SENT_TO_PRINT',        to: 'PRINTED',              roles: ['MANAGER', 'ADMIN'] },
  { from: 'REQUESTED_BY_LEARNER', to: 'CREATED',              roles: ['CREATOR', 'ADMIN'] },
  { from: 'SHARED_WITH_MANAGER',  to: 'REQUESTED_BY_LEARNER', roles: ['MANAGER', 'ADMIN'] },
  { from: 'SENT_TO_PRINT',        to: 'SHARED_WITH_MANAGER',  roles: ['MANAGER', 'ADMIN'] },
  { from: 'PRINTED',              to: 'SENT_TO_PRINT',        roles: ['ADMIN'] },
];

router.patch('/:id/status', async (req, res) => {
  const session = req.session!;
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const { status: newStatus } = req.body ?? {};
  if (!newStatus || !VALID_STATUSES.includes(newStatus as TextbookStatus)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { currentStatus: true },
  });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });

  const rule = TRANSITIONS.find(
    (t) => t.from === existing.currentStatus && t.to === (newStatus as TextbookStatus)
  );
  if (!rule) {
    return res.status(400).json({ message: 'Invalid status transition.' });
  }
  if (!rule.roles.includes(session.role)) {
    return res.status(403).json({ message: 'Your role cannot perform this transition.' });
  }

  const changedBy = BigInt(session.userId);
  await prisma.$transaction([
    prisma.textbookRequest.update({ where: { id }, data: { currentStatus: newStatus as TextbookStatus } }),
    prisma.textbookStatusHistory.create({ data: { requestId: id, status: newStatus as TextbookStatus, changedBy } }),
  ]);

  return res.json({ message: 'Status updated successfully.' });
});

export default router;
