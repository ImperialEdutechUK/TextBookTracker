import multer from 'multer';
import crypto from 'crypto';
import { Prisma, RequestStatus, RequestEventType } from '@prisma/client';
import { prisma } from '../lib/db';
import { makeRouter } from '../lib/router';
import { ensureCached, removeCached } from '../lib/pdfCache';
import { notifyNewRequest } from '../lib/teamsNotify';
import { requireAuth } from '../middleware/requireAdmin';

const router = makeRouter();
router.use(requireAuth);

const VALID_STATUSES = Object.values(RequestStatus);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

// Keep the PDF bytes in memory so they can be persisted to the database. Hosts
// like Railway have an ephemeral filesystem, so the DB is the only durable store.
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

// Every column EXCEPT the multi-MB `fileData` blob. List and detail endpoints
// must never pull the PDF bytes: doing so transferred ~33MB per row out of the
// remote database, which made the dashboard and list endpoints hang (the query
// gets stuck mid-transfer if the client is slow, holding a DB connection). Only
// the dedicated GET /:id/pdf endpoint reads `fileData`.
const REQUEST_SELECT = {
  id: true,
  fullName: true,
  firstName: true,
  lastName: true,
  email: true,
  contactNumber: true,
  course: true,
  units: true,
  address: true,
  status: true,
  trackingNumber: true,
  fileName: true,
  originalName: true,
  fileSize: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TextbookRequestSelect;

type RequestRow = Prisma.TextbookRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

function serialize(r: RequestRow) {
  return {
    requestId: r.id.toString(),
    fullName: r.fullName,
    firstName: r.firstName,
    lastName: r.lastName,
    email: r.email,
    contactNumber: r.contactNumber,
    course: r.course,
    units: r.units,
    address: r.address,
    status: r.status,
    trackingNumber: r.trackingNumber,
    hasFile: Boolean(r.fileName),
    originalName: r.originalName,
    fileSize: r.fileSize ? Number(r.fileSize) : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
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

// Build the WHERE clause shared by the list and CSV export endpoints.
function buildWhere(query: Record<string, unknown>): Prisma.TextbookRequestWhereInput {
  const filters: Prisma.TextbookRequestWhereInput[] = [{ deletedAt: null }];

  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    filters.push({
      OR: [
        { fullName: { contains: search, mode: 'insensitive' } },
        { course: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { contactNumber: { contains: search, mode: 'insensitive' } },
        { trackingNumber: { contains: search, mode: 'insensitive' } },
      ],
    });
  }

  const status = query.status;
  if (typeof status === 'string' && status && VALID_STATUSES.includes(status as RequestStatus)) {
    filters.push({ status: status as RequestStatus });
  }

  return { AND: filters };
}

// Validate and normalise the learner-detail fields from a create/update body.
const FIELDS = ['email', 'contactNumber', 'course', 'units', 'address'] as const;
type FieldName = (typeof FIELDS)[number];

function readFields(body: Record<string, unknown>, requireAll: boolean) {
  const data: Partial<Record<FieldName, string>> = {};
  for (const field of FIELDS) {
    const raw = body[field];
    if (raw === undefined) {
      if (requireAll) return { error: `${field} is required.` };
      continue;
    }
    const value = String(raw).trim();
    if (!value) return { error: `${field} cannot be empty.` };
    data[field] = value;
  }
  return { data };
}

router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE)
  );

  const status = req.query.status;
  if (typeof status === 'string' && status && !VALID_STATUSES.includes(status as RequestStatus)) {
    return res.status(400).json({ message: 'Invalid status filter.' });
  }

  const where = buildWhere(req.query as Record<string, unknown>);
  const [rows, total] = await prisma.$transaction([
    prisma.textbookRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: REQUEST_SELECT,
    }),
    prisma.textbookRequest.count({ where }),
  ]);

  return res.json({
    requests: rows.map(serialize),
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  });
});

router.get('/export/csv', async (req, res) => {
  const rows = await prisma.textbookRequest.findMany({
    where: buildWhere(req.query as Record<string, unknown>),
    orderBy: { createdAt: 'desc' },
    take: 5000,
    select: REQUEST_SELECT,
  });

  const esc = (v: string | null | undefined) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const header = [
    'Request ID', 'Full Name', 'Email', 'Contact Number', 'Course', 'Units',
    'Delivery Address', 'Status', 'Tracking Number', 'PDF', 'Created At',
  ];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([
      esc(r.id.toString()),
      esc(r.fullName),
      esc(r.email),
      esc(r.contactNumber),
      esc(r.course),
      esc(r.units),
      esc(r.address),
      esc(r.status),
      esc(r.trackingNumber),
      esc(r.originalName ?? ''),
      esc(r.createdAt.toISOString()),
    ].join(','));
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="textbook-requests.csv"');
  return res.send(lines.join('\n'));
});

router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const request = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: {
      ...REQUEST_SELECT,
      events: {
        orderBy: { createdAt: 'asc' },
        select: { type: true, detail: true, createdAt: true },
      },
    },
  });
  if (!request) return res.status(404).json({ message: 'Textbook request not found.' });

  const { events, ...rest } = request;
  return res.json({
    request: {
      ...serialize(rest),
      events: events.map((e) => ({
        type: e.type,
        detail: e.detail,
        createdAt: e.createdAt.toISOString(),
      })),
    },
  });
});

router.post('/', async (req, res) => {
  const body = req.body ?? {};
  const { data, error } = readFields(body, true);
  if (error || !data) return res.status(400).json({ message: error ?? 'Invalid request.' });

  let firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  let lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  let fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  if (!firstName && fullName) {
    const parts = fullName.split(/\s+/);
    firstName = parts[0] ?? '';
    lastName = parts.slice(1).join(' ');
  }
  if (!firstName) return res.status(400).json({ message: 'A first name is required.' });
  if (!fullName) fullName = `${firstName} ${lastName}`.trim();

  const force = body.force === true || body.force === 'true';
  if (!force) {
    const dup = await prisma.textbookRequest.findFirst({
      where: { deletedAt: null, email: { equals: data.email!, mode: 'insensitive' } },
      select: { fullName: true, course: true, status: true },
    });
    if (dup) {
      return res.status(409).json({
        message: `A request from this email already exists (${dup.fullName}, ${dup.course}, ${dup.status}). Create it anyway?`,
        duplicate: true,
      });
    }
  }

  const created = await prisma.textbookRequest.create({
    data: {
      fullName,
      firstName,
      lastName: lastName || null,
      email: data.email!,
      contactNumber: data.contactNumber!,
      course: data.course!,
      units: data.units!,
      address: data.address!,
      status: 'RECEIVED',
      events: { create: { type: 'CREATED' } },
    },
    select: REQUEST_SELECT,
  });

  // Structured address parts straight from the form, when provided, so the
  // Teams card shows clean fields instead of guessing from the combined string.
  // Falls back (inside notifyNewRequest) to parsing `address` for older clients.
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const addressParts =
    str(body.addressLine1) && str(body.city) && str(body.postcode)
      ? {
          line1: str(body.addressLine1),
          line2: str(body.addressLine2),
          city: str(body.city),
          postcode: str(body.postcode),
          country: str(body.country),
        }
      : null;

  // Notify the Teams chat (Workflows webhook) that a new request came in. Fired
  // without await so a slow/failed webhook never delays or breaks the response.
  void notifyNewRequest({
    firstName: created.firstName,
    lastName: created.lastName,
    fullName: created.fullName,
    email: created.email,
    contactNumber: created.contactNumber,
    course: created.course,
    address: created.address,
    addressParts,
    createdAt: created.createdAt,
  });

  return res.status(201).json({ request: serialize(created), message: 'Request created successfully.' });
});

router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ message: 'Textbook request not found.' });

  const { data, error } = readFields(req.body ?? {}, false);
  if (error || !data) return res.status(400).json({ message: error ?? 'Invalid request.' });

  const update: Prisma.TextbookRequestUpdateInput = { ...data };

  // The tracking number can be edited later if it changes at the print site.
  if (req.body?.trackingNumber !== undefined) {
    const tn = String(req.body.trackingNumber).trim();
    update.trackingNumber = tn || null;
  }

  if (Object.keys(update).length === 0) {
    return res.status(400).json({ message: 'No valid update fields were provided.' });
  }

  const updated = await prisma.textbookRequest.update({ where: { id }, data: update, select: REQUEST_SELECT });
  return res.json({ request: serialize(updated), message: 'Request updated successfully.' });
});

router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { id: true },
  });
  if (!existing) return res.status(404).json({ message: 'Textbook request not found.' });

  await prisma.textbookRequest.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true } });
  return res.json({ message: 'Request deleted successfully.' });
});

// Allowed status moves in BOTH directions. Forward = normal workflow; backward =
// revert one step. RECEIVED -> SENT_TO_PRINT additionally requires a tracking
// number (entered in the "Send to print" dialog).
const TRANSITIONS: Array<{ from: RequestStatus; to: RequestStatus }> = [
  { from: 'RECEIVED', to: 'SENT_TO_PRINT' },
  { from: 'SENT_TO_PRINT', to: 'PRINTED' },
  { from: 'SENT_TO_PRINT', to: 'RECEIVED' },
  { from: 'PRINTED', to: 'SENT_TO_PRINT' },
];

router.patch('/:id/status', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const { status: newStatus, trackingNumber } = req.body ?? {};
  if (!newStatus || !VALID_STATUSES.includes(newStatus as RequestStatus)) {
    return res.status(400).json({ message: 'Invalid status value.' });
  }

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { status: true },
  });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });

  const rule = TRANSITIONS.find(
    (t) => t.from === existing.status && t.to === (newStatus as RequestStatus)
  );
  if (!rule) {
    return res.status(400).json({ message: 'Invalid status transition.' });
  }

  const data: Prisma.TextbookRequestUpdateInput = { status: newStatus as RequestStatus };

  // A forward move logs its own event type; a backward move logs a REVERTED
  // event noting which status it went back to.
  const isForward =
    (existing.status === 'RECEIVED' && newStatus === 'SENT_TO_PRINT') ||
    (existing.status === 'SENT_TO_PRINT' && newStatus === 'PRINTED');
  let eventType: RequestEventType = isForward ? (newStatus as RequestEventType) : 'REVERTED';
  let eventDetail: string | null = isForward ? null : `Reverted to ${newStatus}`;

  // Marking Sent to print -> Printed captures the tracking number returned by
  // the print/delivery site.
  if (existing.status === 'SENT_TO_PRINT' && newStatus === 'PRINTED') {
    const tn = typeof trackingNumber === 'string' ? trackingNumber.trim() : '';
    if (!tn) {
      return res.status(400).json({ message: 'A tracking number is required to mark as printed.' });
    }
    data.trackingNumber = tn;
    eventDetail = `Tracking number: ${tn}`;
  }

  data.events = { create: { type: eventType, detail: eventDetail } };

  const updated = await prisma.textbookRequest.update({ where: { id }, data, select: REQUEST_SELECT });
  return res.json({ request: serialize(updated), message: 'Status updated successfully.' });
});

// Upload (or replace) the PDF attached to a request.
router.post('/:id/pdf', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  upload.single('pdf')(req, res, async (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'Upload failed.';
      return res.status(400).json({ message });
    }
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'A PDF file is required.' });

    const existing = await prisma.textbookRequest.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, fileName: true },
    });
    if (!existing) return res.status(404).json({ message: 'Request not found.' });

    // Replacing the PDF: drop any cached copy of the file being replaced.
    removeCached(existing.fileName);

    const updated = await prisma.textbookRequest.update({
      where: { id },
      data: {
        fileName: `${crypto.randomBytes(16).toString('hex')}.pdf`,
        originalName: file.originalname,
        fileSize: BigInt(file.size),
        mimeType: file.mimetype,
        fileData: file.buffer,
        events: { create: { type: 'PDF_ATTACHED', detail: file.originalname } },
      },
      select: REQUEST_SELECT,
    });

    return res.status(201).json({ request: serialize(updated), message: 'PDF uploaded successfully.' });
  });
});

router.get('/:id/pdf', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  // Fetch the metadata first — it is tiny and fast, so the 404 case never has
  // to touch the multi-MB blob.
  const meta = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { fileName: true, originalName: true, mimeType: true },
  });
  if (!meta || !meta.fileName) {
    return res.status(404).json({ message: 'No PDF found for this request.' });
  }

  // Pull the bytes out of the (remote) database AT MOST ONCE, then serve from
  // the local disk cache. Serving from disk is fast and res.sendFile supports
  // HTTP Range + conditional requests automatically, so the browser's PDF
  // viewer fetches only the bytes it needs and re-opens are near-instant. This
  // replaces re-streaming the whole blob from the DB on every click, which was
  // slow and prone to ERR_CONNECTION_RESET.
  let cachePath: string | null;
  try {
    cachePath = await ensureCached(id, meta.fileName);
  } catch {
    return res.status(503).json({ message: 'The PDF is temporarily unavailable. Please try again.' });
  }
  if (!cachePath) {
    return res.status(404).json({ message: 'No PDF found for this request.' });
  }

  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', meta.mimeType ?? 'application/pdf');
  res.setHeader(
    'Content-Disposition',
    `${disposition}; filename="${encodeURIComponent(meta.originalName ?? 'textbook.pdf')}"`
  );
  res.sendFile(cachePath, (err) => {
    if (err && !res.headersSent) {
      res.status(500).json({ message: 'Could not send the PDF.' });
    }
  });
  return;
});

router.delete('/:id/pdf', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });

  const existing = await prisma.textbookRequest.findFirst({
    where: { id, deletedAt: null },
    select: { fileName: true },
  });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });
  if (!existing.fileName) return res.status(404).json({ message: 'No PDF to remove.' });

  const updated = await prisma.textbookRequest.update({
    where: { id },
    data: {
      fileName: null, originalName: null, fileSize: null, mimeType: null, fileData: null,
      events: { create: { type: 'PDF_REMOVED' } },
    },
    select: REQUEST_SELECT,
  });
  removeCached(existing.fileName);
  return res.json({ request: serialize(updated), message: 'PDF removed successfully.' });
});

export default router;

router.patch('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });
  const { fullName, firstName, lastName, email, contactNumber, course, units, address } = req.body ?? {};
  const data: Record<string, string | null> = {};
  if (firstName !== undefined || lastName !== undefined) {
    const fn = String(firstName ?? '').trim();
    const ln = String(lastName ?? '').trim();
    data.firstName = fn;
    data.lastName = ln || null;
    data.fullName = `${fn} ${ln}`.trim();
  } else if (fullName) {
    const fnm = String(fullName).trim();
    const parts = fnm.split(/\s+/);
    data.fullName = fnm;
    data.firstName = parts[0] ?? '';
    data.lastName = parts.slice(1).join(' ') || null;
  }
  if (email) data.email = email;
  if (contactNumber) data.contactNumber = contactNumber;
  if (course) data.course = course;
  if (units) data.units = units;
  if (address) data.address = address;
  if (Object.keys(data).length === 0) return res.status(400).json({ message: 'No fields to update.' });
  await prisma.textbookRequest.update({ where: { id }, data: data as Prisma.TextbookRequestUpdateInput });
  return res.json({ message: 'Request updated.' });
});
