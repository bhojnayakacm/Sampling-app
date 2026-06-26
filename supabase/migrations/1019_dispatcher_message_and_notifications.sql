-- ============================================================
-- Migration 1019: Pre-dispatch dispatcher message + notifications
-- ============================================================
--
-- WHY THIS EXISTS
--   Until now a dispatcher could only attach a note at the exact
--   moment of dispatch (DispatchDialog → dispatch_metadata.note /
--   dispatch_notes, written together with status='dispatched').
--   Field staff frequently need to communicate BEFORE dispatching —
--   e.g. "Picking this up tomorrow morning", "Need the gate code",
--   "Address looks wrong, please confirm". This migration adds a
--   dedicated pre-dispatch channel.
--
-- WHAT THIS ADDS
--   STEP 1.  requests.dispatcher_message TEXT
--            Free-text note a dispatcher leaves while the request is
--            still in the `ready` (pre-pickup) window. Distinct from
--            dispatch_notes (which is the post-dispatch courier label)
--            and from dispatch_metadata.note (captured at dispatch).
--
--   STEP 2.  RLS UPDATE policy letting a dispatcher write this column
--            WITHOUT changing status. The existing dispatch policy
--            ("Dispatchers can dispatch field_boy requests", migration
--            970) pins the outgoing status to 'dispatched' in its
--            WITH CHECK, so it cannot be used to update a row that
--            stays in `ready`. A second, narrowly-scoped permissive
--            policy is therefore required.
--
--   STEP 3.  Trigger fn + trigger that fan a push notification out to
--            BOTH the requester (send-requester-push, single user) AND
--            the responsible coordinators (send-request-push, category
--            fan-out) whenever dispatcher_message changes to a
--            non-null value. Reuses the entire pg_net + Vault + edge
--            function plumbing from migrations 1010 / 1011 / 1014.
--
-- IDEMPOTENCE
--   All statements guarded with IF NOT EXISTS / CREATE OR REPLACE /
--   DROP ... IF EXISTS so this migration is safe to re-apply.
--
-- PREREQS (all from migration 1010)
--   * pg_net + supabase_vault extensions
--   * vault secret `push_webhook_secret`
--   * push_subscriptions table
--   * edge functions send-requester-push + send-request-push deployed
-- ============================================================

BEGIN;

-- ============================================================
-- STEP 1 — Schema: dispatcher_message
-- ============================================================

ALTER TABLE public.requests
    ADD COLUMN IF NOT EXISTS dispatcher_message TEXT;

COMMENT ON COLUMN public.requests.dispatcher_message IS
'Free-text message a dispatcher leaves BEFORE dispatching, while the request '
'is still in the ready window. Visible to the requester + coordinators on the '
'request detail page. Distinct from dispatch_notes (post-dispatch courier '
'label) and dispatch_metadata.note (captured at the moment of dispatch).';

-- ============================================================
-- STEP 2 — RLS: dispatcher can write dispatcher_message on a
--          ready + field_boy request without changing status
-- ============================================================
-- PostgreSQL combines permissive policies for the same command with
-- OR, so this coexists with "Dispatchers can dispatch field_boy
-- requests" (970) — that one allows ready→dispatched, this one allows
-- a ready→ready edit. Both USING and WITH CHECK pin status='ready'
-- AND pickup_responsibility='field_boy', so this policy can never be
-- repurposed to flip status or touch a request outside the
-- dispatcher's pre-pickup scope.

DROP POLICY IF EXISTS "Dispatchers can message ready field_boy requests" ON public.requests;

CREATE POLICY "Dispatchers can message ready field_boy requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    public.get_my_role() = 'dispatcher'
    AND status = 'ready'
    AND pickup_responsibility = 'field_boy'
  )
  WITH CHECK (
    public.get_my_role() = 'dispatcher'
    AND status = 'ready'
    AND pickup_responsibility = 'field_boy'
  );

COMMENT ON POLICY "Dispatchers can message ready field_boy requests" ON public.requests IS
'Lets a dispatcher attach/edit dispatcher_message while a field_boy request is '
'still ready (pre-dispatch). Status is pinned to ready on both USING and WITH '
'CHECK so the policy cannot be used to change status or escape the ready scope.';

-- ============================================================
-- STEP 3 — Trigger fn: notify requester + coordinators
-- ============================================================
-- Posts to TWO edge functions on a single dispatcher_message change:
--   * send-requester-push  → NEW.created_by   (the requester)
--   * send-request-push    → category fan-out  (the coordinators)
-- The requester function derives its title from event_type; the
-- coordinator function (extended in this change) accepts optional
-- title/body overrides so the fan-out reads "Message from Dispatcher"
-- instead of its default "New <Category> Request".

CREATE OR REPLACE FUNCTION public.notify_dispatcher_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  v_requester_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-requester-push';
  v_coordinator_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-request-push';
  v_secret  TEXT;
  v_trimmed TEXT;
BEGIN
  -- Ignore writes that blank the message (the WHEN clause already
  -- requires NEW.dispatcher_message IS NOT NULL, this guards whitespace).
  v_trimmed := NULLIF(TRIM(NEW.dispatcher_message), '');
  IF v_trimmed IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_dispatcher_message: vault secret missing — skipping push';
    RETURN NEW;
  END IF;

  -- ── Requester (single user, created_by) ────────────────────
  -- The 'Message from Dispatcher: ' prefix is stripped by the edge
  -- function (colon < 24 chars) so the system notification body is
  -- just the dispatcher's text; the title comes from event_type.
  IF NEW.created_by IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_requester_url,
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := jsonb_build_object(
        'requester_id',   NEW.created_by,
        'request_id',     NEW.id,
        'request_number', NEW.request_number,
        'event_type',     'dispatcher_message',
        'message',        'Message from Dispatcher: ' || v_trimmed
      )
    );
  END IF;

  -- ── Coordinators (category fan-out) ────────────────────────
  -- send-request-push resolves the audience from `category`; skip if
  -- the request somehow has no category (defensive — a dispatch-stage
  -- request always has one).
  IF NEW.category IS NOT NULL THEN
    PERFORM net.http_post(
      url     := v_coordinator_url,
      headers := jsonb_build_object(
        'Content-Type',     'application/json',
        'x-webhook-secret', v_secret
      ),
      body    := jsonb_build_object(
        'request_id',     NEW.id,
        'request_number', NEW.request_number,
        'category',       NEW.category,
        'title',          'Message from Dispatcher',
        'body',           NEW.request_number || ': ' || v_trimmed
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A push dispatch failure must NEVER roll back the message write.
  RAISE WARNING 'notify_dispatcher_message failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_dispatcher_message IS
'Trigger fn for requests UPDATE — when dispatcher_message changes to a '
'non-null value, fans a push out to the requester (send-requester-push, '
'event_type=dispatcher_message) and to the category coordinators '
'(send-request-push with title/body override). Async via pg_net; never '
'blocks the write.';

-- ============================================================
-- STEP 4 — Trigger
-- ============================================================
-- WHEN clause keeps the function from being called for any UPDATE
-- that does not actually change the dispatcher_message.

DROP TRIGGER IF EXISTS trg_notify_dispatcher_message ON public.requests;
CREATE TRIGGER trg_notify_dispatcher_message
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (
    OLD.dispatcher_message IS DISTINCT FROM NEW.dispatcher_message
    AND NEW.dispatcher_message IS NOT NULL
  )
  EXECUTE FUNCTION public.notify_dispatcher_message();

COMMENT ON TRIGGER trg_notify_dispatcher_message ON public.requests IS
'Fires send-requester-push + send-request-push when a dispatcher adds or '
'edits the pre-dispatch dispatcher_message.';

-- ============================================================
-- STEP 5 — Sanity verification
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'requests'
       AND column_name  = 'dispatcher_message'
  ) THEN
    RAISE EXCEPTION 'Migration 1019 FAILED — dispatcher_message column missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename  = 'requests'
       AND policyname = 'Dispatchers can message ready field_boy requests'
  ) THEN
    RAISE EXCEPTION 'Migration 1019 FAILED — dispatcher message RLS policy missing.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_notify_dispatcher_message'
  ) THEN
    RAISE EXCEPTION 'Migration 1019 FAILED — dispatcher message trigger missing.';
  END IF;

  RAISE NOTICE 'Migration 1019 OK — dispatcher_message column, RLS policy, and notification trigger installed.';
END $$;

COMMIT;

-- ============================================================
-- ROLLBACK (manual, not part of migration)
-- ============================================================
-- DROP TRIGGER IF EXISTS trg_notify_dispatcher_message ON public.requests;
-- DROP FUNCTION IF EXISTS public.notify_dispatcher_message();
-- DROP POLICY IF EXISTS "Dispatchers can message ready field_boy requests" ON public.requests;
-- ALTER TABLE public.requests DROP COLUMN IF EXISTS dispatcher_message;
-- ============================================================
