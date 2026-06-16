import { registerSW } from 'virtual:pwa-register';
import { pwaUpdateStore } from './pwa-update-store';

/**
 * Registers the service worker and writes the "update available"
 * signal into the shared store so `<PwaUpdatePrompt />` can render
 * a blocking modal.
 *
 * Why this exists
 * ───────────────
 *   `vite-plugin-pwa` is configured with `registerType: 'prompt'`
 *   (see vite.config.ts). A new build installs into the `waiting`
 *   state but does NOT activate — the previous version keeps
 *   serving the page until we explicitly send SKIP_WAITING.
 *   Without an opt-in UI, users get stuck on stale bundles.
 *
 * Why no sonner toast anymore
 * ───────────────────────────
 *   The previous implementation raised a sonner toast on
 *   `onNeedRefresh`. That felt "optional" — toasts are dismissible
 *   in mental model even when configured non-dismissible — and the
 *   subsequent reload looked like a freeze to users. We now flip
 *   the store boolean, which causes `<PwaUpdatePrompt />` to render
 *   a full-screen blocking overlay with an explicit loading state.
 *
 * How it works
 * ────────────
 *   * `registerSW({ onNeedRefresh, onOfflineReady })` is provided by
 *     `virtual:pwa-register`. The plugin auto-polls for SW updates
 *     on navigation + page focus.
 *   * `onNeedRefresh` fires when a new SW has installed and is
 *     waiting → we call `pwaUpdateStore.setNeedRefresh(true)`.
 *   * We also pre-register the update handler so the modal's
 *     "Update App" button can invoke `updateSW(true)` (which posts
 *     SKIP_WAITING + waits for controllerchange + reloads) plus an
 *     explicit `window.location.reload()` as a belt-and-suspenders
 *     fallback in case the post-message round-trip stalls.
 *
 * SSR / dev guard
 * ───────────────
 *   `registerSW` is a no-op when the browser doesn't expose
 *   `navigator.serviceWorker`, so no runtime guard needed here.
 */
const updateSW = registerSW({
  onNeedRefresh() {
    pwaUpdateStore.setNeedRefresh(true);
  },
  // Fired the first time the SW finishes installing. We intentionally
  // do NOT surface this — "offline ready" isn't actionable to users
  // and would just be noise on first load.
  onOfflineReady() {
    // no-op
  },
});

// Wire the modal's "Update App" action to the actual SW skip-waiting
// + reload sequence. The store holds the reference; the component
// just calls `pwaUpdateStore.triggerUpdate()` and stays UI-only.
pwaUpdateStore.registerUpdateHandler(async () => {
  await updateSW(true);
  window.location.reload();
});

export {};
