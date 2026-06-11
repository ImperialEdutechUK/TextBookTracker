import { prisma } from './db';

// Self-healing schema guard, run once on startup.
//
// This database has repeatedly drifted from the Prisma migration history:
// columns the app needs (e.g. `file_data`) go missing even though every
// migration is recorded as applied, because the database is periodically
// restored/reset to older snapshots. Prisma's `migrate deploy` cannot recover
// from that — it skips any migration already marked applied — so a textbook read
// or write then crashes with "column ... does not exist".
//
// To make the app resilient regardless of how the database got into its current
// state, we defensively ensure the columns the Textbook model reads and writes
// exist on every boot. Every statement uses `ADD COLUMN IF NOT EXISTS`, so it is
// a harmless no-op on a correct database and a repair on a drifted one. This runs
// in addition to (not instead of) normal migrations.
const TEXTBOOK_COLUMNS: ReadonlyArray<string> = [
  'ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "original_name" TEXT',
  'ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "file_size" BIGINT',
  'ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "mime_type" TEXT',
  'ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "file_data" BYTEA',
  'ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "cover_image" BYTEA',
  'ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "cover_mime_type" TEXT',
];

export async function ensureSchema(): Promise<void> {
  for (const sql of TEXTBOOK_COLUMNS) {
    await prisma.$executeRawUnsafe(sql);
  }
}
