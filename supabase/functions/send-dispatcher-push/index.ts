// Supabase Edge Function: send-dispatcher-push
// ============================================================
// Broadcasts a "ready for dispatch" notification to every active
// user with the `dispatcher` role. Invoked by the AFTER UPDATE
// trigger `trg_notify_dispatcher_ready` on `requests` (see
// migration 1014) as a database webhook.
//
// Audience routing (broadcast to a role):
//   * Resolved via `profiles WHERE role = 'dispatcher' AND
//     is_active = true`, then joined to `push_subscriptions`.
//   * Mirrors the coordinator fan-out pattern in send-request-push.
//
// Auth: caller MUST present the shared PUSH_WEBHOOK_SECRET in
// the `x-webhook-secret` header. Deploy without JWT verification:
//   supabase functions deploy send-dispatcher-push --no-verify-jwt
//
// Required edge function secrets (already provisioned for the
// existing push functions):
//   PUSH_WEBHOOK_SECRET   - shared secret, must match the DB
//   VAPID_PUBLIC_KEY      - public VAPID key
//   VAPID_PRIVATE_KEY     - private VAPID key
//   VAPID_SUBJECT         - 'mailto:...' contact (optional)
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

interface DispatcherPushBody {
  request_id?:     string
  request_number?: string
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

  const webhookSecret = Deno.env.get('PUSH_WEBHOOK_SECRET')
  if (!webhookSecret || req.headers.get('x-webhook-secret') !== webhookSecret) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const vapidPublic  = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@samplehub.app'
  if (!vapidPublic || !vapidPrivate) {
    return json({ error: 'Server misconfigured: VAPID keys missing' }, 500)
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  let body: DispatcherPushBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { request_id, request_number, message } = body
  if (!request_id || !request_number || !message) {
    return json(
      { error: 'Missing request_id, request_number, or message' },
      400,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Resolve active dispatchers (role broadcast — like send-request-push).
  const { data: dispatchers, error: dispatchError } = await admin
    .from('profiles')
    .select('id')
    .eq('role', 'dispatcher')
    .eq('is_active', true)

  if (dispatchError) {
    return json({ error: `Failed to load dispatchers: ${dispatchError.message}` }, 500)
  }
  const dispatcherIds = (dispatchers ?? []).map((d: { id: string }) => d.id)
  if (dispatcherIds.length === 0) {
    return json({ sent: 0, message: 'No active dispatchers' })
  }

  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', dispatcherIds)

  if (subsError) {
    return json({ error: `Failed to load subscriptions: ${subsError.message}` }, 500)
  }
  const subscriptions = (subs ?? []) as SubscriptionRow[]
  if (subscriptions.length === 0) {
    return json({ sent: 0, message: 'No push subscriptions registered for dispatchers' })
  }

  const payload = JSON.stringify({
    title: `Ready for Dispatch: ${request_number}`,
    body:  message,
    url:   `/requests/${request_id}`,
    tag:   `dispatcher-${request_id}`,
  })

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
