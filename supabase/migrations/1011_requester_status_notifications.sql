-- ============================================================
-- Migration 1011: Requester status-change push notifications
-- ============================================================
-- Adds an AFTER UPDATE trigger on `requests` that alerts the
-- request's creator (the requester) as their request moves
-- through the pipeline. Mirrors the coordinator-side layer from
-- migration 1010 but targets a single user — the requester —
-- instead of fanning out to a category audience.
--
-- Prerequisites (all from migration 1010):
--   * `requests` is published in `supabase_realtime`
--   * `ALTER TABLE public.requests REPLICA IDENTITY FULL`
--     (needed by the realtime hook, not by this trigger)
--   * `pg_net` and `supabase_vault` extensions
--   * Vault secret `push_webhook_secret`
--   * `push_subscriptions` table
--
-- Transitions handled (everything else is silently ignored —
-- this is intentional, no spam on no-op status writes):
--   pending_approval -> approved        "Approved: ..."
--   pending_approval -> rejected        "Rejected: ..."
--   approved         -> assigned        "Assigned: ... <maker name>"
--   assigned         -> in_production   "In Production: ..."
--   * -> ready       AND pickup_responsibility =  'self_pickup'   "Ready: ..."
--   * -> dispatched  AND pickup_responsibility <> 'self_pickup'   "Dispatched: ..."
--
-- Column naming note: this app's table uses `created_by` for the
-- requester (not `requester_id`) and `pickup_responsibility` for
-- the delivery method (not `pickup_method`). The names below
-- match the actual schema (see migration 200).
-- ============================================================

-- ============================================================
-- STEP 1: TRIGGER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION public.notify_requester_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  -- Public endpoint — safe to hardcode (project ref is not a secret).
  v_edge_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-requester-push';

  v_message     TEXT;
  v_maker_name  TEXT;
  v_secret      TEXT;
BEGIN
  -- ── Resolve the per-transition message ────────────────────────
  -- The trigger's WHEN clause already guarantees OLD.status <>
  -- NEW.status, so the bare NEW.status checks below (ready /
  -- dispatched) implicitly mean "a transition INTO that status".
  -- If no rule matches, fall through to RETURN NEW without firing.

  IF OLD.status = 'pending_approval' AND NEW.status = 'approved' THEN
    v_message := 'Approved: Your request ' || NEW.request_number
              || ' has been approved.';

  ELSIF OLD.status = 'pending_approval' AND NEW.status = 'rejected' THEN
    v_message := 'Rejected: Your request ' || NEW.request_number
              || ' was rejected.';

  ELSIF OLD.status = 'approved' AND NEW.status = 'assigned' THEN
    SELECT full_name INTO v_maker_name
    FROM public.profiles
    WHERE id = NEW.assigned_to;

    v_message := 'Assigned: ' || NEW.request_number
              || ' has been assigned to '
              || COALESCE(NULLIF(TRIM(v_maker_name), ''), 'the Maker')
              || '.';

  ELSIF OLD.status = 'assigned' AND NEW.status = 'in_production' THEN
    v_message := 'In Production: Work has started on '
              || NEW.request_number || '.';

  ELSIF NEW.status = 'ready'
        AND NEW.pickup_responsibility = 'self_pickup' THEN
    v_message := 'Ready: ' || NEW.request_number
              || ' is ready. You can pick it up now.';

  ELSIF NEW.status = 'dispatched'
        AND NEW.pickup_responsibility IS DISTINCT FROM 'self_pickup' THEN
    v_message := 'Dispatched: ' || NEW.request_number
              || ' has been dispatched.';

  ELSE
    -- A status change we don't notify on (e.g. rejected -> pending_approval
    -- resubmission, dispatched -> received pickup confirmation, admin
    -- corrections, or ready/dispatched whose pickup-method gate fails).
    RETURN NEW;
  END IF;

  -- ── Defensive: a status row with no creator should be impossible,
  -- but if seen, drop silently rather than POST a no-op fan-out.
  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  -- ── Vault secret (same shared secret as send-request-push) ────
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_requester_status_change: vault secret "push_webhook_secret" is not set — skipping push dispatch';
    RETURN NEW;
  END IF;

  -- ── Dispatch to the requester-targeted edge function ──────────
  PERFORM net.http_post(
    url     := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object(
      'requester_id',   NEW.created_by,
      'request_id',     NEW.id,
      'request_number', NEW.request_number,
      'new_status',     NEW.status::text,
      'message',        v_message
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A push dispatch failure must NEVER roll back the user-facing UPDATE.
  RAISE WARNING 'notify_requester_status_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_requester_status_change IS
'Trigger function for requests UPDATE. Resolves the per-transition '
'notification text and posts it to the send-requester-push edge '
'function for delivery to the request''s creator (created_by). '
'Reads the webhook secret from Supabase Vault (name: push_webhook_secret).';

-- ============================================================
-- STEP 2: TRIGGER
-- ============================================================
-- AFTER UPDATE so the row has settled. WHEN clause filters at the
-- planner level — the function is not even called for non-status
-- updates (avoids parsing every row update of every field).
--
-- Coexists with `trigger_log_status_change` (migration 900): that
-- one writes to request_status_history, this one fans out a push.

DROP TRIGGER IF EXISTS trg_notify_requester_status_change ON public.requests;
CREATE TRIGGER trg_notify_requester_status_change
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.notify_requester_status_change();

COMMENT ON TRIGGER trg_notify_requester_status_change ON public.requests IS
'Fires send-requester-push for the six pipeline transitions defined '
'in notify_requester_status_change(). Other status changes are no-ops.';
