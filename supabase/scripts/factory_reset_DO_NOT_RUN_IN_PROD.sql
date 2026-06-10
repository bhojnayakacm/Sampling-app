-- ============================================================
-- FACTORY RESET — TRANSACTIONAL DATA ONLY
-- ============================================================
--
--  WARNING — DESTRUCTIVE  WARNING — DESTRUCTIVE  WARNING
--
--   This script TRUNCATES every transactional table in the
--   application. It is intended for STAGING / LOCAL / TEST
--   environments only. It MUST NOT be executed against a
--   production database.
--
--   Run only via the Supabase SQL Editor (or psql) AFTER you
--   have confirmed which project you are connected to.
--
-- ------------------------------------------------------------
-- WHAT THIS DOES
--   * TRUNCATEs:  requests, request_items, request_status_history,
--                 push_subscriptions, product_templates
--   * RESTARTs:   request_number_seq -> 1001
--                 (so the next request issued is SMP-1001)
--
-- WHAT THIS DOES *NOT* TOUCH (preserved verbatim)
--   * auth.users               — Supabase auth identities
--   * auth.sessions / tokens   — active login sessions
--   * public.profiles          — roles, names, departments, phones
--   * Storage buckets / files  — out of scope for SQL truncation
--
--   Result: every coordinator, maker, dispatcher, admin and
--   requester can still log in after this runs. They will simply
--   see an empty pipeline.
--
-- ------------------------------------------------------------
-- WHY THIS IS NOT A NUMBERED MIGRATION
--   It lives in supabase/scripts/ (NOT supabase/migrations/) so
--   that `supabase db push` and the migration runner will NEVER
--   execute it automatically. It must be invoked manually.
--
-- ------------------------------------------------------------
-- HOW TO RUN
--   1. Verify the project ref in the Supabase dashboard URL.
--   2. Paste the entire file into the SQL Editor.
--   3. Click Run.  Read the NOTICE output to confirm counts = 0.
--
--   The whole script is wrapped in a single transaction, so if
--   any step fails the database is left untouched.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 1 — Wipe transactional pipeline tables
-- ------------------------------------------------------------
-- Order is not significant because CASCADE follows FK chains,
-- but listing children before parents is the defensive default.
-- All listed tables have FKs onto profiles / requests, never
-- the other direction, so profiles is unaffected.

TRUNCATE TABLE
    public.request_status_history,
    public.request_items,
    public.push_subscriptions,
    public.product_templates,
    public.requests
RESTART IDENTITY CASCADE;

-- ------------------------------------------------------------
-- STEP 2 — Reset the SMP request-number sequence
-- ------------------------------------------------------------
-- request_number_seq is a standalone SEQUENCE (not an identity
-- column), so RESTART IDENTITY on the TRUNCATE above does NOT
-- reset it. Do it explicitly so the next submitted request is
-- SMP-1001, matching a fresh-install state.

ALTER SEQUENCE public.request_number_seq RESTART WITH 1001;

-- ------------------------------------------------------------
-- STEP 3 — Sanity check
-- ------------------------------------------------------------
-- Confirm that the wipe hit only what it was supposed to hit
-- and that the protected tables are untouched. Aborts the whole
-- transaction if anything looks wrong.

DO $$
DECLARE
    v_requests           BIGINT;
    v_items              BIGINT;
    v_history            BIGINT;
    v_push               BIGINT;
    v_templates          BIGINT;
    v_profiles           BIGINT;
    v_auth_users         BIGINT;
    v_next_request_seq   BIGINT;
BEGIN
    SELECT COUNT(*) INTO v_requests   FROM public.requests;
    SELECT COUNT(*) INTO v_items      FROM public.request_items;
    SELECT COUNT(*) INTO v_history    FROM public.request_status_history;
    SELECT COUNT(*) INTO v_push       FROM public.push_subscriptions;
    SELECT COUNT(*) INTO v_templates  FROM public.product_templates;
    SELECT COUNT(*) INTO v_profiles   FROM public.profiles;
    SELECT COUNT(*) INTO v_auth_users FROM auth.users;
    SELECT last_value INTO v_next_request_seq FROM public.request_number_seq;

    RAISE NOTICE '====== FACTORY RESET SUMMARY ======';
    RAISE NOTICE 'Wiped:';
    RAISE NOTICE '  requests                  : %', v_requests;
    RAISE NOTICE '  request_items             : %', v_items;
    RAISE NOTICE '  request_status_history    : %', v_history;
    RAISE NOTICE '  push_subscriptions        : %', v_push;
    RAISE NOTICE '  product_templates         : %', v_templates;
    RAISE NOTICE 'Preserved:';
    RAISE NOTICE '  profiles                  : % (must be > 0)', v_profiles;
    RAISE NOTICE '  auth.users                : % (must be > 0)', v_auth_users;
    RAISE NOTICE 'Next request number         : SMP-%', v_next_request_seq;
    RAISE NOTICE '===================================';

    IF v_requests + v_items + v_history + v_push + v_templates <> 0 THEN
        RAISE EXCEPTION 'Factory reset FAILED — at least one transactional table is non-empty after TRUNCATE.';
    END IF;

    IF v_profiles = 0 OR v_auth_users = 0 THEN
        RAISE EXCEPTION 'Factory reset ABORTED — profiles or auth.users was wiped. This script must never delete users.';
    END IF;

    RAISE NOTICE 'OK: pipeline is empty and all user accounts are intact.';
END $$;

COMMIT;

-- ============================================================
-- POST-RESET NOTES
-- ============================================================
-- * Existing users can keep using their saved password.
-- * Coordinator/requester push alerts will need to be re-enabled
--   from each browser, because push_subscriptions was wiped.
-- * Saved product_templates (bucket lists) are gone — if you
--   want to preserve them, remove `public.product_templates`
--   from the TRUNCATE list above before running.
-- * Existing storage objects (reference images, etc.) are NOT
--   touched by this script. Clean those up manually in the
--   Supabase Storage dashboard if you want a fully clean state.
-- ============================================================
