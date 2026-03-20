-- Harden Supabase/PostgreSQL security and FK performance for Prisma-managed tables.
-- Hypothesis adopted (safest default):
-- 1) Seller business tables are user-owned (directly by userId or indirectly via parent relations).
-- 2) Sensitive/system tables are backend-only and must not be exposed to authenticated/anon clients.
-- 3) auth.uid() maps to application user ids stored as text UUIDs.

-- ==============================
-- Performance: missing FK indexes
-- ==============================
CREATE INDEX IF NOT EXISTS "MarketplaceAccount_userId_idx"
  ON public."MarketplaceAccount" ("userId");

CREATE INDEX IF NOT EXISTS "Product_userId_idx"
  ON public."Product" ("userId");

CREATE INDEX IF NOT EXISTS "Product_marketplaceAccountId_idx"
  ON public."Product" ("marketplaceAccountId");

CREATE INDEX IF NOT EXISTS "Order_userId_idx"
  ON public."Order" ("userId");

CREATE INDEX IF NOT EXISTS "Order_marketplaceAccountId_idx"
  ON public."Order" ("marketplaceAccountId");

CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx"
  ON public."OrderItem" ("orderId");

CREATE INDEX IF NOT EXISTS "OrderItem_productId_idx"
  ON public."OrderItem" ("productId");

CREATE INDEX IF NOT EXISTS "AdditionalCost_userId_idx"
  ON public."AdditionalCost" ("userId");

-- ===========================================
-- Security: enable RLS on all public tables
-- ===========================================
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrganizationMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserSession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PasswordResetToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."EmailVerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MarketplaceAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Product" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ProductCost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Order" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."OrderItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AdditionalCost" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AssistantConversation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AssistantMessage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;

-- =========================================
-- Security: remove anon grants explicitly
-- =========================================
REVOKE ALL ON TABLE public."User" FROM anon;
REVOKE ALL ON TABLE public."Organization" FROM anon;
REVOKE ALL ON TABLE public."OrganizationMembership" FROM anon;
REVOKE ALL ON TABLE public."UserSession" FROM anon;
REVOKE ALL ON TABLE public."PasswordResetToken" FROM anon;
REVOKE ALL ON TABLE public."EmailVerificationToken" FROM anon;
REVOKE ALL ON TABLE public."MarketplaceAccount" FROM anon;
REVOKE ALL ON TABLE public."Product" FROM anon;
REVOKE ALL ON TABLE public."ProductCost" FROM anon;
REVOKE ALL ON TABLE public."Order" FROM anon;
REVOKE ALL ON TABLE public."OrderItem" FROM anon;
REVOKE ALL ON TABLE public."AdditionalCost" FROM anon;
REVOKE ALL ON TABLE public."AssistantConversation" FROM anon;
REVOKE ALL ON TABLE public."AssistantMessage" FROM anon;
REVOKE ALL ON TABLE public."_prisma_migrations" FROM anon;

-- ==================================================================
-- Security: backend-only sensitive tables (deny authenticated client)
-- ==================================================================
-- These tables contain internal/session/token/system data and are not
-- intended for direct frontend access through PostgREST.
REVOKE ALL ON TABLE public."UserSession" FROM authenticated;
REVOKE ALL ON TABLE public."PasswordResetToken" FROM authenticated;
REVOKE ALL ON TABLE public."EmailVerificationToken" FROM authenticated;
REVOKE ALL ON TABLE public."AssistantConversation" FROM authenticated;
REVOKE ALL ON TABLE public."AssistantMessage" FROM authenticated;
REVOKE ALL ON TABLE public."_prisma_migrations" FROM authenticated;

-- ========================================
-- RLS policies: User profile (own record)
-- ========================================
-- Reason: an authenticated user can read only its own profile row.
DROP POLICY IF EXISTS "user_select_own" ON public."User";
CREATE POLICY "user_select_own"
  ON public."User"
  FOR SELECT
  TO authenticated
  USING ("id" = auth.uid()::text);

-- =============================================================
-- RLS policies: Organization and membership (read by membership)
-- =============================================================
-- Reason: user may read only organizations where it is a member.
DROP POLICY IF EXISTS "organization_select_member" ON public."Organization";
CREATE POLICY "organization_select_member"
  ON public."Organization"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."OrganizationMembership" om
      WHERE om."organizationId" = "Organization"."id"
        AND om."userId" = auth.uid()::text
    )
  );

-- Reason: user may read only its own membership rows.
DROP POLICY IF EXISTS "organization_membership_select_own" ON public."OrganizationMembership";
CREATE POLICY "organization_membership_select_own"
  ON public."OrganizationMembership"
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- ===============================================
-- RLS policies: MarketplaceAccount (direct owner)
-- ===============================================
-- Reason: user can only CRUD marketplace accounts where userId is own id.
DROP POLICY IF EXISTS "marketplace_account_select_own" ON public."MarketplaceAccount";
CREATE POLICY "marketplace_account_select_own"
  ON public."MarketplaceAccount"
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "marketplace_account_insert_own" ON public."MarketplaceAccount";
CREATE POLICY "marketplace_account_insert_own"
  ON public."MarketplaceAccount"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "marketplace_account_update_own" ON public."MarketplaceAccount";
CREATE POLICY "marketplace_account_update_own"
  ON public."MarketplaceAccount"
  FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "marketplace_account_delete_own" ON public."MarketplaceAccount";
CREATE POLICY "marketplace_account_delete_own"
  ON public."MarketplaceAccount"
  FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- ======================================
-- RLS policies: Product (direct + parent)
-- ======================================
-- Reason: product must belong to user and optional linked account must also belong to user.
DROP POLICY IF EXISTS "product_select_own" ON public."Product";
CREATE POLICY "product_select_own"
  ON public."Product"
  FOR SELECT
  TO authenticated
  USING (
    "userId" = auth.uid()::text
    AND (
      "marketplaceAccountId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."MarketplaceAccount" ma
        WHERE ma."id" = "Product"."marketplaceAccountId"
          AND ma."userId" = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "product_insert_own" ON public."Product";
CREATE POLICY "product_insert_own"
  ON public."Product"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "userId" = auth.uid()::text
    AND (
      "marketplaceAccountId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."MarketplaceAccount" ma
        WHERE ma."id" = "Product"."marketplaceAccountId"
          AND ma."userId" = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "product_update_own" ON public."Product";
CREATE POLICY "product_update_own"
  ON public."Product"
  FOR UPDATE
  TO authenticated
  USING (
    "userId" = auth.uid()::text
    AND (
      "marketplaceAccountId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."MarketplaceAccount" ma
        WHERE ma."id" = "Product"."marketplaceAccountId"
          AND ma."userId" = auth.uid()::text
      )
    )
  )
  WITH CHECK (
    "userId" = auth.uid()::text
    AND (
      "marketplaceAccountId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."MarketplaceAccount" ma
        WHERE ma."id" = "Product"."marketplaceAccountId"
          AND ma."userId" = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "product_delete_own" ON public."Product";
CREATE POLICY "product_delete_own"
  ON public."Product"
  FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- ==================================================
-- RLS policies: ProductCost (ownership via Product)
-- ==================================================
-- Reason: user can CRUD cost rows only when parent product is owned by that user.
DROP POLICY IF EXISTS "product_cost_select_own" ON public."ProductCost";
CREATE POLICY "product_cost_select_own"
  ON public."ProductCost"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Product" p
      WHERE p."id" = "ProductCost"."productId"
        AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "product_cost_insert_own" ON public."ProductCost";
CREATE POLICY "product_cost_insert_own"
  ON public."ProductCost"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Product" p
      WHERE p."id" = "ProductCost"."productId"
        AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "product_cost_update_own" ON public."ProductCost";
CREATE POLICY "product_cost_update_own"
  ON public."ProductCost"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Product" p
      WHERE p."id" = "ProductCost"."productId"
        AND p."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Product" p
      WHERE p."id" = "ProductCost"."productId"
        AND p."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "product_cost_delete_own" ON public."ProductCost";
CREATE POLICY "product_cost_delete_own"
  ON public."ProductCost"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Product" p
      WHERE p."id" = "ProductCost"."productId"
        AND p."userId" = auth.uid()::text
    )
  );

-- ================================================
-- RLS policies: Order (direct owner + parent check)
-- ================================================
-- Reason: order must belong to user and reference only user's marketplace account.
DROP POLICY IF EXISTS "order_select_own" ON public."Order";
CREATE POLICY "order_select_own"
  ON public."Order"
  FOR SELECT
  TO authenticated
  USING (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public."MarketplaceAccount" ma
      WHERE ma."id" = "Order"."marketplaceAccountId"
        AND ma."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "order_insert_own" ON public."Order";
CREATE POLICY "order_insert_own"
  ON public."Order"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public."MarketplaceAccount" ma
      WHERE ma."id" = "Order"."marketplaceAccountId"
        AND ma."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "order_update_own" ON public."Order";
CREATE POLICY "order_update_own"
  ON public."Order"
  FOR UPDATE
  TO authenticated
  USING (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public."MarketplaceAccount" ma
      WHERE ma."id" = "Order"."marketplaceAccountId"
        AND ma."userId" = auth.uid()::text
    )
  )
  WITH CHECK (
    "userId" = auth.uid()::text
    AND EXISTS (
      SELECT 1
      FROM public."MarketplaceAccount" ma
      WHERE ma."id" = "Order"."marketplaceAccountId"
        AND ma."userId" = auth.uid()::text
    )
  );

DROP POLICY IF EXISTS "order_delete_own" ON public."Order";
CREATE POLICY "order_delete_own"
  ON public."Order"
  FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid()::text);

-- ==========================================================
-- RLS policies: OrderItem (ownership via Order and Product)
-- ==========================================================
-- Reason: user can CRUD item rows only if parent order is owned by user and
-- optional linked product (if present) also belongs to user.
DROP POLICY IF EXISTS "order_item_select_own" ON public."OrderItem";
CREATE POLICY "order_item_select_own"
  ON public."OrderItem"
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Order" o
      WHERE o."id" = "OrderItem"."orderId"
        AND o."userId" = auth.uid()::text
    )
    AND (
      "productId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."Product" p
        WHERE p."id" = "OrderItem"."productId"
          AND p."userId" = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "order_item_insert_own" ON public."OrderItem";
CREATE POLICY "order_item_insert_own"
  ON public."OrderItem"
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Order" o
      WHERE o."id" = "OrderItem"."orderId"
        AND o."userId" = auth.uid()::text
    )
    AND (
      "productId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."Product" p
        WHERE p."id" = "OrderItem"."productId"
          AND p."userId" = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "order_item_update_own" ON public."OrderItem";
CREATE POLICY "order_item_update_own"
  ON public."OrderItem"
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Order" o
      WHERE o."id" = "OrderItem"."orderId"
        AND o."userId" = auth.uid()::text
    )
    AND (
      "productId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."Product" p
        WHERE p."id" = "OrderItem"."productId"
          AND p."userId" = auth.uid()::text
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public."Order" o
      WHERE o."id" = "OrderItem"."orderId"
        AND o."userId" = auth.uid()::text
    )
    AND (
      "productId" IS NULL
      OR EXISTS (
        SELECT 1
        FROM public."Product" p
        WHERE p."id" = "OrderItem"."productId"
          AND p."userId" = auth.uid()::text
      )
    )
  );

DROP POLICY IF EXISTS "order_item_delete_own" ON public."OrderItem";
CREATE POLICY "order_item_delete_own"
  ON public."OrderItem"
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public."Order" o
      WHERE o."id" = "OrderItem"."orderId"
        AND o."userId" = auth.uid()::text
    )
  );

-- =============================================
-- RLS policies: AdditionalCost (direct owner)
-- =============================================
-- Reason: user can only CRUD additional cost rows where userId is own id.
DROP POLICY IF EXISTS "additional_cost_select_own" ON public."AdditionalCost";
CREATE POLICY "additional_cost_select_own"
  ON public."AdditionalCost"
  FOR SELECT
  TO authenticated
  USING ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "additional_cost_insert_own" ON public."AdditionalCost";
CREATE POLICY "additional_cost_insert_own"
  ON public."AdditionalCost"
  FOR INSERT
  TO authenticated
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "additional_cost_update_own" ON public."AdditionalCost";
CREATE POLICY "additional_cost_update_own"
  ON public."AdditionalCost"
  FOR UPDATE
  TO authenticated
  USING ("userId" = auth.uid()::text)
  WITH CHECK ("userId" = auth.uid()::text);

DROP POLICY IF EXISTS "additional_cost_delete_own" ON public."AdditionalCost";
CREATE POLICY "additional_cost_delete_own"
  ON public."AdditionalCost"
  FOR DELETE
  TO authenticated
  USING ("userId" = auth.uid()::text);
