// Supabase Edge Function: send-request-push
// ============================================================
// Fans out a newly created sample request to the relevant
// coordinators as a Web Push (PWA system) notification.
//
// Invoked by the AFTER INSERT trigger `trg_notify_new_request_push`
// on the `requests` table (see migration 1010) — this function is
// the "database webhook" target.
//
// Auth: the caller MUST present the shared PUSH_WEBHOOK_SECRET in
// the `x-webhook-secret` header. Because the database trigger calls
// this without a user JWT, deploy it with:
//   supabase functions deploy send-request-push --no-verify-jwt
//
// Required edge function secrets:
//   PUSH_WEBHOOK_SECRET   - shared secret, must match the DB setting
//   VAPID_PUBLIC_KEY      - public VAPID key  (npx web-push generate-vapid-keys)
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

// Which coordinator roles own each request category.
// Legacy `coordinator` accounts are treated as Marble (see App.tsx).
const ROLES_BY_CATEGORY: Record<string, string[]> = {
  marble: ['marble_coordinator', 'coordinator'],
  magro: ['magro_coordinator'],
}

interface PushPayloadBody {
  request_id?: string
  request_number?: string
  category?: string
  client_name?: string | null
}

interface SubscriptionRow {
  endpoint: string
  p256dh: string
  auth: string
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
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
  const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@samplehub.app'
  if (!vapidPublic || !vapidPrivate) {
    return json({ error: 'Server misconfigured: VAPID keys missing' }, 500)
  }
  webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

  // ── Parse + validate body ──────────────────────────────────
  let body: PushPayloadBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const { request_id, request_number, category, client_name } = body
  if (!request_id || !request_number || !category) {
    return json({ error: 'Missing request_id, request_number, or category' }, 400)
  }

  const roles = ROLES_BY_CATEGORY[category]
  if (!roles) {
    return json({ error: `Unknown category: ${category}` }, 400)
  }

  // ── Service-role client (bypasses RLS to read subscriptions) ─
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Active coordinators responsible for this category.
  const { data: coordinators, error: coordError } = await admin
    .from('profiles')
    .select('id')
    .in('role', roles)
    .eq('is_active', true)

  if (coordError) {
    return json({ error: `Failed to load coordinators: ${coordError.message}` }, 500)
  }
  const coordinatorIds = (coordinators ?? []).map((c: { id: string }) => c.id)
  if (coordinatorIds.length === 0) {
    return json({ sent: 0, message: 'No active coordinators for this category' })
  }

  // Their registered Web Push subscriptions (may be several per user).
  const { data: subs, error: subsError } = await admin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', coordinatorIds)

  if (subsError) {
    return json({ error: `Failed to load subscriptions: ${subsError.message}` }, 500)
  }
  const subscriptions = (subs ?? []) as SubscriptionRow[]
  if (subscriptions.length === 0) {
    return json({ sent: 0, message: 'No push subscriptions registered' })
  }

  // ── Build the notification payload ─────────────────────────
  // Title matches the in-app toast format: "New <Category> Request: <SMP-ID>".
  const label = category === 'magro' ? 'Magro' : 'Marble'
  const payload = JSON.stringify({
    title: `New ${label} Request: ${request_number}`,
    body: client_name
      ? `Client: ${client_name}`
      : 'A new sample request is awaiting your review.',
    url: `/requests/${request_id}`,
    tag: `request-${request_id}`,
  })

  // ── Fan out to every subscription in parallel ──────────────
  const staleEndpoints: string[] = []
  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  )

  let sent = 0
  results.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      sent++
      return
    }
    const statusCode = (result.reason as { statusCode?: number })?.statusCode
    // 404 Not Found / 410 Gone → subscription is dead; prune it.
    if (statusCode === 404 || statusCode === 410) {
      staleEndpoints.push(subscriptions[i].endpoint)
    } else {
      console.error('Push send failed:', result.reason)
    }
  })

  // Clean up expired endpoints so they are not retried next time.
  if (staleEndpoints.length > 0) {
    await admin.from('push_subscriptions').delete().in('endpoint', staleEndpoints)
  }

  return json({
    sent,
    failed: subscriptions.length - sent,
    pruned: staleEndpoints.length,
  })
})
