-- ============================================================
-- Migration 1017: Quality edit audit + silent coordinator edit RPC + push trigger
-- ============================================================
--
-- WHY THIS EXISTS
--   Requesters can type custom product qualities (e.g. "abc" vs
--   "Abc"). To avoid rejecting an entire request over a typo, we
--   let coordinators silently correct the quality WITHOUT requiring
--   a reason — but only while the request is still pending approval.
--   The original string is captured into `original_quality` so the
--   provenance is never lost.
--
--   This migration installs:
--     1. `request_items.original_quality TEXT`  (sticky on first edit)
--     2. RPC `coordinator_edit_item_quality(p_item_id, p_new_quality)`
--          - caller must be coordinator/admin
--          - parent request must be in `pending_approval`
--          - first edit captures original; subsequent edits do not
--            overwrite it
--          - NO reason field (frictionless save, by design)
--     3. Trigger `trg_notify_quality_change` on request_items UPDATE
--          - fires send-requester-push (event_type='quality_change')
--          - dispatched to the request creator only
--          - re-uses the vault `push_webhook_secret` from 1010
--
-- IDEMPOTENCE
--   All statements are guarded (IF NOT EXISTS / CREATE OR REPLACE /
--   DROP TRIGGER IF EXISTS) — safe to re-run.
--
-- PREREQS (all from prior migrations)
--   * 1010: pg_net, supabase_vault, `push_webhook_secret` vault entry
--   * 1011 / 1014: send-requester-push edge function deployed and
--     extended to recognise event_type='quality_change'
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- STEP 1 — Schema: request_items.original_quality
-- ------------------------------------------------------------

ALTER TABLE public.request_items
    ADD COLUMN IF NOT EXISTS original_quality TEXT;

COMMENT ON COLUMN public.request_items.original_quality IS
'The quality value at the time of the FIRST coordinator edit. Sticky — '
'never overwritten on subsequent edits. NULL implies the quality has '
'never been edited; the UI uses NULL/non-NULL as the "(Edited)" flag.';

-- ------------------------------------------------------------
-- STEP 2 — RPC: coordinator_edit_item_quality
-- ------------------------------------------------------------
-- Mirrors `coordinator_edit_item_size` (migration 1013) but
-- explicitly drops the reason parameter — silent typo correction
-- is the whole point of this flow.

CREATE OR REPLACE FUNCTION public.coordinator_edit_item_quality(
    p_item_id     UUID,
    p_new_quality TEXT
)
RETURNS public.request_items
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_caller_role     TEXT;
    v_existing_row    public.request_items%ROWTYPE;
    v_parent_status   TEXT;
    v_updated_row     public.request_items%ROWTYPE;
    v_clean_quality   TEXT;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
    END IF;

    SELECT role
      INTO v_caller_role
      FROM public.profiles
     WHERE id = auth.uid();

    IF v_caller_role NOT IN ('coordinator', 'marble_coordinator', 'magro_coordinator', 'admin') THEN
        RAISE EXCEPTION 'Permission denied: only coordinators may edit item qualities'
            USING ERRCODE = '42501';
    END IF;

    v_clean_quality := NULLIF(TRIM(p_new_quality), '');

    IF v_clean_quality IS NULL THEN
        RAISE EXCEPTION 'New quality must not be empty' USING ERRCODE = '22023';
    END IF;

    -- Lock the row we're about to edit.
    SELECT *
      INTO v_existing_row
      FROM public.request_items
     WHERE id = p_item_id
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Request item % not found', p_item_id
            USING ERRCODE = 'P0002';
    END IF;

    -- Enforce status gate: edits are only allowed while the parent
    -- request is still pending approval. Once approved, dispatched,
    -- received, etc., the quality is permanently frozen — matches
    -- the requirement in the original task spec.
    SELECT status
      INTO v_parent_status
      FROM public.requests
     WHERE id = v_existing_row.request_id;

    IF v_parent_status IS DISTINCT FROM 'pending_approval' THEN
        RAISE EXCEPTION 'Quality can only be edited while the request is pending approval (current status: %)', v_parent_status
            USING ERRCODE = '22023';
    END IF;

    -- No-op short circuit: if the new value is identical to the
    -- current one (after trimming), don't churn the audit columns
    -- or fire the push trigger.
    IF v_clean_quality = v_existing_row.quality THEN
        RETURN v_existing_row;
    END IF;

    UPDATE public.request_items
       SET quality          = v_clean_quality,
           original_quality = COALESCE(v_existing_row.original_quality, v_existing_row.quality),
           updated_at       = NOW()
     WHERE id = p_item_id
     RETURNING * INTO v_updated_row;

    RETURN v_updated_row;
END;
$$;

GRANT EXECUTE ON FUNCTION public.coordinator_edit_item_quality(UUID, TEXT) TO authenticated;

COMMENT ON FUNCTION public.coordinator_edit_item_quality IS
'Silent coordinator-only quality typo fix. Captures original_quality '
'on first edit, refuses to act if parent request has moved past '
'pending_approval, and intentionally does NOT take a reason argument.';

-- ------------------------------------------------------------
-- STEP 3 — Trigger fn: notify requester on quality change
-- ------------------------------------------------------------
-- Pattern mirrors notify_required_by_change in migration 1014 —
-- read the vault secret, POST to send-requester-push with a new
-- event_type so the edge function picks the right title.
--
-- The trigger fires on ANY quality change to a request_items row,
-- not just edits via the RPC. As of 2026-06, the only code path
-- that UPDATEs request_items.quality on a non-draft request is the
-- RPC above; drafts use delete-and-reinsert via updateRequestWithItems.

CREATE OR REPLACE FUNCTION public.notify_quality_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_edge_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-requester-push';
  v_secret         TEXT;
  v_parent_request RECORD;
  v_message        TEXT;
  v_original       TEXT;
BEGIN
  -- Pull the parent request — we need created_by (requester id) and
  -- the request_number for the push body.
  SELECT id, request_number, created_by
    INTO v_parent_request
    FROM public.requests
   WHERE id = NEW.request_id;

  IF NOT FOUND OR v_parent_request.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- "Original" for the message text is whatever original_quality
  -- holds. The trigger fires AFTER UPDATE, so the new row already
  -- has original_quality populated (captured by the RPC on the
  -- first edit, COALESCEd to its previous value on subsequent
  -- edits). Fall back to OLD.quality just in case original_quality
  -- is somehow NULL — never want the message to read "from null".
  v_original := COALESCE(NEW.original_quality, OLD.quality, '(unknown)');

  v_message := 'Quality Updated: '
            || 'The quality for your requested item was updated from "'
            || v_original
            || '" to "'
            || NEW.quality
            || '" on '
            || v_parent_request.request_number
            || '.';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_quality_change: vault secret missing — skipping push';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object(
      'requester_id',   v_parent_request.created_by,
      'request_id',     v_parent_request.id,
      'request_number', v_parent_request.request_number,
      'event_type',     'quality_change',
      'message',        v_message
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Trigger failures must never block the underlying UPDATE — log
  -- and let the row write through.
  RAISE WARNING 'notify_quality_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_quality_change IS
'Trigger fn for request_items UPDATE — posts a quality-change push '
'(event_type=quality_change) to the parent request''s creator via '
'send-requester-push.';

-- ------------------------------------------------------------
-- STEP 4 — Trigger wire-up
-- ------------------------------------------------------------
-- WHEN clause keeps the function body out of any UPDATE that does
-- not actually touch quality. The IS DISTINCT FROM check tolerates
-- NULL on either side without surprises.

DROP TRIGGER IF EXISTS trg_notify_quality_change ON public.request_items;
CREATE TRIGGER trg_notify_quality_change
  AFTER UPDATE ON public.request_items
  FOR EACH ROW
  WHEN (OLD.quality IS DISTINCT FROM NEW.quality)
  EXECUTE FUNCTION public.notify_quality_change();

COMMENT ON TRIGGER trg_notify_quality_change ON public.request_items IS
'Fires send-requester-push (event_type=quality_change) whenever a '
'coordinator updates an item''s quality after submission.';

-- ------------------------------------------------------------
-- STEP 5 — Sanity verification
-- ------------------------------------------------------------

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name   = 'request_items'
           AND column_name  = 'original_quality'
    ) THEN
        RAISE EXCEPTION 'Migration 1017 FAILED — original_quality column missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'coordinator_edit_item_quality'
    ) THEN
        RAISE EXCEPTION 'Migration 1017 FAILED — coordinator_edit_item_quality RPC missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
           AND p.proname = 'notify_quality_change'
    ) THEN
        RAISE EXCEPTION 'Migration 1017 FAILED — notify_quality_change trigger fn missing.';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
         WHERE tgname = 'trg_notify_quality_change'
    ) THEN
        RAISE EXCEPTION 'Migration 1017 FAILED — trg_notify_quality_change trigger missing.';
    END IF;

    RAISE NOTICE 'Migration 1017 OK — original_quality column, RPC, trigger fn, and trigger installed.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- DROP TRIGGER  IF EXISTS trg_notify_quality_change       ON public.request_items;
-- DROP FUNCTION IF EXISTS public.notify_quality_change();
-- DROP FUNCTION IF EXISTS public.coordinator_edit_item_quality(UUID, TEXT);
-- ALTER TABLE   public.request_items DROP COLUMN IF EXISTS original_quality;
-- ============================================================
