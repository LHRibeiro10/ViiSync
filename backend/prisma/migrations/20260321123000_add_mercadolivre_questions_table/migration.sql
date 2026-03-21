-- CreateTable
CREATE TABLE "MercadoLivreQuestion" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "marketplaceAccountId" TEXT NOT NULL,
    "externalQuestionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "itemTitle" TEXT,
    "questionText" TEXT NOT NULL,
    "answerText" TEXT,
    "buyerNickname" TEXT,
    "thumbnail" TEXT,
    "sku" TEXT,
    "status" TEXT NOT NULL DEFAULT 'unanswered',
    "createdAtMl" TIMESTAMP(3) NOT NULL,
    "answeredAtMl" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "lastSyncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MercadoLivreQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MercadoLivreQuestion_marketplaceAccountId_externalQuestionId_key"
ON "MercadoLivreQuestion"("marketplaceAccountId", "externalQuestionId");

-- CreateIndex
CREATE INDEX "MercadoLivreQuestion_userId_marketplaceAccountId_dismissedAt_idx"
ON "MercadoLivreQuestion"("userId", "marketplaceAccountId", "dismissedAt");

-- CreateIndex
CREATE INDEX "MercadoLivreQuestion_userId_createdAtMl_idx"
ON "MercadoLivreQuestion"("userId", "createdAtMl");

-- CreateIndex
CREATE INDEX "MercadoLivreQuestion_itemId_idx"
ON "MercadoLivreQuestion"("itemId");

-- AddForeignKey
ALTER TABLE "MercadoLivreQuestion" ADD CONSTRAINT "MercadoLivreQuestion_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MercadoLivreQuestion" ADD CONSTRAINT "MercadoLivreQuestion_marketplaceAccountId_fkey"
FOREIGN KEY ("marketplaceAccountId") REFERENCES "MarketplaceAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
