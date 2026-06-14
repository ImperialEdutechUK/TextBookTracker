-- Store the PDF bytes in the database so files survive on hosts with an
-- ephemeral filesystem (e.g. Railway), where on-disk uploads are wiped on
-- every redeploy/restart.
-- IF NOT EXISTS: some environments already added this column via an earlier
-- out-of-band migration, so this stays a safe no-op there.
ALTER TABLE "textbooks" ADD COLUMN IF NOT EXISTS "file_data" BYTEA;
