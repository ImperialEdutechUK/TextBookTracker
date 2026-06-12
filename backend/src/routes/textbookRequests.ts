import { Router } from 'express';
import { Prisma, TextbookStatus } from '@prisma/client';
import { prisma } from '../lib/db';
import { requireAuth, requireRole } from '../middleware/requireAdmin';
import { SessionPayload } from '../lib/auth';

const router = Router();

// Every endpoint in this module requires a valid session.
router.use(requireAuth);

const VALID_STATUSES = Object.values(TextbookStatus);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// Shape returned for list/detail rows so the related records are joined once.
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

// Restricts which requests a session may see, mirroring the permission matrix:
// ADMIN/MANAGER/CREATOR see every ongoing request, while VIEWER (learner) sees
// only requests assigned to them. Returned as a filter that is always AND-ed
// into queries so it cannot be bypassed by client-supplied filters.
function accessFilter(session: SessionPayload): Prisma.TextbookRequestWhereInput {
  switch (session.role) {
    case 'ADMIN':
    case 'MANAGER':
    case 'CREATOR':
      return {};
    default:
      // VIEWER / Learner
      return { learnerId: BigInt(session.userId) };
  }
}

// Safely parse a value that should be a positive BigInt id; null if invalid.
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

// ---------------------------------------------------------------------------
// GET /api/textbook-requests/options
// Lookup data for the create/edit form and list filters (learners + catalog).
// Defined before "/:id" so it is not captured by the id route.
// ---------------------------------------------------------------------------
router.get('/options', async (_req, res) => {
  const [learnersRaw, textbooksRaw] = await Promise.all([
    prisma.user.findMany({
      // Learners are the VIEWER role only — other roles are not selectable.
      where: { status: 'ACTIVE', role: 'VIEWER' },
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

// ---------------------------------------------------------------------------
// GET /api/textbook-requests
// Paginated, searchable, filterable list scoped to the caller's permissions.
// ---------------------------------------------------------------------------
router.get('/', async (req, res) => {
  const session = req.session!;

  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE)
  );

  const filters: Prisma.TextbookRequestWhereInput[] = [
    { deletedAt: null },
    accessFilter(session),
  ];

  const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  if (search) {
    filters.push({
      OR: [
        { learner: { fullName: { contains: search, mode: 'insensitive' } } },
        { textbook: { textbookName: { contains: search, mode: 'insensitive' } } },
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
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/textbook-requests/:id
// Full detail including status history, scoped to the caller's permissions.
// ---------------------------------------------------------------------------
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

  if (!request) {
    return res.status(404).json({ message: 'Textbook request not found.' });
  }

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

// ---------------------------------------------------------------------------
// POST /api/textbook-requests
// Create a request. Only CREATOR and ADMIN may create. The creator is always
// taken from the session, never the request body.
// ---------------------------------------------------------------------------
router.post('/', requireRole('CREATOR', 'ADMIN'), async (req, res) => {
  const session = req.session!;
  const { learnerId: rawLearnerId, textbookId: rawTextbookId } = req.body ?? {};

  const learnerId = parseId(rawLearnerId);
  if (!learnerId) {
    return res.status(400).json({ message: 'A valid learner must be selected.' });
  }

  const textbookId = parseId(rawTextbookId);
  if (!textbookId) {
    return res.status(400).json({ message: 'A valid textbook must be selected.' });
  }

  const [learner, textbook] = await Promise.all([
    prisma.user.findUnique({ where: { id: learnerId }, select: { status: true, role: true } }),
    prisma.textbook.findUnique({ where: { id: textbookId }, select: { id: true } }),
  ]);

  if (!learner || learner.status !== 'ACTIVE' || learner.role !== 'VIEWER') {
    return res.status(400).json({ message: 'Selected learner is not a valid active learner.' });
  }
  if (!textbook) {
    return res.status(400).json({ message: 'Selected textbook does not exist.' });
  }

  const creatorId = BigInt(session.userId);

  // Create the request together with its initial CREATED history entry.
  const created = await prisma.textbookRequest.create({
    data: {
      learnerId,
      textbookId,
      creatorId,
      currentStatus: 'CREATED',
      statusHistory: {
        create: { status: 'CREATED', changedBy: creatorId },
      },
    },
    select: { id: true },
  });

  return res.status(201).json({
    requestId: created.id.toString(),
    message: 'Textbook request created successfully',
  });
});

// ---------------------------------------------------------------------------
// PUT /api/textbook-requests/:id
// Update request information. ADMIN, MANAGER and CREATOR may edit any request.
// Status transitions are owned by the Workflow module and are not accepted here.
// ---------------------------------------------------------------------------
router.put('/:id', requireRole('CREATOR', 'MANAGER', 'ADMIN'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ message: 'Textbook request not found.' });
  }

  const { learnerId: rawLearnerId, textbookId: rawTextbookId } = req.body ?? {};
  const data: Prisma.TextbookRequestUpdateInput = {};

  if (rawLearnerId !== undefined) {
    const learnerId = parseId(rawLearnerId);
    if (!learnerId) {
      return res.status(400).json({ message: 'A valid learner must be selected.' });
    }
    const learner = await prisma.user.findUnique({
      where: { id: learnerId },
      select: { status: true, role: true },
    });
    if (!learner || learner.status !== 'ACTIVE' || learner.role !== 'VIEWER') {
      return res.status(400).json({ message: 'Selected learner is not a valid active learner.' });
    }
    data.learner = { connect: { id: learnerId } };
  }

  if (rawTextbookId !== undefined) {
    const textbookId = parseId(rawTextbookId);
    if (!textbookId) {
      return res.status(400).json({ message: 'A valid textbook must be selected.' });
    }
    const textbook = await prisma.textbook.findUnique({
      where: { id: textbookId },
      select: { id: true },
    });
    if (!textbook) {
      return res.status(400).json({ message: 'Selected textbook does not exist.' });
    }
    data.textbook = { connect: { id: textbookId } };
  }

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ message: 'No valid update fields were provided.' });
  }

  await prisma.textbookRequest.update({ where: { id }, data });
  return res.json({ message: 'Textbook request updated successfully.' });
});

// ---------------------------------------------------------------------------
// DELETE /api/textbook-requests/:id
// Soft delete. ADMIN and CREATOR may delete any request.
// ---------------------------------------------------------------------------
router.delete('/:id', requireRole('CREATOR', 'ADMIN'), async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ message: 'Textbook request not found.' });
  }

  await prisma.textbookRequest.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
  return res.json({ message: 'Textbook request deleted successfully.' });
});

export default router;
