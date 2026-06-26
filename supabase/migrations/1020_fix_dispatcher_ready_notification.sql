-- ============================================================
-- Migration 1020: Fix dispatcher "ready for dispatch" notification
-- ============================================================
--
-- BUG REPORT
--   Dispatchers are not reliably notified when a field_boy sample
--   becomes ready for pickup.
--
-- ROOT CAUSE (two-part)
--   1. DEPLOYMENT (primary, fix outside this file): the
--      `send-dispatcher-push` edge function — introduced alongside
--      migration 1014, AFTER the original 1010/1011 push rollout —
--      was never deployed. The trigger (notify_dispatcher_ready) fires
--      correctly and POSTs to it via pg_net, but the function 404s.
--      Because pg_net is async/fire-and-forget AND the trigger fn
--      wraps everything in `EXCEPTION WHEN OTHERS → RETURN NEW`, the
--      failure is completely silent: the status update succeeds, no
--      error surfaces, no push is sent. Deploy with:
--        supabase functions deploy send-dispatcher-push \
--          --project-ref edexqvjbwbjasdsgejya --no-verify-jwt
--
--   2. TRIGGER GAP (fixed here): the WHEN clause only fired on a
--      STATUS transition into ready:
--        OLD.status IS DISTINCT FROM NEW.status
--        AND NEW.status = 'ready'
--        AND NEW.pickup_responsibility = 'field_boy'
--      So a request that is ALREADY `ready` (e.g. for self_pickup or
--      courier) and is later switched to field_boy by a coordinator's
--      delivery-method edit never re-triggers — the status didn't
--      change, so dispatchers are never told a package is now theirs.
--
-- THE FIX
--   Re-create the trigger so it fires when the row ENTERS the
--   (ready + field_boy) state via EITHER dimension changing:
--     * status            transitions to 'ready', OR
--     * pickup_responsibility transitions to 'field_boy'
--   while the OTHER condition already holds. It still never fires for
--   an unrelated edit on a row that was already ready + field_boy
--   (both OLD = NEW ⇒ the OR is false), so no duplicate spam.
--
--   The trigger FUNCTION (notify_dispatcher_ready) is unchanged in
--   behaviour but re-asserted here with CREATE OR REPLACE so that
--   applying this single migration fully re-establishes the DB side
--   of the path even if 1014 was never applied.
--
-- IDEMPOTENCE
--   CREATE OR REPLACE + DROP TRIGGER IF EXISTS — safe to re-run.
--
-- PREREQS (all from migration 1010)
--   * pg_net + supabase_vault extensions
--   * vault secret `push_webhook_secret`
--   * send-dispatcher-push edge function DEPLOYED (see root cause #1)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Trigger function — re-asserted (behaviour identical to 1014).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_dispatcher_ready()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_edge_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-dispatcher-push';
  v_secret  TEXT;
  v_message TEXT;
BEGIN
  v_message := 'Ready for Dispatch: '
            || NEW.request_number
            || ' is ready for delivery.';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_dispatcher_ready: vault secret missing — skipping push';
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
      'request_number', NEW.request_number,
      'message',        v_message
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_dispatcher_ready failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_dispatcher_ready IS
'Trigger fn for requests UPDATE — broadcasts a ready-for-dispatch '
'notification to all active dispatchers via send-dispatcher-push.';

-- ------------------------------------------------------------
-- Trigger — widened WHEN clause (the actual fix).
-- ------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_notify_dispatcher_ready ON public.requests;
CREATE TRIGGER trg_notify_dispatcher_ready
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (
    NEW.status = 'ready'
    AND NEW.pickup_responsibility = 'field_boy'
    AND (
      OLD.status IS DISTINCT FROM NEW.status
      OR OLD.pickup_responsibility IS DISTINCT FROM NEW.pickup_responsibility
    )
  )
  EXECUTE FUNCTION public.notify_dispatcher_ready();

COMMENT ON TRIGGER trg_notify_dispatcher_ready ON public.requests IS
'Fires send-dispatcher-push when a request ENTERS the (ready + field_boy) '
'state — whether via status→ready OR pickup_responsibility→field_boy. '
'Does not re-fire on unrelated edits once already in that state.';

-- ------------------------------------------------------------
-- Sanity verification
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'notify_dispatcher_ready'
  ) THEN
    RAISE EXCEPTION 'Migration 1020 FAILED — notify_dispatcher_ready function missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_dispatcher_ready'
  ) THEN
    RAISE EXCEPTION 'Migration 1020 FAILED — trg_notify_dispatcher_ready trigger missing.';
  END IF;

  RAISE NOTICE 'Migration 1020 OK — dispatcher ready notification trigger re-installed with widened WHEN clause.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, restores the migration-1014 behaviour)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_notify_dispatcher_ready ON public.requests;
-- CREATE TRIGGER trg_notify_dispatcher_ready
--   AFTER UPDATE ON public.requests
--   FOR EACH ROW
--   WHEN (OLD.status IS DISTINCT FROM NEW.status
--         AND NEW.status = 'ready'
--         AND NEW.pickup_responsibility = 'field_boy')
--   EXECUTE FUNCTION public.notify_dispatcher_ready();
-- ============================================================
