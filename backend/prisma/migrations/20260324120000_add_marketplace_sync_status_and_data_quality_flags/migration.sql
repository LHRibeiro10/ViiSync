-- AlterTable
ALTER TABLE "MarketplaceAccount"
  ADD COLUMN IF NOT EXISTS "autoSyncEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS "syncLastStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncLastFinishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "syncLastError" TEXT;

-- AlterTable
ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "marketplaceFeeMissing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "shippingFeeMissing" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "taxAmountMissing" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "OrderItem"
  ADD COLUMN IF NOT EXISTS "unitCostMissing" BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS "MarketplaceAccount_marketplace_integrationStatus_autoSyncEnabled_idx"
ON "MarketplaceAccount"("marketplace", "integrationStatus", "autoSyncEnabled");

CREATE INDEX IF NOT EXISTS "MarketplaceAccount_syncStatus_syncLastStartedAt_idx"
ON "MarketplaceAccount"("syncStatus", "syncLastStartedAt");
