-- Add an optional contact number to users. This is only populated for
-- Learner/Viewer (VIEWER) accounts; all other roles leave it NULL.
ALTER TABLE "User" ADD COLUMN "contact_number" TEXT;
