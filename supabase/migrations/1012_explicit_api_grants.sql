-- ============================================================
-- Migration 1012: Explicit PostgREST GRANTs for public schema
-- ============================================================
--
-- WHY THIS EXISTS
--   Supabase is rolling out a breaking change to the Data API:
--   tables in the `public` schema are no longer automatically
--   exposed to PostgREST. Historically, projects shipped with a
--   blanket GRANT on every new public table to the `anon` and
--   `authenticated` roles; that default is going away. To keep
--   the React client (which talks to the REST endpoint via the
--   supabase-js `from(...).select / insert / update / delete`
--   methods) working after the change, we must declare GRANTs
--   explicitly on every table the frontend touches.
--
-- WHAT THIS DOES
--   * GRANT USAGE on schema `public` to anon + authenticated
--     (without it, the roles cannot even resolve table names).
--   * GRANT SELECT/INSERT/UPDATE/DELETE on every transactional
--     and reference table the React app reads or writes.
--   * GRANT SELECT on the `request_timeline` view (already
--     granted in earlier migrations; re-grant idempotently so
--     this file is the single source of truth going forward).
--   * GRANT USAGE, SELECT on the `request_number_seq` sequence
--     so INSERT into `requests` can evaluate the default
--     `nextval('request_number_seq')` expression as the
--     authenticated user.
--
-- WHAT THIS DOES *NOT* DO
--   * It does NOT bypass Row Level Security. Every table in this
--     migration already has RLS enabled with policies that
--     restrict reads/writes by `auth.uid()` and role. PostgREST
--     GRANTs are the *column-level* gate; RLS is the row-level
--     gate. Both must allow the operation for a request to
--     succeed.
--   * It does NOT grant any privileges on `auth.*` tables.
--   * It does NOT touch storage buckets or edge-function secrets.
--
-- IDEMPOTENCE
--   GRANT statements are idempotent in Postgres — running this
--   migration twice is a no-op on the second run.
--
-- ============================================================
-- ROLES
-- ============================================================
--   anon            — unauthenticated requests (no JWT). The app
--                     does not have a public-facing read path, so
--                     RLS will block anon at the row level on
--                     every table. Granting at the table level
--                     is harmless and keeps parity with
--                     Supabase's pre-change default behaviour.
--   authenticated   — logged-in users (any role). The actual
--                     per-role gating (requester vs coordinator
--                     vs maker vs admin) happens inside RLS
--                     policies via `get_my_role()`.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 1 — Schema-level USAGE
-- ------------------------------------------------------------
-- Required so PostgREST can resolve `public.foo` table names
-- against the schema's search path. Without it, every Data API
-- call returns a 404 even if the table itself is granted.

GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ------------------------------------------------------------
-- STEP 2 — Table-level CRUD grants
-- ------------------------------------------------------------
-- One GRANT per table for auditability. Frontend touch points
-- are listed beside each table; see src/lib/api/ for call sites.

-- profiles: AuthContext bootstraps the signed-in user's row;
-- coordinators read assignee profiles via the requests join.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.profiles
  TO anon, authenticated;

-- requests: full CRUD by requester/coordinator/maker (RLS
-- enforces who can do what on which row). Realtime publication
-- on this table is already configured in migration 1010.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.requests
  TO anon, authenticated;

-- request_items: child of requests; written via the
-- create_split_requests RPC and read directly by the dashboards.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.request_items
  TO anon, authenticated;

-- request_status_history: append-only audit trail; coordinator/
-- maker actions insert; everyone reads via request_timeline.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.request_status_history
  TO anon, authenticated;

-- push_subscriptions: one row per device per user; written by
-- the PWA push-enrollment flow (src/lib/push.ts).
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.push_subscriptions
  TO anon, authenticated;

-- product_templates: requester-saved bucket lists; CRUD by
-- their owner via src/lib/api/templates.ts.
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.product_templates
  TO anon, authenticated;

-- ------------------------------------------------------------
-- STEP 3 — View grant
-- ------------------------------------------------------------
-- request_timeline is a SECURITY INVOKER view that already
-- filters rows by role inside its WHERE clause. Authenticated
-- users only — there is no anon read path for status history.

GRANT SELECT ON public.request_timeline TO authenticated;

-- ------------------------------------------------------------
-- STEP 4 — Sequence grant
-- ------------------------------------------------------------
-- `requests.request_number` defaults to 'SMP-' ||
-- nextval('request_number_seq'). The sequence must be USAGE+
-- SELECT-able by the inserting user, otherwise the INSERT fails
-- with "permission denied for sequence request_number_seq".

GRANT USAGE, SELECT ON SEQUENCE public.request_number_seq TO authenticated;

-- ------------------------------------------------------------
-- STEP 5 — Sanity check
-- ------------------------------------------------------------
-- Lightweight verification that the expected grants are in
-- place. Raises if any of the listed tables is missing the
-- SELECT privilege for the authenticated role.

DO $$
DECLARE
    v_missing TEXT;
BEGIN
    SELECT string_agg(t, ', ' ORDER BY t)
      INTO v_missing
    FROM (
        VALUES
            ('profiles'),
            ('requests'),
            ('request_items'),
            ('request_status_history'),
            ('push_subscriptions'),
            ('product_templates')
    ) AS expected(t)
    WHERE NOT has_table_privilege(
              'authenticated',
              'public.' || t,
              'SELECT'
          );

    IF v_missing IS NOT NULL THEN
        RAISE EXCEPTION
            'Migration 1012 FAILED — authenticated role missing SELECT on: %',
            v_missing;
    END IF;

    RAISE NOTICE
        'Migration 1012 OK — anon/authenticated have CRUD on all 6 public tables.';
END $$;

COMMIT;

-- ============================================================
-- FUTURE-PROOFING — what to do for every NEW public table
-- ============================================================
--
-- When you add a new table in the `public` schema, append the
-- following stanza to the bottom of the migration that creates
-- it. Do NOT rely on Supabase's old "auto-expose to PostgREST"
-- behaviour — it is being removed.
--
--   -- Expose to the Data API (PostgREST)
--   GRANT SELECT, INSERT, UPDATE, DELETE
--     ON public.<your_new_table>
--     TO anon, authenticated;
--
--   -- If the table uses a SEQUENCE for its primary key or any
--   -- DEFAULT expression, also grant on the sequence:
--   GRANT USAGE, SELECT
--     ON SEQUENCE public.<your_new_sequence>
--     TO authenticated;
--
--   -- If the table is read via a view, grant on the view too:
--   GRANT SELECT ON public.<your_view> TO authenticated;
--
-- Reminders:
--   * Always pair GRANTs with an RLS policy. Open table-level
--     CRUD without RLS is a public data leak.
--   * `anon` only needs grants if a logged-out user genuinely
--     reads/writes this table (rare in this app). If unsure,
--     grant to `anon` and let RLS enforce row-level access —
--     denying at the table level for anon is also valid.
--   * Function-based access (RPCs) uses
--     `GRANT EXECUTE ON FUNCTION ... TO authenticated` — that
--     pattern is unchanged by the PostgREST default-grants
--     rollout, and we already follow it (see migrations
--     991, 996, 998, 1002, 1004-1009).
-- ============================================================
