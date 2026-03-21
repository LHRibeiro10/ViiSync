ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "blockedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "blockReason" TEXT;

CREATE INDEX IF NOT EXISTS "User_status_blockedAt_idx"
  ON "User"("status", "blockedAt");