import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from './db';

// On-disk cache for PDF bytes. The database stays the source of truth (it
// survives redeploys on hosts with an ephemeral filesystem); this is purely a
// cache so each PDF is pulled out of the remote database at most ONCE and then
// served from local disk. Serving from disk is fast and, via res.sendFile,
// supports HTTP Range requests so the browser's PDF viewer streams only what it
// needs. If the cache directory is wiped (e.g. a redeploy), it simply
// repopulates from the database on next access.
const CACHE_DIR = path.join(process.cwd(), '.pdf-cache');

function cachePathFor(fileName: string) {
  // basename guards against any path traversal via the stored name.
  return path.join(CACHE_DIR, path.basename(fileName));
}

// Fills currently in progress, keyed by fileName. Several requests for the same
// not-yet-cached PDF (e.g. a user clicking View/Download a few times, or the
// browser retrying) must NOT each kick off their own multi-query fetch — that
// floods the DB connection pool and makes everything hang. Instead they all
// await the same single fill ("single-flight"). The fill also runs to
// completion even if the original client disconnects, so the cache still warms.
const inFlight = new Map<string, Promise<string | null>>();

// Ensure the PDF for this request is on local disk, fetching it from the DB (in
// chunks, to keep memory flat) only if it is not cached yet. Returns the
// absolute path to the cached file, or null if the row has no bytes.
export async function ensureCached(id: bigint, fileName: string): Promise<string | null> {
  const finalPath = cachePathFor(fileName);
  if (fs.existsSync(finalPath)) return finalPath;

  const pending = inFlight.get(fileName);
  if (pending) return pending;

  const fill = fillCache(id, finalPath).finally(() => inFlight.delete(fileName));
  inFlight.set(fileName, fill);
  return fill;
}

async function fillCache(id: bigint, finalPath: string): Promise<string | null> {
  fs.mkdirSync(CACHE_DIR, { recursive: true });

  const sizeRows = await prisma.$queryRaw<Array<{ size: bigint | number | null }>>(
    Prisma.sql`SELECT octet_length(file_data) AS size FROM textbook_requests WHERE request_id = ${id} AND deleted_at IS NULL`
  );
  const size = sizeRows[0]?.size != null ? Number(sizeRows[0].size) : 0;
  if (!size) return null;

  // Write to a temp file then atomically rename, so a reader never sees a
  // half-written file and two concurrent first-time fetches can't corrupt it.
  const tmpPath = `${finalPath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  const ws = fs.createWriteStream(tmpPath);
  try {
    const CHUNK = 8 * 1024 * 1024; // 8MB
    for (let offset = 0; offset < size; offset += CHUNK) {
      const rows = await prisma.$queryRaw<Array<{ chunk: Buffer | null }>>(
        Prisma.sql`SELECT substring(file_data from ${offset + 1}::int for ${CHUNK}::int) AS chunk FROM textbook_requests WHERE request_id = ${id} AND deleted_at IS NULL`
      );
      const chunk = rows[0]?.chunk;
      if (!chunk || chunk.length === 0) break;
      if (!ws.write(chunk)) {
        await new Promise<void>((resolve) => ws.once('drain', resolve));
      }
    }
    await new Promise<void>((resolve, reject) =>
      ws.end((err?: Error | null) => (err ? reject(err) : resolve()))
    );
    fs.renameSync(tmpPath, finalPath);
  } catch (err) {
    ws.destroy();
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }
    throw err;
  }
  return finalPath;
}

// Drop a cached file (called when its PDF is removed or replaced). Best-effort.
export function removeCached(fileName: string | null | undefined) {
  if (!fileName) return;
  try { fs.unlinkSync(cachePathFor(fileName)); } catch { /* not cached / already gone */ }
}
