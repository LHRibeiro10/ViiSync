-- AlterTable
ALTER TABLE "MarketplaceAccount"
  ADD COLUMN IF NOT EXISTS "tokenType" TEXT,
  ADD COLUMN IF NOT EXISTS "scope" TEXT,
  ADD COLUMN IF NOT EXISTS "siteId" TEXT,
  ADD COLUMN IF NOT EXISTS "integrationStatus" TEXT NOT NULL DEFAULT 'disconnected',
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Product"
  ADD COLUMN IF NOT EXISTS "listingPrice" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "listingStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "availableQuantity" INTEGER,
  ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

-- Indexes
CREATE INDEX IF NOT EXISTS "MarketplaceAccount_userId_marketplace_integrationStatus_idx"
ON "MarketplaceAccount"("userId", "marketplace", "integrationStatus");

CREATE INDEX IF NOT EXISTS "Product_userId_marketplaceAccountId_listingStatus_idx"
ON "Product"("userId", "marketplaceAccountId", "listingStatus");
