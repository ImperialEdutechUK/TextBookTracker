-- Add an optional address to users. Like the contact number, this is only
-- populated for Learner/Viewer (VIEWER) accounts; all other roles leave it NULL.
ALTER TABLE "User" ADD COLUMN "address" TEXT;
