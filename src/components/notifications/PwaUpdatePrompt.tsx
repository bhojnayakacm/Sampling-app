import { useState, useSyncExternalStore } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { pwaUpdateStore } from '@/lib/pwa-update-store';

/**
 * Compulsory PWA-update modal. Mounts once at the root of <App />.
 *
 * Architecture
 * ────────────
 *   The SW lifecycle is imperative and lives outside React
 *   (`pwa-register.ts` runs on module import in main.tsx). The
 *   bridge is `pwaUpdateStore`: when a new SW lands in `waiting`,
 *   `pwa-register.ts` flips `needRefresh` to `true`. This component
 *   subscribes via `useSyncExternalStore` and renders the overlay.
 *
 *   Click "Update App" → set local `isUpdating`, paint that state
 *   for one frame via setTimeout(300), then call
 *   `pwaUpdateStore.triggerUpdate()` which delegates to the
 *   registered handler in pwa-register.ts (skipWaiting + reload).
 *
 * Why blocking, not a toast
 * ─────────────────────────
 *   A toast reads as "FYI, when you feel like it." We need the
 *   opposite — the stale bundle is at best inert and at worst
 *   silently broken (out-of-date API contracts, missing tables,
 *   etc.). A full-screen overlay with a single forward action
 *   makes the intent unambiguous.
 *
 * Why the 300ms hop before reloading
 * ──────────────────────────────────
 *   `updateSW(true)` posts SKIP_WAITING and then triggers a hard
 *   reload as soon as the new SW takes control. On slower devices
 *   the reload starts before React has even committed the
 *   `isUpdating` state to the DOM — the button looks frozen mid-
 *   click, which is the panic moment we're fixing. A 300ms timeout
 *   guarantees one paint cycle of the disabled+spinner state goes
 *   to the screen before navigation tears the page down.
 *
 * Accessibility
 * ─────────────
 *   * `role="alertdialog"` + `aria-modal="true"` so SR/AT users
 *     understand this is a blocking, urgent prompt.
 *   * `aria-labelledby` / `aria-describedby` point to the title +
 *     body so the dialog announces itself when it appears.
 *   * The Update button is the only interactive element and auto-
 *     focuses on mount. Tab key has nowhere else to go — the
 *     overlay catches all clicks on the underlying app, so a focus
 *     trap library isn't required for this single-button case.
 *   * `aria-busy` flips on the button during the update sequence.
 */
export default function PwaUpdatePrompt() {
  const needRefresh = useSyncExternalStore(
    pwaUpdateStore.subscribe,
    pwaUpdateStore.getSnapshot,
    // SSR fallback — we're CSR-only, but useSyncExternalStore wants this.
    () => false,
  );
  const [isUpdating, setIsUpdating] = useState(false);

  if (!needRefresh) return null;

  const handleUpdate = () => {
    if (isUpdating) return;
    setIsUpdating(true);
    // Deliberate paint hop. See "Why the 300ms hop" comment above.
    window.setTimeout(() => {
      void pwaUpdateStore.triggerUpdate();
    }, 300);
  };

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="pwa-update-title"
      aria-describedby="pwa-update-body"
      // z-[9999] sits above the sonner Toaster (z-[8000] by default) and
      // above every shadcn Dialog/Sheet (z-50). Anything we render
      // alongside is correctly occluded.
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150"
      // Defence in depth: even though the overlay is fixed inset-0 and
      // catches all events, keystrokes on the body could still try to
      // scroll something. Block Escape — nothing in this dialog should
      // be dismissible.
      onKeyDown={(e) => {
        if (e.key === 'Escape') e.preventDefault();
      }}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl border border-slate-200 p-6 sm:p-8 text-center animate-in zoom-in-95 duration-200"
        // Block click-through so an accidental click outside the card
        // doesn't get treated as a dismissal in some future variant.
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto h-14 w-14 rounded-full bg-indigo-100 flex items-center justify-center mb-4">
          <RefreshCw
            className={`h-7 w-7 text-indigo-600 ${isUpdating ? 'animate-spin' : ''}`}
            aria-hidden="true"
          />
        </div>

        <h2
          id="pwa-update-title"
          className="text-lg sm:text-xl font-semibold text-slate-900 mb-2"
        >
          Update Required
        </h2>

        <p
          id="pwa-update-body"
          className="text-sm sm:text-base text-slate-600 leading-relaxed mb-6"
        >
          A new version of the app is available. Please update to continue.
        </p>

        <button
          type="button"
          onClick={handleUpdate}
          disabled={isUpdating}
          aria-busy={isUpdating}
          autoFocus
          className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-lg bg-indigo-600 text-white text-base font-semibold hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-90 disabled:cursor-wait transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-500"
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
              <span>Updating... Please wait</span>
            </>
          ) : (
            <span>Update App</span>
          )}
        </button>

        {/* Subtle reassurance that this is normal + not a fault. */}
        <p className="text-[11px] text-slate-400 mt-4">
          You'll only see this when a newer build has been deployed.
        </p>
      </div>
    </div>
  );
}
