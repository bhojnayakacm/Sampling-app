/**
 * Tiny vanilla store that bridges the imperative `registerSW` lifecycle
 * (from `virtual:pwa-register`) and the declarative React component
 * tree. Lets `pwa-register.ts` flip a single boolean when a waiting SW
 * shows up, and lets `<PwaUpdatePrompt />` read that boolean via
 * React 18's `useSyncExternalStore` — no Context, no Redux, no Zustand.
 *
 * Why a store and not a custom hook?
 * ──────────────────────────────────
 *   `registerSW` runs ONCE, side-effecting at module-import time in
 *   `main.tsx`. Its lifecycle callbacks have no React component to
 *   call into. The store is the bridge: the SW lifecycle writes to
 *   it, the modal subscribes to it.
 *
 * Why a separate `performUpdate` action?
 * ──────────────────────────────────────
 *   The `updateSW(true)` function — which posts SKIP_WAITING to the
 *   waiting worker — is owned by `pwa-register.ts`. The modal shouldn't
 *   need to import service-worker plumbing; it just calls
 *   `triggerUpdate()` and the store dispatches to the registered
 *   handler. Keeps the component pure UI.
 */

type Listener = () => void;
type UpdateHandler = () => Promise<void>;

let needRefresh = false;
const listeners = new Set<Listener>();
let performUpdate: UpdateHandler | null = null;

function emit(): void {
  listeners.forEach((l) => l());
}

export const pwaUpdateStore = {
  /** React subscription for `useSyncExternalStore`. */
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** React snapshot for `useSyncExternalStore`. */
  getSnapshot(): boolean {
    return needRefresh;
  },

  /**
   * Called by `pwa-register.ts` from the `onNeedRefresh` callback.
   * Idempotent — re-flipping to the same value is a no-op so a
   * double-fire from the SW lifecycle can't double-render anything.
   */
  setNeedRefresh(value: boolean): void {
    if (needRefresh === value) return;
    needRefresh = value;
    emit();
  },

  /**
   * Registered by `pwa-register.ts` once it has hold of the
   * `updateSW` function returned by `registerSW`.
   */
  registerUpdateHandler(handler: UpdateHandler): void {
    performUpdate = handler;
  },

  /**
   * Invoked from the modal's "Update App" click. Defers to whatever
   * `pwa-register.ts` wired up via `registerUpdateHandler`. A no-op
   * if the SW never registered (e.g. unsupported browser) — the
   * modal can only render in the first place if the SW fired
   * `onNeedRefresh`, so in practice the handler is always present.
   */
  async triggerUpdate(): Promise<void> {
    if (performUpdate) await performUpdate();
  },
};
