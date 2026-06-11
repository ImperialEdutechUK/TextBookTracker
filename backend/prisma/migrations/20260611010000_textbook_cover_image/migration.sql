-- Store a small cover thumbnail (first page of the PDF, rendered to a JPEG in the
-- browser at upload time) so the catalog grid can show covers via a lightweight
-- <img> instead of loading the whole PDF into an iframe per card.
--
-- Idempotent (IF NOT EXISTS) so it is safe to run on any environment and on every
-- deployment, matching the project's drift-resistant migration convention.
ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "cover_image" BYTEA;
ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "cover_mime_type" TEXT;
