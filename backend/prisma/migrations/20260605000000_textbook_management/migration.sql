-- CreateEnum
CREATE TYPE "TextbookStatus" AS ENUM ('CREATED', 'REQUESTED_BY_LEARNER', 'SHARED_WITH_MANAGER', 'SENT_TO_PRINT', 'PRINTED');

-- CreateTable
CREATE TABLE "textbooks" (
    "textbook_id" BIGSERIAL NOT NULL,
    "textbook_name" TEXT NOT NULL,
    "subject" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textbooks_pkey" PRIMARY KEY ("textbook_id")
);

-- CreateTable
CREATE TABLE "textbook_requests" (
    "request_id" BIGSERIAL NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "learner_id" BIGINT NOT NULL,
    "textbook_id" BIGINT NOT NULL,
    "creator_id" BIGINT NOT NULL,
    "current_status" "TextbookStatus" NOT NULL DEFAULT 'CREATED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "textbook_requests_pkey" PRIMARY KEY ("request_id")
);

-- CreateTable
CREATE TABLE "textbook_status_history" (
    "history_id" BIGSERIAL NOT NULL,
    "request_id" BIGINT NOT NULL,
    "status" "TextbookStatus" NOT NULL,
    "changed_by" BIGINT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "textbook_status_history_pkey" PRIMARY KEY ("history_id")
);

-- CreateIndex
CREATE INDEX "textbook_requests_learner_id_idx" ON "textbook_requests"("learner_id");

-- CreateIndex
CREATE INDEX "textbook_requests_creator_id_idx" ON "textbook_requests"("creator_id");

-- CreateIndex
CREATE INDEX "textbook_requests_textbook_id_idx" ON "textbook_requests"("textbook_id");

-- CreateIndex
CREATE INDEX "textbook_requests_current_status_idx" ON "textbook_requests"("current_status");

-- CreateIndex
CREATE INDEX "textbook_status_history_request_id_idx" ON "textbook_status_history"("request_id");

-- AddForeignKey
ALTER TABLE "textbook_requests" ADD CONSTRAINT "textbook_requests_learner_id_fkey" FOREIGN KEY ("learner_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "textbook_requests" ADD CONSTRAINT "textbook_requests_textbook_id_fkey" FOREIGN KEY ("textbook_id") REFERENCES "textbooks"("textbook_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "textbook_requests" ADD CONSTRAINT "textbook_requests_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "textbook_status_history" ADD CONSTRAINT "textbook_status_history_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "textbook_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "textbook_status_history" ADD CONSTRAINT "textbook_status_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
