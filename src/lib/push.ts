// ============================================================
// Web Push (PWA system notification) integration
// ============================================================
// Helpers for subscribing/unsubscribing the browser to Web Push
// and persisting the subscription in the `push_subscriptions`
// table so the send-request-push edge function can reach it.
//
// The matching service worker (push-sw.js) handles the `push`
// event; the vite-plugin-pwa service worker registration handles
// installation, so we only need `navigator.serviceWorker.ready`.
// ============================================================

import { supabase } from '@/lib/supabase';

// Only the PUBLIC VAPID key belongs in the frontend bundle.
// The private key is an edge-function secret and never shipped.
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

/** True when this browser can register for Web Push at all. */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Converts a base64url VAPID key into the Uint8Array that
 * `pushManager.subscribe` expects as `applicationServerKey`.
 * Backed by an explicit ArrayBuffer so the result is a
 * `Uint8Array<ArrayBuffer>` (BufferSource-compatible).
 */
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const buffer = new ArrayBuffer(raw.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

/** Returns the active PushSubscription for this browser, if any. */
export async function getPushSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.getSubscription();
}

/**
 * Requests notification permission, subscribes to Web Push, and
 * stores the subscription against the given user. Idempotent —
 * re-running reuses any existing browser subscription and UPSERTs
 * the row (keyed on the unique `endpoint`).
 */
export async function subscribeToPush(userId: string): Promise<void> {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device.');
  }
  if (!VAPID_PUBLIC_KEY) {
    throw new Error('Push is not configured (missing VITE_VAPID_PUBLIC_KEY).');
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.ready;

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const keys = subscription.toJSON().keys ?? {};
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: userId,
      endpoint: subscription.endpoint,
      p256dh: keys.p256dh ?? '',
      auth: keys.auth ?? '',
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );

  if (error) throw error;
}

/**
 * Removes the browser's push subscription and deletes its row.
 * Safe to call when not subscribed.
 */
export async function unsubscribeFromPush(): Promise<void> {
  const subscription = await getPushSubscription();
  if (!subscription) return;

  // Delete the DB row first so a failed unsubscribe() doesn't strand it.
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', subscription.endpoint);
  if (error) throw error;

  await subscription.unsubscribe();
}
