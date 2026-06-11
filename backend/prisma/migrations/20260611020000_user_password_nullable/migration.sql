-- Learner/Viewer accounts have no login, so they store no password. Make the
-- password hash optional; all other roles continue to store a bcrypt hash.
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;
