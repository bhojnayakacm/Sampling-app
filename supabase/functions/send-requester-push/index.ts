// Supabase Edge Function: send-requester-push
// ============================================================
// Delivers a per-status notification to ONE specific user — the
// request's creator (the requester). Invoked by the AFTER UPDATE
// trigger `trg_notify_requester_status_change` on `requests`
// (see migration 1011) as a database webhook.
//
// CRITICAL DIFFERENCE from send-request-push:
//   * send-request-push fans out to a category audience (all
//     active coordinators for a category).
//   * send-requester-push targets a SINGLE user_id, the requester.
//   * We MUST NOT look up by role here — that would risk alerting
//     the wrong sales rep about a peer's request. Lookup is
//     strictly `push_subscriptions.user_id = requester_id`.
//
// Auth: caller MUST present the shared PUSH_WEBHOOK_SECRET in
// the `x-webhook-secret` header. Deploy without JWT verification:
//   supabase functions deploy send-requester-push --no-verify-jwt
//
// Required edge function secrets (same set as send-request-push;
// already provisioned in this project):
//   PUSH_WEBHOOK_SECRET   - shared secret, must match the DB
//   VAPID_PUBLIC_KEY      - public VAPID key
//   VAPID_PRIVATE_KEY     - private VAPID key
//   VAPID_SUBJECT         - 'mailto:...' contact (optional, has a default)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

// Maps the request_status enum value to the title shown in the
// system notification. Kept in sync with the prefix used by the
// trigger's resolved message (e.g. message: "Approved: ..." → title: "Approved").
const TITLE_BY_STATUS: Record<string, string> = {
  approved:      'Approved',
  rejected:      'Rejected',
  assigned:      'Assigned',
  in_production: 'In Production',
  ready:         'Ready',
  dispatched:    'Dispatched',
}

// Titles for non-status events. The trigger in migration 1014 passes
// event_type='required_by_change' when a coordinator alters the
// deadline. Status-change calls (migration 1011) leave event_type
// unset and continue to derive their title from TITLE_BY_STATUS.
// Migration 1017 adds event_type='quality_change' for silent
// coordinator typo fixes on request_items.quality.
// Migration 1019 adds event_type='dispatcher_message' for the
// pre-dispatch note a dispatcher leaves for the requester.
const TITLE_BY_EVENT: Record<string, string> = {
  required_by_change: 'Deadline Updated',
  quality_change:     'Quality Updated',
  dispatcher_message: 'Message from Dispatcher',
}

interface RequesterPushBody {
  requester_id?:   string
  request_id?:     string
  request_number?: string
  new_status?:     string
  event_type?:     string
  message?:        string
}

interface SubscriptionRow {
  endpoint: string
  p256dh:   string
  auth:     string
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405)
  }

  // ── Auth: shared-secret check ──────────────────────────────
  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!webhookSecret || req.headers.get('x-webhook-secret') !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  // ── VAPID configuration ────────────────────────────────────
  const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@samplehub.app'
  if (!vapidPublic || !vapidPrivate) {
    return json({ error: 'Server misconfigured: VAPID keys missing' }, 500)
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  // ── Parse + validate body ──────────────────────────────────
  let body: RequesterPushBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { requester_id, request_id, request_number, new_status, event_type, message } = body
  if (!requester_id || !request_id || !request_number || !message) {
    return json(
      { error: 'Missing requester_id, request_id, request_number, or message' },
      400,
    )
  }

  // ── Service-role client (bypasses RLS to read subscriptions) ─
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // ── Subscriptions for THIS requester only ──────────────────
  // Strict `.eq('user_id', requester_id)`. No role join, no category
  // logic — we never want to leak a status update to another user.
  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', requester_id)

  if (subsError) {
    return json({ error: `Failed to load subscriptions: ${subsError.message}` }, 500)
  }
  const subscriptions = (subs ?? []) as SubscriptionRow[]
  if (subscriptions.length === 0) {
    // Requester has no device registered — silent success.
    return json({ sent: 0, message: 'No push subscriptions for requester' })
  }

  // ── Build the notification payload ─────────────────────────
  // Title is short (status label or event label); body carries the
  // full message. Strip the redundant "<Label>: " prefix from the
  // body if present so the system notification doesn't read e.g.
  // "Approved" twice.
  //
  // Title resolution order:
  //   1. event_type → TITLE_BY_EVENT (required_by_change, future events)
  //   2. new_status → TITLE_BY_STATUS (the pipeline transitions)
  //   3. fallback → 'Request Update'
  let title = 'Request Update'
  if (event_type && TITLE_BY_EVENT[event_type]) {
    title = TITLE_BY_EVENT[event_type]
  } else if (new_status && TITLE_BY_STATUS[new_status]) {
    title = TITLE_BY_STATUS[new_status]
  }

  let bodyText = message
  const colonIdx = message.indexOf(': ')
  if (colonIdx > 0 && colonIdx < 24) {
    bodyText = message.slice(colonIdx + 2)
  }

  const payload = JSON.stringify({
    title,
    body: bodyText,
    url:  `/requests/${request_id}`,
    tag:  `requester-${request_id}`,
  })

  // ── Fan out across the requester's devices ─────────────────
  const staleEndpoints: string[] = []
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      ),
    ),
  )

  let sent = 0
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sent++
      return
    }
    const statusCode = (result.reason as { statusCode?: number })?.statusCode
    if (statusCode === 404 || statusCode === 410) {
      // Subscription is dead — prune it so we don't retry next time.
      staleEndpoints.push(subscriptions[i].endpoint)
    } else {
      console.error('Push send failed:', result.reason)
    }
  })

  if (staleEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  return json({
    sent,
    failed: subscriptions.length - sent,
    pruned: staleEndpoints.length,
    request_number,
  })
})
