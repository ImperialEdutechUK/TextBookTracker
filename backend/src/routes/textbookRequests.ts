import multer from 'multer';
import crypto from 'crypto';
import { Prisma, RequestStatus, RequestEventType } from '@prisma/client';
import { prisma } from '../lib/db';
import { makeRouter } from '../lib/router';
import { removeCached } from '../lib/pdfCache';
import { notifyNewRequest } from '../lib/teamsNotify';
import { requireAuth } from '../middleware/requireAdmin';
import fs from 'fs';
import path from 'path';

const router = makeRouter();
router.use(requireAuth);
const VALID_STATUSES = Object.values(RequestStatus);
const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') { cb(null, true); }
    else { cb(new Error('Only PDF files are allowed.')); }
  },
});

const REQUEST_SELECT = {
  id: true,
  fullName: true, firstName: true, lastName: true,
  email: true, contactNumber: true, course: true, units: true, address: true,
  status: true, trackingNumber: true,
  bookName1: true, fileName: true, originalName: true, fileSize: true,
  bookName2: true, fileName2: true, originalName2: true, fileSize2: true,
  bookName3: true, fileName3: true, originalName3: true, fileSize3: true,
  createdAt: true, updatedAt: true,
} satisfies Prisma.TextbookRequestSelect;

type RequestRow = Prisma.TextbookRequestGetPayload<{ select: typeof REQUEST_SELECT }>;

function serialize(r: RequestRow) {
  return {
    requestId: r.id.toString(),
    fullName: r.fullName, firstName: r.firstName, lastName: r.lastName,
    email: r.email, contactNumber: r.contactNumber,
    course: r.course, units: r.units, address: r.address,
    status: r.status, trackingNumber: r.trackingNumber,
    bookName1: r.bookName1, hasFile: Boolean(r.fileName), originalName: r.originalName, fileSize: r.fileSize ? Number(r.fileSize) : null,
    bookName2: r.bookName2, hasFile2: Boolean(r.fileName2), originalName2: r.originalName2, fileSize2: r.fileSize2 ? Number(r.fileSize2) : null,
    bookName3: r.bookName3, hasFile3: Boolean(r.fileName3), originalName3: r.originalName3, fileSize3: r.fileSize3 ? Number(r.fileSize3) : null,
    createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
  };
}

function parseId(value: unknown): bigint | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const str = String(value).trim();
  if (!/^\d+$/.test(str)) return null;
  try { return BigInt(str); } catch { return null; }
}

function buildWhere(query: Record<string, unknown>): Prisma.TextbookRequestWhereInput {
  const filters: Prisma.TextbookRequestWhereInput[] = [{ deletedAt: null }];
  const search = typeof query.search === 'string' ? query.search.trim() : '';
  if (search) {
    filters.push({ OR: [
      { fullName: { contains: search, mode: 'insensitive' } },
      { course: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
      { contactNumber: { contains: search, mode: 'insensitive' } },
      { trackingNumber: { contains: search, mode: 'insensitive' } },
    ]});
  }
  const status = query.status;
  if (typeof status === 'string' && status && VALID_STATUSES.includes(status as RequestStatus)) {
    filters.push({ status: status as RequestStatus });
  }
  return { AND: filters };
}

const FIELDS = ['email', 'contactNumber', 'course', 'units', 'address'] as const;
type FieldName = (typeof FIELDS)[number];
function readFields(body: Record<string, unknown>, requireAll: boolean) {
  const data: Partial<Record<FieldName, string>> = {};
  for (const field of FIELDS) {
    const raw = body[field];
    if (raw === undefined) { if (requireAll) return { error: `${field} is required.` }; continue; }
    const value = String(raw).trim();
    if (!value) return { error: `${field} cannot be empty.` };
    data[field] = value;
  }
  return { data };
}

// Fetch PDF bytes from the correct column for each slot and serve from disk cache
async function ensureCachedSlot(id: bigint, fileName: string, slot: 1 | 2 | 3): Promise<string | null> {
  const finalPath = path.join(CACHE_DIR, path.basename(fileName));
  if (fs.existsSync(finalPath)) return finalPath;
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const col = slot === 1 ? Prisma.sql`file_data` : slot === 2 ? Prisma.sql`file_data_2` : Prisma.sql`file_data_3`;
  const sizeRows = await prisma.$queryRaw<Array<{ size: bigint | number | null }>>(
    Prisma.sql`SELECT octet_length(${col}) AS size FROM textbook_requests WHERE request_id = ${id} AND deleted_at IS NULL`
  );
  const size = sizeRows[0]?.size != null ? Number(sizeRows[0].size) : 0;
  if (!size) return null;
  const tmpPath = `${finalPath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const ws = fs.createWriteStream(tmpPath);
  try {
    const CHUNK = 8 * 1024 * 1024;
    for (let offset = 0; offset < size; offset += CHUNK) {
      const rows = await prisma.$queryRaw<Array<{ chunk: Buffer | null }>>(
        Prisma.sql`SELECT substring(${col} from ${offset + 1}::int for ${CHUNK}::int) AS chunk FROM textbook_requests WHERE request_id = ${id} AND deleted_at IS NULL`
      );
      const chunk = rows[0]?.chunk;
      if (!chunk || chunk.length === 0) break;
      if (!ws.write(chunk)) await new Promise<void>((resolve) => ws.once('drain', resolve));
    }
    await new Promise<void>((resolve, reject) => ws.end((err?: Error | null) => (err ? reject(err) : resolve())));
    fs.renameSync(tmpPath, finalPath);
  } catch (err) {
    ws.destroy();
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
  return finalPath;
}

// ── GET / ────────────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number(req.query.pageSize) || DEFAULT_PAGE_SIZE));
  const status = req.query.status;
  if (typeof status === 'string' && status && !VALID_STATUSES.includes(status as RequestStatus)) {
    return res.status(400).json({ message: 'Invalid status filter.' });
  }
  const where = buildWhere(req.query as Record<string, unknown>);
  const [rows, total] = await prisma.$transaction([
    prisma.textbookRequest.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize, select: REQUEST_SELECT }),
    prisma.textbookRequest.count({ where }),
  ]);
  return res.json({ requests: rows.map(serialize), pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
});

// ── GET /export/csv ───────────────────────────────────────────────────────────
router.get('/export/csv', async (req, res) => {
  const rows = await prisma.textbookRequest.findMany({ where: buildWhere(req.query as Record<string, unknown>), orderBy: { createdAt: 'desc' }, take: 5000, select: REQUEST_SELECT });
  const esc = (v: string | null | undefined) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const header = ['Request ID','Full Name','Email','Contact Number','Course','Units','Delivery Address','Status','Tracking Number','Book 1','PDF 1','Book 2','PDF 2','Book 3','PDF 3','Created At'];
  const lines = [header.join(',')];
  for (const r of rows) {
    lines.push([esc(r.id.toString()),esc(r.fullName),esc(r.email),esc(r.contactNumber),esc(r.course),esc(r.units),esc(r.address),esc(r.status),esc(r.trackingNumber),esc(r.bookName1),esc(r.originalName ?? ''),esc(r.bookName2),esc(r.originalName2 ?? ''),esc(r.bookName3),esc(r.originalName3 ?? ''),esc(r.createdAt.toISOString())].join(','));
  }
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="textbook-requests.csv"');
  return res.send(lines.join('\n'));
});

// ── GET /:id ──────────────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const request = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { ...REQUEST_SELECT, events: { orderBy: { createdAt: 'asc' }, select: { type: true, detail: true, createdAt: true } } } });
  if (!request) return res.status(404).json({ message: 'Textbook request not found.' });
  const { events, ...rest } = request;
  return res.json({ request: { ...serialize(rest), events: events.map((e) => ({ type: e.type, detail: e.detail, createdAt: e.createdAt.toISOString() })) } });
});

// ── POST / ────────────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const body = req.body ?? {};
  const { data, error } = readFields(body, true);
  if (error || !data) return res.status(400).json({ message: error ?? 'Invalid request.' });
  let firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
  let lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
  let fullName = typeof body.fullName === 'string' ? body.fullName.trim() : '';
  if (!firstName && fullName) { const parts = fullName.split(/\s+/); firstName = parts[0] ?? ''; lastName = parts.slice(1).join(' '); }
  if (!firstName) return res.status(400).json({ message: 'A first name is required.' });
  if (!fullName) fullName = `${firstName} ${lastName}`.trim();
  const force = body.force === true || body.force === 'true';
  if (!force) {
    const dup = await prisma.textbookRequest.findFirst({ where: { deletedAt: null, email: { equals: data.email!, mode: 'insensitive' } }, select: { fullName: true, course: true, status: true } });
    if (dup) return res.status(409).json({ message: `A request from this email already exists (${dup.fullName}, ${dup.course}, ${dup.status}). Create it anyway?`, duplicate: true });
  }
  const created = await prisma.textbookRequest.create({ data: { fullName, firstName, lastName: lastName || null, email: data.email!, contactNumber: data.contactNumber!, course: data.course!, units: data.units!, address: data.address!, status: 'RECEIVED', events: { create: { type: 'CREATED' } } }, select: REQUEST_SELECT });
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const addressParts = str(body.addressLine1) && str(body.city) && str(body.postcode) ? { line1: str(body.addressLine1), line2: str(body.addressLine2), city: str(body.city), postcode: str(body.postcode), country: str(body.country) } : null;
  void notifyNewRequest({ firstName: created.firstName, lastName: created.lastName, fullName: created.fullName, email: created.email, contactNumber: created.contactNumber, course: created.course, address: created.address, addressParts, createdAt: created.createdAt });
  return res.status(201).json({ request: serialize(created), message: 'Request created successfully.' });
});

// ── PUT /:id ──────────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) return res.status(404).json({ message: 'Textbook request not found.' });
  const { data, error } = readFields(req.body ?? {}, false);
  if (error || !data) return res.status(400).json({ message: error ?? 'Invalid request.' });
  const update: Prisma.TextbookRequestUpdateInput = { ...data };
  if (req.body?.trackingNumber !== undefined) { const tn = String(req.body.trackingNumber).trim(); update.trackingNumber = tn || null; }
  if (Object.keys(update).length === 0) return res.status(400).json({ message: 'No valid update fields were provided.' });
  const updated = await prisma.textbookRequest.update({ where: { id }, data: update, select: REQUEST_SELECT });
  return res.json({ request: serialize(updated), message: 'Request updated successfully.' });
});

// ── DELETE /:id ───────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) return res.status(404).json({ message: 'Textbook request not found.' });
  await prisma.textbookRequest.update({ where: { id }, data: { deletedAt: new Date() }, select: { id: true } });
  return res.json({ message: 'Request deleted successfully.' });
});

// ── PATCH /:id/status ─────────────────────────────────────────────────────────
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
  if (!newStatus || !VALID_STATUSES.includes(newStatus as RequestStatus)) return res.status(400).json({ message: 'Invalid status value.' });
  const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { status: true } });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });
  const rule = TRANSITIONS.find((t) => t.from === existing.status && t.to === (newStatus as RequestStatus));
  if (!rule) return res.status(400).json({ message: 'Invalid status transition.' });
  const data: Prisma.TextbookRequestUpdateInput = { status: newStatus as RequestStatus };
  const isForward = (existing.status === 'RECEIVED' && newStatus === 'SENT_TO_PRINT') || (existing.status === 'SENT_TO_PRINT' && newStatus === 'PRINTED');
  let eventType: RequestEventType = isForward ? (newStatus as RequestEventType) : 'REVERTED';
  let eventDetail: string | null = isForward ? null : `Reverted to ${newStatus}`;
  if (existing.status === 'SENT_TO_PRINT' && newStatus === 'PRINTED') {
    const tn = typeof trackingNumber === 'string' ? trackingNumber.trim() : '';
    if (!tn) return res.status(400).json({ message: 'A tracking number is required to mark as printed.' });
    data.trackingNumber = tn;
    eventDetail = `Tracking number: ${tn}`;
  }
  data.events = { create: { type: eventType, detail: eventDetail } };
  const updated = await prisma.textbookRequest.update({ where: { id }, data, select: REQUEST_SELECT });
  return res.json({ request: serialize(updated), message: 'Status updated successfully.' });
});

// ── PATCH /:id/booknames ──────────────────────────────────────────────────────
router.patch('/:id/booknames', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });
  const { bookName1, bookName2, bookName3 } = req.body ?? {};
  const data: Prisma.TextbookRequestUpdateInput = {};
  if (bookName1 !== undefined) data.bookName1 = String(bookName1).trim() || null;
  if (bookName2 !== undefined) data.bookName2 = String(bookName2).trim() || null;
  if (bookName3 !== undefined) data.bookName3 = String(bookName3).trim() || null;
  if (Object.keys(data).length === 0) return res.status(400).json({ message: 'No book names provided.' });
  const updated = await prisma.textbookRequest.update({ where: { id }, data, select: REQUEST_SELECT });
  return res.json({ request: serialize(updated), message: 'Book names updated.' });
});

// ── PDF routes (slots 1, 2, 3) ────────────────────────────────────────────────
// POST /:id/pdf/:slot  — upload
router.post('/:id/pdf/:slot', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const slot = parseInt(req.params.slot) as 1 | 2 | 3;
  if (![1, 2, 3].includes(slot)) return res.status(400).json({ message: 'Slot must be 1, 2, or 3.' });
  upload.single('pdf')(req, res, async (err: unknown) => {
    if (err) return res.status(400).json({ message: err instanceof Error ? err.message : 'Upload failed.' });
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'A PDF file is required.' });
    const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true, fileName: true, fileName2: true, fileName3: true } });
    if (!existing) return res.status(404).json({ message: 'Request not found.' });
    const oldFile = slot === 1 ? existing.fileName : slot === 2 ? existing.fileName2 : existing.fileName3;
    removeCached(oldFile);
    const newFileName = `${crypto.randomBytes(16).toString('hex')}.pdf`;
    const data: Prisma.TextbookRequestUpdateInput = slot === 1
      ? { fileName: newFileName, originalName: file.originalname, fileSize: BigInt(file.size), mimeType: file.mimetype, fileData: file.buffer }
      : slot === 2
      ? { fileName2: newFileName, originalName2: file.originalname, fileSize2: BigInt(file.size), mimeType2: file.mimetype, fileData2: file.buffer }
      : { fileName3: newFileName, originalName3: file.originalname, fileSize3: BigInt(file.size), mimeType3: file.mimetype, fileData3: file.buffer };
    data.events = { create: { type: 'PDF_ATTACHED', detail: `Slot ${slot}: ${file.originalname}` } };
    const updated = await prisma.textbookRequest.update({ where: { id }, data, select: REQUEST_SELECT });
    return res.status(201).json({ request: serialize(updated), message: 'PDF uploaded successfully.' });
  });
});

// GET /:id/pdf/:slot  — stream
router.get('/:id/pdf/:slot', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const slot = parseInt(req.params.slot) as 1 | 2 | 3;
  if (![1, 2, 3].includes(slot)) return res.status(400).json({ message: 'Slot must be 1, 2, or 3.' });
  const row = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { fileName: true, originalName: true, mimeType: true, fileName2: true, originalName2: true, mimeType2: true, fileName3: true, originalName3: true, mimeType3: true } });
  if (!row) return res.status(404).json({ message: 'Request not found.' });
  const fileName = slot === 1 ? row.fileName : slot === 2 ? row.fileName2 : row.fileName3;
  const originalName = slot === 1 ? row.originalName : slot === 2 ? row.originalName2 : row.originalName3;
  const mimeType = slot === 1 ? row.mimeType : slot === 2 ? row.mimeType2 : row.mimeType3;
  if (!fileName) return res.status(404).json({ message: 'No PDF found for this slot.' });
  let cachePath: string | null;
  try { cachePath = await ensureCachedSlot(id, fileName, slot); }
  catch { return res.status(503).json({ message: 'The PDF is temporarily unavailable.' }); }
  if (!cachePath) return res.status(404).json({ message: 'No PDF found for this slot.' });
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', mimeType ?? 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(originalName ?? 'textbook.pdf')}"`);
  res.sendFile(cachePath, (err) => { if (err && !res.headersSent) res.status(500).json({ message: 'Could not send the PDF.' }); });
  return;
});

// DELETE /:id/pdf/:slot  — remove
router.delete('/:id/pdf/:slot', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const slot = parseInt(req.params.slot) as 1 | 2 | 3;
  if (![1, 2, 3].includes(slot)) return res.status(400).json({ message: 'Slot must be 1, 2, or 3.' });
  const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { fileName: true, fileName2: true, fileName3: true } });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });
  const fn = slot === 1 ? existing.fileName : slot === 2 ? existing.fileName2 : existing.fileName3;
  if (!fn) return res.status(404).json({ message: 'No PDF to remove.' });
  removeCached(fn);
  const data: Prisma.TextbookRequestUpdateInput = slot === 1
    ? { fileName: null, originalName: null, fileSize: null, mimeType: null, fileData: null }
    : slot === 2
    ? { fileName2: null, originalName2: null, fileSize2: null, mimeType2: null, fileData2: null }
    : { fileName3: null, originalName3: null, fileSize3: null, mimeType3: null, fileData3: null };
  data.events = { create: { type: 'PDF_REMOVED', detail: `Slot ${slot}` } };
  const updated = await prisma.textbookRequest.update({ where: { id }, data, select: REQUEST_SELECT });
  return res.json({ request: serialize(updated), message: 'PDF removed successfully.' });
});

// ── Backward-compat: old /:id/pdf routes hit slot 1 ──────────────────────────
router.get('/:id/pdf', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const meta = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { fileName: true, originalName: true, mimeType: true } });
  if (!meta || !meta.fileName) return res.status(404).json({ message: 'No PDF found for this request.' });
  let cachePath: string | null;
  try { cachePath = await ensureCachedSlot(id, meta.fileName, 1); }
  catch { return res.status(503).json({ message: 'The PDF is temporarily unavailable. Please try again.' }); }
  if (!cachePath) return res.status(404).json({ message: 'No PDF found for this request.' });
  const disposition = req.query.download ? 'attachment' : 'inline';
  res.setHeader('Content-Type', meta.mimeType ?? 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(meta.originalName ?? 'textbook.pdf')}"`);
  res.sendFile(cachePath, (err) => { if (err && !res.headersSent) res.status(500).json({ message: 'Could not send the PDF.' }); });
  return;
});

router.post('/:id/pdf', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  upload.single('pdf')(req, res, async (err: unknown) => {
    if (err) return res.status(400).json({ message: err instanceof Error ? err.message : 'Upload failed.' });
    const file = req.file;
    if (!file) return res.status(400).json({ message: 'A PDF file is required.' });
    const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { id: true, fileName: true } });
    if (!existing) return res.status(404).json({ message: 'Request not found.' });
    removeCached(existing.fileName);
    const updated = await prisma.textbookRequest.update({
      where: { id },
      data: { fileName: `${crypto.randomBytes(16).toString('hex')}.pdf`, originalName: file.originalname, fileSize: BigInt(file.size), mimeType: file.mimetype, fileData: file.buffer, events: { create: { type: 'PDF_ATTACHED', detail: file.originalname } } },
      select: REQUEST_SELECT,
    });
    return res.status(201).json({ request: serialize(updated), message: 'PDF uploaded successfully.' });
  });
});

router.delete('/:id/pdf', async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ message: 'Invalid request id.' });
  const existing = await prisma.textbookRequest.findFirst({ where: { id, deletedAt: null }, select: { fileName: true } });
  if (!existing) return res.status(404).json({ message: 'Request not found.' });
  if (!existing.fileName) return res.status(404).json({ message: 'No PDF to remove.' });
  removeCached(existing.fileName);
  const updated = await prisma.textbookRequest.update({ where: { id }, data: { fileName: null, originalName: null, fileSize: null, mimeType: null, fileData: null, events: { create: { type: 'PDF_REMOVED' } } }, select: REQUEST_SELECT });
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
    const fn = String(firstName ?? '').trim(); const ln = String(lastName ?? '').trim();
    data.firstName = fn; data.lastName = ln || null; data.fullName = `${fn} ${ln}`.trim();
  } else if (fullName) {
    const fnm = String(fullName).trim(); const parts = fnm.split(/\s+/);
    data.fullName = fnm; data.firstName = parts[0] ?? ''; data.lastName = parts.slice(1).join(' ') || null;
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
