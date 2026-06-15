// Supabase Edge Function: send-maker-push
// ============================================================
// Delivers a new-assignment notification to ONE specific user —
// the maker the request was just assigned to. Invoked by the
// AFTER UPDATE trigger `trg_notify_maker_assigned` on `requests`
// (see migration 1014) as a database webhook.
//
// Audience routing (single user):
//   * STRICTLY `push_subscriptions.user_id = maker_id`.
//   * Never look up by role here — that would risk fanning out
//     to peers. The Maker is identified by the resolved
//     `requests.assigned_to` UUID at trigger time.
//
// Auth: caller MUST present the shared PUSH_WEBHOOK_SECRET in
// the `x-webhook-secret` header. Deploy without JWT verification:
//   supabase functions deploy send-maker-push --no-verify-jwt
//
// Required edge function secrets (same set as the existing push
// functions — already provisioned in this project):
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

interface MakerPushBody {
  maker_id?:       string
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

  let body: MakerPushBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { maker_id, request_id, request_number, message } = body
  if (!maker_id || !request_id || !request_number || !message) {
    return json(
      { error: 'Missing maker_id, request_id, request_number, or message' },
      400,
    )
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Strictly the maker's own subscriptions. No role join — assignment
  // is identity-based, not role-based.
  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('user_id', maker_id)

  if (subsError) {
    return json({ error: `Failed to load subscriptions: ${subsError.message}` }, 500)
  }
  const subscriptions = (subs ?? []) as SubscriptionRow[]
  if (subscriptions.length === 0) {
    return json({ sent: 0, message: 'No push subscriptions for maker' })
  }

  const payload = JSON.stringify({
    title: `New Assignment: ${request_number}`,
    body:  message,
    url:   `/requests/${request_id}`,
    tag:   `maker-${request_id}`,
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
