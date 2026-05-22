-- ============================================================
-- Migration 1010: Realtime + Web Push Notifications
-- ============================================================
-- Implements the dual-layer "new request" alert system for
-- Marble / Magro coordinators:
--
--   1. Enables Supabase Realtime on `requests` so the client can
--      receive INSERT events and raise in-app toast notifications.
--   2. Creates `push_subscriptions` to store browser Web Push
--      endpoints (one row per device per user).
--   3. Adds AFTER INSERT / AFTER UPDATE triggers on `requests` that
--      call the `send-request-push` edge function — the database
--      webhook that fans out PWA system push notifications. The
--      UPDATE trigger covers a saved draft being submitted.
--
-- Routing note: a request's coordinator audience is derived from
-- `requests.category` ('marble' | 'magro'), which is set atomically
-- at submission time (see migration 996). Both the realtime filter
-- and the edge function key off that single column.
-- ============================================================

-- ============================================================
-- STEP 1: ENABLE REALTIME ON requests
-- ============================================================
-- Supabase ships a `supabase_realtime` publication; add `requests`
-- to it so postgres_changes INSERT + UPDATE events are streamed to
-- clients. Idempotent: safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;
  END IF;
END $$;

-- REPLICA IDENTITY FULL makes UPDATE events carry the *previous* row
-- in payload.old. The in-app listener needs old.status to detect the
-- draft -> pending_approval transition (a submitted draft) — without
-- it, payload.old would contain only the primary key. Idempotent.
ALTER TABLE public.requests REPLICA IDENTITY FULL;

-- ============================================================
-- STEP 2: CREATE push_subscriptions TABLE
-- ============================================================
-- Stores one Web Push subscription per browser/device. The unique
-- constraint on `endpoint` lets the client UPSERT on re-subscribe
-- and lets the edge function prune dead endpoints by endpoint.

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,           -- client public key (from PushSubscription)
  auth        TEXT NOT NULL,           -- client auth secret (from PushSubscription)
  user_agent  TEXT,                    -- diagnostic: which device/browser registered
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
  ON public.push_subscriptions(user_id);

COMMENT ON TABLE public.push_subscriptions IS
'Web Push (PWA) subscription endpoints. One row per browser/device. '
'Read by the send-request-push edge function via the service role key.';

-- ── RLS: a user may only manage their own subscriptions ──────
-- The edge function uses the service role key and bypasses RLS,
-- so no coordinator-facing read policy is required here.
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own push subscriptions" ON public.push_subscriptions;
CREATE POLICY "Users manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================================
-- STEP 3: DATABASE WEBHOOK — call the push edge function
-- ============================================================
-- pg_net lets Postgres make an async HTTP POST. The triggers below
-- post the request to the `send-request-push` edge function.
--
-- The edge function URL is not sensitive (the project ref is already
-- public in the frontend), so it is hardcoded in the function below.
--
-- The webhook shared secret IS sensitive and is NOT stored in this
-- migration. It is read at runtime from Supabase Vault. Provision it
-- ONCE per environment in the SQL Editor — this is permitted for the
-- postgres role, unlike `ALTER DATABASE ... SET`:
--
--   SELECT vault.create_secret(
--     '<PUSH_WEBHOOK_SECRET value>',  -- must equal the edge function secret
--     'push_webhook_secret',
--     'Shared secret for the send-request-push edge function webhook'
--   );
--
-- Rotate later with vault.update_secret(<id>, '<new value>'). Until
-- the secret exists the trigger no-ops silently, so request creation
-- is never blocked by an unconfigured webhook.
--
-- Fallback: if supabase_vault cannot be enabled, store the secret in
-- a locked-down table (e.g. private.app_secrets — RLS-enabled with no
-- policies) and change the SELECT below to read from it instead.

CREATE EXTENSION IF NOT EXISTS pg_net;

-- supabase_vault provides encrypted secret storage + the
-- vault.decrypted_secrets view. Wrapped so that a project which
-- cannot enable it still applies this migration cleanly (push then
-- no-ops until the fallback is wired up).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS supabase_vault;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Could not enable supabase_vault (%) — provision push_webhook_secret via the fallback table instead.', SQLERRM;
END $$;

CREATE OR REPLACE FUNCTION public.notify_new_request_push()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, net
AS $$
DECLARE
  -- Public endpoint — safe to hardcode (not a secret).
  v_edge_url CONSTANT TEXT :=
    'https://edexqvjbwbjasdsgejya.supabase.co/functions/v1/send-request-push';
  v_secret TEXT;
BEGIN
  -- Read the webhook secret from Supabase Vault. This function is
  -- SECURITY DEFINER, so it reads the decrypted view as its owner
  -- even though the triggering user has no access to Vault.
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = 'push_webhook_secret';

  -- Secret not provisioned yet — skip silently, never block the write.
  IF v_secret IS NULL OR v_secret = '' THEN
    RAISE WARNING 'notify_new_request_push: vault secret "push_webhook_secret" is not set — skipping push dispatch';
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
      'category',       NEW.category,
      'client_name',    NEW.client_contact_name
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- A push dispatch failure must never roll back the request insert.
  RAISE WARNING 'notify_new_request_push failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.notify_new_request_push IS
'Trigger function for requests INSERT/UPDATE. Posts newly submitted '
'(non-draft, categorised) requests to the send-request-push edge '
'function for PWA push fan-out. Reads its webhook secret from '
'Supabase Vault (secret name: push_webhook_secret).';

-- Two trigger paths share the function above. A combined
-- INSERT OR UPDATE trigger cannot reference OLD in its WHEN clause
-- (OLD is invalid for the INSERT case), so they are defined apart:
--
--   * INSERT — a request created directly as a submission
--     (createRequestWithItems / create_split_requests RPC).
--   * UPDATE — a saved draft being submitted: status transitions
--     draft -> pending_approval (updateRequestWithItems).
--
-- Later edits to an already-submitted request match neither WHEN
-- clause, so coordinators are never spammed on subsequent updates.

DROP TRIGGER IF EXISTS trg_notify_new_request_push ON public.requests;
CREATE TRIGGER trg_notify_new_request_push
  AFTER INSERT ON public.requests
  FOR EACH ROW
  WHEN (NEW.status <> 'draft' AND NEW.category IS NOT NULL)
  EXECUTE FUNCTION public.notify_new_request_push();

DROP TRIGGER IF EXISTS trg_notify_submitted_draft_push ON public.requests;
CREATE TRIGGER trg_notify_submitted_draft_push
  AFTER UPDATE ON public.requests
  FOR EACH ROW
  WHEN (
    OLD.status = 'draft'
    AND NEW.status = 'pending_approval'
    AND NEW.category IS NOT NULL
  )
  EXECUTE FUNCTION public.notify_new_request_push();
