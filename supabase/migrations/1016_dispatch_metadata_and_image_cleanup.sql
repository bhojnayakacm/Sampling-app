-- ============================================================
-- Migration 1016: Dispatch metadata + automated image cleanup
-- ============================================================
--
-- Adds the schema + storage + automation needed for the role-
-- aware dispatch workflow:
--
--   STEP 1.  requests.dispatch_metadata JSONB
--            Single column holds the entire structured dispatch
--            payload (courier / company-vehicle / field-boy
--            specifics plus the uploaded image URLs). JSONB keeps
--            us from needing N narrow columns per delivery mode,
--            while still being queryable and indexable later.
--
--   STEP 2.  Storage bucket `dispatch-images` (public read,
--            role-gated insert). RLS policies on storage.objects
--            so only Coordinator + Dispatcher + Admin can write,
--            and only authenticated callers can read. Service
--            role (used by the cleanup edge function) bypasses
--            RLS for DELETE — there is no user-facing delete.
--
--   STEP 3.  AFTER UPDATE trigger on requests that fires WHEN
--            status transitions to 'received'. The trigger POSTs
--            to `cleanup-request-images` (a Deno edge function)
--            with the request_id; that function performs the
--            actual storage purge with the service role key.
--            See ARCHITECTURAL NOTES at the bottom of this file.
--
-- IDEMPOTENCE
--   All statements are guarded with IF NOT EXISTS / CREATE OR
--   REPLACE / DROP TRIGGER IF EXISTS so this migration is safe to
--   re-apply.
--
-- PREREQS (all from migration 1010)
--   * pg_net + supabase_vault extensions
--   * vault secret `push_webhook_secret`
--   * REPLICA IDENTITY FULL on requests
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1 — Schema: dispatch_metadata
-- ============================================================
-- One JSONB column for everything coordinator/dispatcher captures
-- at dispatch time. The shape is documented in src/types/index.ts
-- (DispatchMetadata interface); the DB does not enforce a schema
-- here so we keep flexibility for future delivery modes. A NULL
-- value means the request has never been dispatched (legacy rows
-- + drafts).

ALTER TABLE public.requests
    ADD COLUMN IF NOT EXISTS dispatch_metadata JSONB;

COMMENT ON COLUMN public.requests.dispatch_metadata IS
'Structured dispatch payload written at the moment of dispatch. Shape: '
'{ type: courier|company_vehicle|field_boy, images: text[], note?: text, '
'courier_service?, courier_other_name?, driver_name?, driver_phone?, '
'field_boy? }. Source of truth for the new dispatch workflow (migration 1016). '
'NULL on legacy rows + anything that has never been dispatched.';

-- ============================================================
-- STEP 2 — Storage bucket: dispatch-images
-- ============================================================
-- Public bucket so the requester can view the package photos on
-- the request detail page via getPublicUrl(). Write access is
-- gated by the storage.objects policies in STEP 3.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dispatch-images',
  'dispatch-images',
  TRUE,
  10485760,                                      -- 10 MB per object
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STEP 3 — Storage RLS: dispatch-images
-- ============================================================
-- INSERT: Coordinator (legacy + marble + magro) + Dispatcher +
--         Admin can upload.
-- SELECT: any authenticated user can read.
-- UPDATE/DELETE: no user-facing policy. The cleanup edge function
--                uses the service role key which bypasses RLS.

DROP POLICY IF EXISTS "dispatch_images_insert_authorized_roles" ON storage.objects;
CREATE POLICY "dispatch_images_insert_authorized_roles"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'dispatch-images'
    AND EXISTS (
      SELECT 1
        FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.is_active = TRUE
         AND p.role IN (
           'admin',
           'coordinator',
           'marble_coordinator',
           'magro_coordinator',
           'dispatcher'
         )
    )
  );

DROP POLICY IF EXISTS "dispatch_images_select_authenticated" ON storage.objects;
CREATE POLICY "dispatch_images_select_authenticated"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'dispatch-images');

-- ============================================================
-- STEP 4 — Cleanup trigger function
-- ============================================================
-- Posts the request_id to the `cleanup-request-images` edge
-- function. The edge function performs the actual storage purge
-- with the service role key (so it can DELETE from storage and
-- write back to the DB to null out the now-dangling image_url
-- references).
--
-- DESIGN CHOICE — Database Trigger + Edge Function
-- ────────────────────────────────────────────────
-- The brief asked us to choose the most fault-tolerant of three
-- options: (a) client-side delete, (b) RPC that updates status +
-- cleans up, (c) DB trigger + edge function. We picked (c) for
-- four reasons:
--
--   1. The status UPDATE that triggers cleanup happens inside the
--      requester's normal write transaction — that transaction is
--      authoritative. The cleanup is dispatched AFTER COMMIT via
--      pg_net's async http_post, so a slow / failing storage
--      delete CANNOT roll back the status change.
--
--   2. EXCEPTION WHEN OTHERS at the bottom of the function means
--      any error in the cleanup path is logged as a WARNING and
--      the trigger still returns NEW. The status flip is never
--      blocked.
--
--   3. Cleanup is idempotent on the edge function side (re-running
--      it on a request whose images are already deleted is a
--      no-op). Manual retry from SQL or a maintenance cron is
--      therefore safe.
--
--   4. We re-use the existing push_webhook_secret + pg_net plumbing
--      from migrations 1010 / 1014 instead of standing up a new
--      auth path. One secret, one trust boundary.
--
-- Compared to a client-side delete (option a), this survives the
-- user closing the tab mid-flush. Compared to a server-side RPC
-- (option b), this keeps the storage SDK and the SQL update in
-- separate failure domains.

CREATE OR REPLACE FUNCTION public.notify_cleanup_request_images()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_edge_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/cleanup-request-images';
  v_secret TEXT;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_cleanup_request_images: vault secret missing — skipping cleanup';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object(
      'request_id',     NEW.id,
      'request_number', NEW.request_number
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Hard contract: storage cleanup failure must NEVER roll back the
  -- received-status update. Log and move on. Manual retry is safe
  -- (the edge function is idempotent).
  RAISE WARNING 'notify_cleanup_request_images failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_cleanup_request_images IS
'Trigger fn for requests AFTER UPDATE — when status transitions to '
'''received'', POSTs the request_id to the cleanup-request-images edge '
'function so reference + dispatch images can be purged from storage. '
'Async via pg_net; never blocks the status update.';

-- ============================================================
-- STEP 5 — Trigger
-- ============================================================
-- WHEN guards make the trigger function a no-op for every UPDATE
-- that isn't the transition we care about. Cheap.

DROP TRIGGER IF EXISTS trg_notify_cleanup_request_images ON public.requests;
CREATE TRIGGER trg_notify_cleanup_request_images
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status = 'received'
  )
  EXECUTE FUNCTION public.notify_cleanup_request_images();

COMMENT ON TRIGGER trg_notify_cleanup_request_images ON public.requests IS
'Fires cleanup-request-images edge function when a request enters the '
'received state. Removes both reference images (request_items.image_url) '
'and dispatch images (requests.dispatch_metadata->images) from storage.';

-- ============================================================
-- STEP 6 — Sanity verification
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'requests'
       AND column_name  = 'dispatch_metadata'
  ) THEN
    RAISE EXCEPTION 'Migration 1016 FAILED — dispatch_metadata column missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'dispatch-images'
  ) THEN
    RAISE EXCEPTION 'Migration 1016 FAILED — dispatch-images bucket missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'notify_cleanup_request_images'
  ) THEN
    RAISE EXCEPTION 'Migration 1016 FAILED — cleanup trigger function missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'trg_notify_cleanup_request_images'
  ) THEN
    RAISE EXCEPTION 'Migration 1016 FAILED — cleanup trigger missing.';
  END IF;

  RAISE NOTICE
    'Migration 1016 OK — dispatch_metadata column, dispatch-images bucket, RLS, and cleanup trigger installed.';
END $$;

COMMIT;

-- ============================================================
-- ARCHITECTURAL NOTES — Image lifecycle
-- ============================================================
-- A request's images live in two places:
--
--   * sample-images bucket — reference photos uploaded by the
--     requester at creation time. URLs are stored on
--     request_items.image_url (one per item). Path convention:
--     <random>.<ext> (set by uploadSampleImage helper).
--
--   * dispatch-images bucket — package / receipt photos uploaded
--     by the coordinator/dispatcher at dispatch time. URLs are
--     stored on requests.dispatch_metadata->'images' (text array).
--     Path convention: <request_id>/<timestamp>-<n>.<ext>.
--
-- When the request enters the `received` state, BOTH sets need to
-- be purged. The cleanup-request-images edge function:
--
--   1. Reads request_items.image_url for the requester reference
--      photos, extracts the storage path, and calls
--      storage.from('sample-images').remove([paths]).
--   2. Reads requests.dispatch_metadata->'images' and removes
--      from storage.from('dispatch-images').
--   3. Lists everything under <request_id>/ in dispatch-images as
--      a safety net (catches any uploads whose URL was lost from
--      the JSONB payload due to a bug).
--   4. NULLs out request_items.image_url and zeroes the images
--      array in dispatch_metadata so the UI no longer renders
--      broken-image placeholders.
--
-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_notify_cleanup_request_images ON public.requests;
-- DROP FUNCTION IF EXISTS public.notify_cleanup_request_images();
-- DROP POLICY IF EXISTS "dispatch_images_insert_authorized_roles" ON storage.objects;
-- DROP POLICY IF EXISTS "dispatch_images_select_authenticated" ON storage.objects;
-- DELETE FROM storage.buckets WHERE id = 'dispatch-images';
-- ALTER TABLE public.requests DROP COLUMN IF EXISTS dispatch_metadata;
-- ============================================================
