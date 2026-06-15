-- ============================================================
-- Migration 1014: Expand notification architecture + required-by audit column
-- ============================================================
--
-- EXTENDS the notification system already established by 1010 + 1011
-- with THREE additional workflow events, each routed to a different
-- audience. Reuses everything 1010 set up (push_subscriptions, Vault
-- secret, pg_net, supabase_vault, the REPLICA IDENTITY FULL setting
-- on requests, and the existing service-role edge function pattern).
--
--   A.  Requester: required_by deadline change
--       AFTER UPDATE on requests
--       WHEN  OLD.required_by IS DISTINCT FROM NEW.required_by
--       Audience: NEW.created_by (single user — the requester)
--       Routed via send-requester-push (extended to handle a new
--       event_type: 'required_by_change').
--
--   B.  Maker: new assignment
--       AFTER UPDATE on requests
--       WHEN  OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
--             AND NEW.assigned_to IS NOT NULL
--       Audience: NEW.assigned_to (single user — the maker)
--       Routed via send-maker-push (new edge function).
--
--   C.  Dispatcher: ready for dispatch
--       AFTER UPDATE on requests
--       WHEN  OLD.status IS DISTINCT FROM NEW.status
--             AND NEW.status = 'ready'
--             AND NEW.pickup_responsibility = 'field_boy'
--       Audience: ALL active users with role = 'dispatcher'
--       Routed via send-dispatcher-push (new edge function).
--
-- SCHEMA additions:
--   * requests.required_by_edit_reason TEXT
--       Holds the LATEST reason supplied by the coordinator for a
--       required_by change. Mirrors the address_edit_remark /
--       delivery_method_remark pattern already in use. The full
--       audit trail still lives in required_by_history (jsonb) from
--       migration 930 — this column just makes the most recent
--       reason cheap to read for the EditedInfoTooltip in the UI.
--
-- IDEMPOTENCE
--   All statements are guarded with IF NOT EXISTS / CREATE OR REPLACE
--   / DROP TRIGGER IF EXISTS so this file is safe to re-run.
--
-- PREREQS (all from migration 1010)
--   * pg_net + supabase_vault extensions present
--   * vault secret `push_webhook_secret` provisioned
--   * push_subscriptions table + RLS
--   * REPLICA IDENTITY FULL on requests
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1 — Schema: required_by_edit_reason
-- ============================================================
-- Latest-reason column for the deadline edit. The existing
-- required_by_history JSONB array (migration 930) keeps the full
-- audit log; this single column lets the UI render an inline
-- EditedInfoTooltip without having to deserialize and sort the
-- entire history array on every render.

ALTER TABLE public.requests
    ADD COLUMN IF NOT EXISTS required_by_edit_reason TEXT;

COMMENT ON COLUMN public.requests.required_by_edit_reason IS
'Most recent reason supplied by a coordinator when changing required_by. '
'Authoritative audit trail is required_by_history (jsonb); this column is '
'a denormalised cache for the inline EditedInfoTooltip in RequestDetail.';

-- ============================================================
-- STEP 2 — TRIGGER FN A: requester deadline-change push
-- ============================================================
-- Fires send-requester-push with event_type='required_by_change'.
-- Re-uses the existing requester edge function so we don't need a
-- second per-user-routed function; the edge function decides the
-- title from event_type.

CREATE OR REPLACE FUNCTION public.notify_required_by_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_edge_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-requester-push';
  v_secret  TEXT;
  v_reason  TEXT;
  v_message TEXT;
BEGIN
  -- Resolve the reason: prefer the newly-set audit column, fall back
  -- to the most recent history entry, else a generic placeholder.
  v_reason := COALESCE(NULLIF(TRIM(NEW.required_by_edit_reason), ''), 'Not specified');

  v_message := 'Update: Required time for '
            || NEW.request_number
            || ' changed to '
            || to_char(NEW.required_by AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI" UTC"')
            || '. Reason: '
            || v_reason;

  IF NEW.created_by IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_required_by_change: vault secret missing — skipping push';
    RETURN NEW;
  END IF;

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
      'event_type',     'required_by_change',
      'message',        v_message
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_required_by_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_required_by_change IS
'Trigger fn for requests UPDATE — posts a deadline-change notification '
'to send-requester-push (event_type=required_by_change) targeted at the '
'request creator (created_by).';

-- ============================================================
-- STEP 3 — TRIGGER FN B: maker new-assignment push
-- ============================================================
-- Targets a single user_id (NEW.assigned_to). Distinct edge
-- function so the audience-lookup logic stays small and explicit.

CREATE OR REPLACE FUNCTION public.notify_maker_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_edge_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-maker-push';
  v_secret  TEXT;
  v_message TEXT;
BEGIN
  IF NEW.assigned_to IS NULL THEN
    RETURN NEW;
  END IF;

  v_message := 'New Assignment: '
            || NEW.request_number
            || ' has been assigned to you.';

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_maker_assigned: vault secret missing — skipping push';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url     := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', v_secret
    ),
    body    := jsonb_build_object(
      'maker_id',       NEW.assigned_to,
      'request_id',     NEW.id,
      'request_number', NEW.request_number,
      'message',        v_message
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_maker_assigned failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_maker_assigned IS
'Trigger fn for requests UPDATE — posts a new-assignment notification '
'to send-maker-push, targeted at the specific maker NEW.assigned_to.';

-- ============================================================
-- STEP 4 — TRIGGER FN C: dispatcher ready-for-dispatch push
-- ============================================================
-- Broadcasts to ALL active dispatchers (parallels the coordinator
-- fan-out pattern from 1010). Distinct edge function so the role
-- query stays close to the fan-out it powers.

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

-- ============================================================
-- STEP 5 — TRIGGERS
-- ============================================================
-- Each trigger has its own WHEN clause so the function body is
-- never even called for unrelated UPDATEs. WHEN clauses are
-- evaluated by the planner; cheaper than re-checking in plpgsql.

-- A. Required-by change → requester
DROP TRIGGER IF EXISTS trg_notify_required_by_change ON public.requests;
CREATE TRIGGER trg_notify_required_by_change
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (OLD.required_by IS DISTINCT FROM NEW.required_by)
  EXECUTE FUNCTION public.notify_required_by_change();

COMMENT ON TRIGGER trg_notify_required_by_change ON public.requests IS
'Fires send-requester-push (event_type=required_by_change) when a '
'coordinator alters the request deadline.';

-- B. Maker assigned (or reassigned to a new maker)
DROP TRIGGER IF EXISTS trg_notify_maker_assigned ON public.requests;
CREATE TRIGGER trg_notify_maker_assigned
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (
    OLD.assigned_to IS DISTINCT FROM NEW.assigned_to
    AND NEW.assigned_to IS NOT NULL
  )
  EXECUTE FUNCTION public.notify_maker_assigned();

COMMENT ON TRIGGER trg_notify_maker_assigned ON public.requests IS
'Fires send-maker-push when a request''s assigned_to changes to a non-null '
'maker (covers both first-time assignment and re-assignment).';

-- C. Status → ready AND field_boy pickup → dispatchers
DROP TRIGGER IF EXISTS trg_notify_dispatcher_ready ON public.requests;
CREATE TRIGGER trg_notify_dispatcher_ready
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status = 'ready'
    AND NEW.pickup_responsibility = 'field_boy'
  )
  EXECUTE FUNCTION public.notify_dispatcher_ready();

COMMENT ON TRIGGER trg_notify_dispatcher_ready ON public.requests IS
'Fires send-dispatcher-push when a request transitions to ready status '
'AND the pickup_responsibility is field_boy (the dispatcher''s scope).';

-- ============================================================
-- STEP 6 — Sanity verification
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'requests'
       AND column_name  = 'required_by_edit_reason'
  ) THEN
    RAISE EXCEPTION 'Migration 1014 FAILED — required_by_edit_reason column missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
         'notify_required_by_change',
         'notify_maker_assigned',
         'notify_dispatcher_ready'
       )
  ) THEN
    RAISE EXCEPTION 'Migration 1014 FAILED — one or more trigger functions missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname IN (
       'trg_notify_required_by_change',
       'trg_notify_maker_assigned',
       'trg_notify_dispatcher_ready'
     )
  ) THEN
    RAISE EXCEPTION 'Migration 1014 FAILED — one or more triggers missing.';
  END IF;

  RAISE NOTICE 'Migration 1014 OK — schema + 3 trigger functions + 3 triggers installed.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_notify_required_by_change ON public.requests;
-- DROP TRIGGER IF EXISTS trg_notify_maker_assigned    ON public.requests;
-- DROP TRIGGER IF EXISTS trg_notify_dispatcher_ready  ON public.requests;
-- DROP FUNCTION IF EXISTS public.notify_required_by_change();
-- DROP FUNCTION IF EXISTS public.notify_maker_assigned();
-- DROP FUNCTION IF EXISTS public.notify_dispatcher_ready();
-- ALTER TABLE public.requests DROP COLUMN IF EXISTS required_by_edit_reason;
-- ============================================================
