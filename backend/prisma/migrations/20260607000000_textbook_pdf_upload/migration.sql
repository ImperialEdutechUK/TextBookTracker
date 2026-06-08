-- Add PDF upload metadata to the textbook catalog.
ALTER TABLE "textbooks" ADD COLUMN "file_name" TEXT;
ALTER TABLE "textbooks" ADD COLUMN "original_name" TEXT;
ALTER TABLE "textbooks" ADD COLUMN "file_size" BIGINT;
ALTER TABLE "textbooks" ADD COLUMN "mime_type" TEXT;
