/**
 * Offline Outbox — IndexedDB-backed queue of submissions awaiting network.
 *
 * WHY INDEXEDDB AND NOT localStorage
 * ──────────────────────────────────
 * localStorage is synchronous, ~5MB, and strings only. A queued submission
 * carries the user's actual compressed photos and their attached document;
 * base64-ing those into localStorage would blow the quota on the first
 * multi-image request. IndexedDB stores values via the structured clone
 * algorithm, which handles File and Blob natively — the File objects go in
 * and come back out as real Files, ready to hand straight to Supabase
 * Storage. No re-encoding, no size ceiling worth worrying about.
 *
 * Native IDB is used rather than a wrapper (idb-keyval et al.) to avoid
 * adding a dependency for ~80 lines of well-understood API surface.
 *
 * WHAT IS *NOT* SOLVED HERE
 *   • Cross-tab coordination: two tabs syncing at once could double-submit.
 *     The in-memory lock in useOutboxSync covers the common single-tab case;
 *     a Web Lock or BroadcastChannel would be the next step if this becomes
 *     real. Entries are deleted before nothing else runs, so the window is
 *     small.
 */

import type { SubmissionPlan } from '@/lib/submitRequest';

const DB_NAME = 'samplehub-outbox';
const DB_VERSION = 1;
const STORE = 'submissions';

/** Give up after this many failed replays and park the entry for the user. */
export const MAX_OUTBOX_ATTEMPTS = 5;

export type OutboxStatus = 'pending' | 'failed';

export interface OutboxEntry {
  id: string;
  status: OutboxStatus;
  attempts: number;
  createdAt: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  plan: SubmissionPlan;
}

/** True when this browser can back the Outbox at all. */
export function isOutboxSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('status', 'status', { unique: false });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/** Run one transaction and resolve with the request result. */
async function withStore<T>(
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDb();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = fn(tx.objectStore(STORE));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `outbox-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/**
 * Queue a submission. Returns the stored entry, or null when IndexedDB is
 * unavailable/refuses the write — callers must treat null as "not saved" and
 * surface the original error rather than a false success.
 */
export async function enqueueSubmission(plan: SubmissionPlan): Promise<OutboxEntry | null> {
  if (!isOutboxSupported()) return null;

  const entry: OutboxEntry = {
    id: newId(),
    status: 'pending',
    attempts: 0,
    createdAt: Date.now(),
    lastAttemptAt: null,
    lastError: null,
    plan,
  };

  try {
    await withStore('readwrite', (store) => store.put(entry) as IDBRequest<IDBValidKey>);
    return entry;
  } catch (error) {
    // Most likely a quota error or a non-cloneable value slipping into the
    // plan. Never mask the original submit failure with a fake success.
    console.error('[Outbox] Failed to queue submission:', error);
    return null;
  }
}

export async function getAllEntries(): Promise<OutboxEntry[]> {
  if (!isOutboxSupported()) return [];
  try {
    const rows = await withStore('readonly', (store) => store.getAll() as IDBRequest<OutboxEntry[]>);
    return (rows ?? []).sort((a, b) => a.createdAt - b.createdAt);
  } catch (error) {
    console.error('[Outbox] Failed to read entries:', error);
    return [];
  }
}

/** Entries still eligible for automatic replay, oldest first. */
export async function getPendingEntries(): Promise<OutboxEntry[]> {
  const all = await getAllEntries();
  return all.filter((e) => e.status === 'pending');
}

export async function countPending(): Promise<number> {
  return (await getPendingEntries()).length;
}

export async function deleteEntry(id: string): Promise<void> {
  if (!isOutboxSupported()) return;
  try {
    await withStore('readwrite', (store) => store.delete(id) as unknown as IDBRequest<undefined>);
  } catch (error) {
    console.error('[Outbox] Failed to delete entry:', error);
  }
}

/**
 * Record a failed replay. Past MAX_OUTBOX_ATTEMPTS the entry is parked as
 * 'failed' so a permanently-broken submission cannot spin forever — it stays
 * in the store for the user to retry or discard deliberately.
 */
export async function recordFailure(entry: OutboxEntry, error: unknown): Promise<OutboxEntry> {
  const attempts = entry.attempts + 1;
  const updated: OutboxEntry = {
    ...entry,
    attempts,
    lastAttemptAt: Date.now(),
    lastError: error instanceof Error ? error.message : String(error),
    status: attempts >= MAX_OUTBOX_ATTEMPTS ? 'failed' : 'pending',
  };
  try {
    await withStore('readwrite', (store) => store.put(updated) as IDBRequest<IDBValidKey>);
  } catch (writeError) {
    console.error('[Outbox] Failed to record failure:', writeError);
  }
  return updated;
}

/** Move a parked entry back into the pending queue (manual retry). */
export async function retryEntry(id: string): Promise<void> {
  if (!isOutboxSupported()) return;
  const all = await getAllEntries();
  const entry = all.find((e) => e.id === id);
  if (!entry) return;
  try {
    await withStore('readwrite', (store) =>
      store.put({ ...entry, status: 'pending', attempts: 0, lastError: null }) as IDBRequest<IDBValidKey>,
    );
  } catch (error) {
    console.error('[Outbox] Failed to requeue entry:', error);
  }
}
