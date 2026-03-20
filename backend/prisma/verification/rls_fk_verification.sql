-- Verification script for RLS hardening + FK indexes
-- Run manually in Supabase SQL Editor after applying migration.

-- 1) RLS status for all public tables
SELECT
  schemaname,
  tablename,
  rowsecurity AS rls_enabled,
  CASE WHEN rowsecurity THEN 'OK' ELSE 'MISSING_RLS' END AS status
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- 2) Any table in public still without RLS (should return zero rows)
SELECT
  schemaname,
  tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND rowsecurity = false
ORDER BY tablename;

-- 3) Policies currently configured in public
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  roles,
  permissive,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 4) Sensitive tables exposure check for anon/authenticated
-- Expected: no privileges for these roles on these tables.
SELECT
  grantee,
  table_schema,
  table_name,
  privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN (
    '_prisma_migrations',
    'UserSession',
    'PasswordResetToken',
    'EmailVerificationToken',
    'AssistantConversation',
    'AssistantMessage'
  )
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type;

-- 5) Required FK indexes introduced by the migration
-- Expected: all rows should be present with found = true.
WITH required_indexes(index_name) AS (
  VALUES
    ('MarketplaceAccount_userId_idx'),
    ('Product_userId_idx'),
    ('Product_marketplaceAccountId_idx'),
    ('Order_userId_idx'),
    ('Order_marketplaceAccountId_idx'),
    ('OrderItem_orderId_idx'),
    ('OrderItem_productId_idx'),
    ('AdditionalCost_userId_idx')
)
SELECT
  r.index_name,
  EXISTS (
    SELECT 1
    FROM pg_indexes i
    WHERE i.schemaname = 'public'
      AND i.indexname = r.index_name
  ) AS found
FROM required_indexes r
ORDER BY r.index_name;

-- 6) Optional: simulate authenticated user context (replace UUID)
-- This helps validate auth.uid() based filtering in SQL editor sessions.
-- BEGIN;
-- SET LOCAL ROLE authenticated;
-- SET LOCAL "request.jwt.claim.sub" = '00000000-0000-0000-0000-000000000000';
-- SELECT auth.uid() AS simulated_uid;
-- SELECT * FROM public."MarketplaceAccount";
-- ROLLBACK;
