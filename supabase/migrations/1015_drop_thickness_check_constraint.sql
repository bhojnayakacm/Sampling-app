-- ============================================================
-- Migration 1015: Drop leftover items_require_thickness CHECK
-- ============================================================
--
-- HOTFIX for production error 23514:
--   "new row for relation \"request_items\" violates check
--    constraint \"items_require_thickness\""
--
-- Migration 1013 made request_items.thickness nullable
-- (ALTER COLUMN ... DROP NOT NULL) so the post-deprecation
-- frontend could insert NULL. We missed the explicit table-level
-- CHECK constraint installed by an earlier migration, which is
-- still enforcing thickness presence and now rejects every new
-- request submission.
--
-- DROP CONSTRAINT IF EXISTS is idempotent — re-running the
-- migration on a database where the constraint is already gone
-- is a no-op. The post-migration verification block below
-- asserts the constraint is genuinely absent so a silent failure
-- can't ship as "applied".
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 1 — Drop the obsolete CHECK constraint
-- ------------------------------------------------------------
-- Safe even if the constraint was never created (IF EXISTS),
-- safe in production transactions (no table rewrite — DROP
-- CONSTRAINT only touches the catalog).

ALTER TABLE public.request_items
    DROP CONSTRAINT IF EXISTS items_require_thickness;

-- ------------------------------------------------------------
-- STEP 2 — Sanity verification
-- ------------------------------------------------------------
-- pg_constraint is the authoritative catalog for CHECKs; we
-- look it up by name + relation rather than by definition text
-- so a renamed clone wouldn't sneak past us.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM pg_constraint c
          JOIN pg_class      t ON t.oid = c.conrelid
          JOIN pg_namespace  n ON n.oid = t.relnamespace
         WHERE n.nspname = 'public'
           AND t.relname = 'request_items'
           AND c.conname = 'items_require_thickness'
    ) THEN
        RAISE EXCEPTION
          'Migration 1015 FAILED — items_require_thickness still present on public.request_items';
    END IF;

    RAISE NOTICE
      'Migration 1015 OK — items_require_thickness constraint removed (or already absent).';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- Re-asserting the constraint would require backfilling any
-- post-1013 rows that wrote NULL into thickness. If that ever
-- becomes necessary:
--
--   ALTER TABLE public.request_items
--       ADD CONSTRAINT items_require_thickness
--       CHECK (thickness IS NOT NULL)
--       NOT VALID;                  -- skip the table scan
--   ALTER TABLE public.request_items
--       VALIDATE CONSTRAINT items_require_thickness;  -- after backfill
-- ============================================================
