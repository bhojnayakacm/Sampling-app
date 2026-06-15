import { registerSW } from 'virtual:pwa-register';
import { toast } from 'sonner';

/**
 * Registers the service worker and surfaces an "Update Available"
 * prompt when a new bundle has been downloaded.
 *
 * Why this exists
 * ───────────────
 *   `vite-plugin-pwa` is configured with `registerType: 'prompt'`
 *   (see vite.config.ts). That means a freshly-built SW installs
 *   into the `waiting` state but does NOT activate — the previous
 *   version keeps serving the page until we explicitly send
 *   SKIP_WAITING. Without an opt-in UI, users were ending up stuck
 *   on stale bundles after a deploy (the "I refreshed four times"
 *   reports). This module is that opt-in.
 *
 * How it works
 * ────────────
 *   * `registerSW({ onNeedRefresh, onOfflineReady })` is provided by
 *     `virtual:pwa-register`. The plugin wires the registration to
 *     poll for SW updates on every navigation + page focus.
 *   * `onNeedRefresh` fires when a new SW has installed and is
 *     waiting. We raise a persistent, non-dismissible sonner toast
 *     with a "Click to Update" action.
 *   * The action invokes the returned `updateSW(true)` function,
 *     which:
 *       1. posts SKIP_WAITING to the waiting worker,
 *       2. awaits the controllerchange event,
 *       3. reloads the page.
 *     We also call `window.location.reload()` directly as a
 *     belt-and-suspenders fallback — the reload inside updateSW(true)
 *     happens after a microtask hop, so explicitly reloading here
 *     guarantees the refresh even if something rejects in between.
 *
 * Persistent toast
 * ────────────────
 *   * `duration: Infinity` — never auto-dismisses.
 *   * `dismissible: false` — the user can't click the X to swipe it
 *     away; the only path forward is the Update button. This is
 *     intentional: leaving them on a stale bundle silently is the
 *     bug we're fixing.
 *   * `id: 'pwa-update'` — singleton so a rapid double-event from
 *     the SW lifecycle can't stack two prompts.
 *
 * SSR / dev guard
 * ───────────────
 *   `registerSW` is a no-op when the browser doesn't expose
 *   `navigator.serviceWorker`, so we don't need a runtime check
 *   here. The plugin's `devOptions.enabled` already takes care of
 *   wiring the SW in dev mode for testing.
 */
const updateSW = registerSW({
  onNeedRefresh() {
    toast('A new version of SampleHub is available!', {
      id: 'pwa-update',
      duration: Infinity,
      dismissible: false,
      action: {
        label: 'Click to Update',
        onClick: () => {
          // Tell the waiting worker to take over immediately, then
          // hard-reload so the page loads under the new bundle.
          // Errors here would only mean the SW is already gone — in
          // which case the reload alone fixes it.
          void updateSW(true);
          window.location.reload();
        },
      },
    });
  },
  // Fired the first time the SW finishes installing. We intentionally
  // do NOT toast here — "offline ready" is not actionable to most
  // users and would just be noise on first load.
  onOfflineReady() {
    // no-op
  },
});

export {};
