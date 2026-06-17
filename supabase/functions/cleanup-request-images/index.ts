// Supabase Edge Function: cleanup-request-images
// ============================================================
// Purges every image associated with a request when the request
// enters the `received` state. Invoked by the AFTER UPDATE trigger
// `trg_notify_cleanup_request_images` on `requests` (migration
// 1016) as a database webhook.
//
// What gets deleted
// ─────────────────
//   1. Reference photos in the `sample-images` bucket. URLs are
//      stored on `request_items.image_url`.
//   2. Dispatch photos in the `dispatch-images` bucket. URLs are
//      stored on `requests.dispatch_metadata->'images'`.
//   3. A belt-and-suspenders directory listing under
//      `<request_id>/` in `dispatch-images`, in case any uploads
//      went missing from the JSONB array (e.g. partial write).
//
// What gets nulled
// ────────────────
//   * `request_items.image_url` is set to NULL for every item in
//     the request (so the UI stops trying to render a deleted
//     image).
//   * `requests.dispatch_metadata->'images'` is replaced with an
//     empty array (preserves the rest of the dispatch metadata —
//     courier name, driver number, etc. — which is still useful
//     audit info even after images are gone).
//
// Idempotence
// ───────────
//   Every step is safe to re-run. `storage.remove` on a missing
//   object is a no-op; UPDATE on already-nulled columns is a
//   no-op. Manual retry from the SQL editor or a maintenance
//   cron is therefore safe.
//
// Auth: caller MUST present PUSH_WEBHOOK_SECRET in `x-webhook-secret`.
// Deploy without JWT verification:
//   supabase functions deploy cleanup-request-images --no-verify-jwt
//
// Required edge function secrets (already provisioned for the
// existing push functions):
//   PUSH_WEBHOOK_SECRET   - shared secret, must match the DB
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are injected automatically.
// ============================================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-webhook-secret',
}

const SAMPLE_BUCKET   = 'sample-images'
const DISPATCH_BUCKET = 'dispatch-images'

interface CleanupBody {
  request_id?:     string
  request_number?: string
}

interface CleanupSummary {
  request_id:        string
  request_number:    string | null
  sample_paths:      string[]
  dispatch_paths:    string[]
  prefix_paths:      string[]
  sample_removed:    number
  dispatch_removed:  number
  rows_nulled:       number
  metadata_cleared:  boolean
  errors:            string[]
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

/**
 * Given a public URL like
 *   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
 * extract `<path>` for the named bucket. Returns null if the URL
 * doesn't match the expected shape — never throws, so a single
 * malformed legacy URL can't take the whole cleanup down.
 */
function pathFromPublicUrl(url: string | null | undefined, bucket: string): string | null {
  if (!url || typeof url !== 'string') return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const idx = url.indexOf(marker)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + marker.length))
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

  // ── Parse + validate body ──────────────────────────────────
  let body: CleanupBody
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }
  const { request_id, request_number } = body
  if (!request_id) {
    return json({ error: 'Missing request_id' }, 400)
  }

  // ── Service-role client (bypasses RLS) ─────────────────────
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  const summary: CleanupSummary = {
    request_id,
    request_number: request_number ?? null,
    sample_paths:     [],
    dispatch_paths:   [],
    prefix_paths:     [],
    sample_removed:   0,
    dispatch_removed: 0,
    rows_nulled:      0,
    metadata_cleared: false,
    errors:           [],
  }

  // ── 1. Reference photos (sample-images) ────────────────────
  // Collect every image_url on request_items for this request,
  // parse out the storage path, and remove. We do this first so a
  // failure on the dispatch-images side doesn't leak references.
  try {
    const { data: items, error: itemsError } = await admin
      .from('request_items')
      .select('id, image_url')
      .eq('request_id', request_id)
      .not('image_url', 'is', null)

    if (itemsError) {
      summary.errors.push(`Load request_items: ${itemsError.message}`)
    } else {
      summary.sample_paths = (items ?? [])
        .map((row: { image_url: string | null }) => pathFromPublicUrl(row.image_url, SAMPLE_BUCKET))
        .filter((p): p is string => !!p)

      if (summary.sample_paths.length > 0) {
        const { error: removeError } = await admin.storage
          .from(SAMPLE_BUCKET)
          .remove(summary.sample_paths)

        if (removeError) {
          summary.errors.push(`Remove sample-images: ${removeError.message}`)
        } else {
          summary.sample_removed = summary.sample_paths.length
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Sample-images cleanup threw: ${(e as Error).message}`)
  }

  // ── 2. Dispatch photos (dispatch-images, from JSONB) ───────
  // The frontend writes a string[] under dispatch_metadata.images.
  try {
    const { data: request, error: requestError } = await admin
      .from('requests')
      .select('dispatch_metadata')
      .eq('id', request_id)
      .maybeSingle()

    if (requestError) {
      summary.errors.push(`Load request: ${requestError.message}`)
    } else if (request?.dispatch_metadata?.images && Array.isArray(request.dispatch_metadata.images)) {
      summary.dispatch_paths = (request.dispatch_metadata.images as unknown[])
        .map((u) => (typeof u === 'string' ? pathFromPublicUrl(u, DISPATCH_BUCKET) : null))
        .filter((p): p is string => !!p)

      if (summary.dispatch_paths.length > 0) {
        const { error: removeError } = await admin.storage
          .from(DISPATCH_BUCKET)
          .remove(summary.dispatch_paths)

        if (removeError) {
          summary.errors.push(`Remove dispatch-images by URL: ${removeError.message}`)
        } else {
          summary.dispatch_removed += summary.dispatch_paths.length
        }
      }
    }
  } catch (e) {
    summary.errors.push(`Dispatch-images URL cleanup threw: ${(e as Error).message}`)
  }

  // ── 3. Belt-and-suspenders prefix sweep ───────────────────
  // Path convention is <request_id>/<filename>. Listing the
  // directory catches any uploads whose URL didn't make it into
  // dispatch_metadata.images (e.g. partial write, manual upload).
  try {
    const { data: dirItems, error: listError } = await admin.storage
      .from(DISPATCH_BUCKET)
      .list(request_id, { limit: 100 })

    if (listError) {
      summary.errors.push(`List dispatch-images dir: ${listError.message}`)
    } else if (dirItems && dirItems.length > 0) {
      summary.prefix_paths = dirItems.map((entry) => `${request_id}/${entry.name}`)

      const { error: removeError } = await admin.storage
        .from(DISPATCH_BUCKET)
        .remove(summary.prefix_paths)

      if (removeError) {
        summary.errors.push(`Remove dispatch-images by prefix: ${removeError.message}`)
      } else {
        summary.dispatch_removed += summary.prefix_paths.length
      }
    }
  } catch (e) {
    summary.errors.push(`Prefix sweep threw: ${(e as Error).message}`)
  }

  // ── 4. NULL out image_url on request_items ─────────────────
  // Done after the storage removes so we don't lose the path
  // mapping if the storage side fails. UI will stop rendering
  // broken images immediately.
  try {
    const { data: updated, error: nullError } = await admin
      .from('request_items')
      .update({ image_url: null })
      .eq('request_id', request_id)
      .not('image_url', 'is', null)
      .select('id')

    if (nullError) {
      summary.errors.push(`NULL request_items.image_url: ${nullError.message}`)
    } else {
      summary.rows_nulled = updated?.length ?? 0
    }
  } catch (e) {
    summary.errors.push(`Null-out request_items threw: ${(e as Error).message}`)
  }

  // ── 5. Empty dispatch_metadata.images ──────────────────────
  // We keep the rest of dispatch_metadata (courier name, driver
  // number, etc.) because that's audit information worth
  // preserving past the receipt. Only the images array is zeroed.
  try {
    const { error: metaError } = await admin.rpc('jsonb_set_dispatch_images_empty', {
      p_request_id: request_id,
    })

    if (metaError) {
      // RPC not present — fall back to a plain UPDATE that rewrites
      // the whole metadata object. Same end result.
      const { data: row, error: readError } = await admin
        .from('requests')
        .select('dispatch_metadata')
        .eq('id', request_id)
        .maybeSingle()

      if (readError) {
        summary.errors.push(`Re-read dispatch_metadata: ${readError.message}`)
      } else if (row?.dispatch_metadata) {
        const next = { ...(row.dispatch_metadata as Record<string, unknown>), images: [] }
        const { error: writeError } = await admin
          .from('requests')
          .update({ dispatch_metadata: next })
          .eq('id', request_id)

        if (writeError) {
          summary.errors.push(`Clear dispatch_metadata.images: ${writeError.message}`)
        } else {
          summary.metadata_cleared = true
        }
      } else {
        // Nothing to clear — treat as success.
        summary.metadata_cleared = true
      }
    } else {
      summary.metadata_cleared = true
    }
  } catch (e) {
    summary.errors.push(`Metadata-images cleanup threw: ${(e as Error).message}`)
  }

  // ── Result ────────────────────────────────────────────────
  // 200 even when errors[] is non-empty; the trigger fire is an
  // "at-most-once best effort". Caller (pg_net) only logs.
  if (summary.errors.length > 0) {
    console.error('cleanup-request-images partial failure:', summary)
  } else {
    console.log('cleanup-request-images OK:', summary)
  }

  return json(summary)
})
