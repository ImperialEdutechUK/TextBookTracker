-- CreateEnum
CREATE TYPE "RequestEventType" AS ENUM ('CREATED', 'PDF_ATTACHED', 'PDF_REMOVED', 'SENT_TO_PRINT', 'PRINTED', 'REVERTED');

-- CreateTable
CREATE TABLE "request_events" (
    "event_id" BIGSERIAL NOT NULL,
    "request_id" BIGINT NOT NULL,
    "type" "RequestEventType" NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_events_pkey" PRIMARY KEY ("event_id")
);

-- CreateIndex
CREATE INDEX "request_events_request_id_idx" ON "request_events"("request_id");

-- AddForeignKey
ALTER TABLE "request_events" ADD CONSTRAINT "request_events_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "textbook_requests"("request_id") ON DELETE CASCADE ON UPDATE CASCADE;
