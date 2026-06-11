-- Repair migration: bring the `textbooks` table in line with the schema.
--
-- The earlier `20260609000000_textbook_pdf_in_db` migration is recorded as
-- applied in some environments where its DDL never actually ran (e.g. the
-- database was restored from an older snapshot, or switched, after the migration
-- table was written). Those databases are missing the `file_data` column and
-- still have the obsolete `file_name` column, which crashes every read of a
-- textbook ("column textbooks.file_data does not exist").
--
-- This statement is written idempotently (IF [NOT] EXISTS) so it is safe to run
-- against ANY environment — fresh, already-correct, or drifted — and on every
-- deployment. A correct database is left untouched; a drifted one is repaired.
ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "file_data" BYTEA;
ALTER TABLE "textbooks" DROP COLUMN IF EXISTS "file_name";
