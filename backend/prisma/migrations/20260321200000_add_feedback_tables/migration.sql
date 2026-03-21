-- CreateTable
CREATE TABLE "FeedbackTicket" (
    "id" TEXT NOT NULL,
    "ticketCode" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "sourcePath" TEXT,
    "adminResponse" TEXT,
    "resolutionEta" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackTicketHistory" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "actorType" TEXT NOT NULL,
    "responseText" TEXT,
    "resolutionEta" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedbackTicketHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackTicket_ticketCode_key" ON "FeedbackTicket"("ticketCode");

-- CreateIndex
CREATE INDEX "FeedbackTicket_userId_createdAt_idx" ON "FeedbackTicket"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackTicket_status_priority_createdAt_idx" ON "FeedbackTicket"("status", "priority", "createdAt");

-- CreateIndex
CREATE INDEX "FeedbackTicketHistory_ticketId_createdAt_idx" ON "FeedbackTicketHistory"("ticketId", "createdAt");

-- AddForeignKey
ALTER TABLE "FeedbackTicket" ADD CONSTRAINT "FeedbackTicket_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackTicketHistory" ADD CONSTRAINT "FeedbackTicketHistory_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "FeedbackTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
