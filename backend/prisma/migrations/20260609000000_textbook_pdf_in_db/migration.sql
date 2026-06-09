-- Store the textbook PDF bytes directly in the database instead of on local disk.
-- The old `file_name` column referenced a file under the backend uploads dir; it
-- is no longer used now that the bytes live in the `file_data` (BYTEA) column.
ALTER TABLE "textbooks" ADD COLUMN "file_data" BYTEA;
ALTER TABLE "textbooks" DROP COLUMN "file_name";
