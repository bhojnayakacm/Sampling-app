/**
 * Local auto-save backup for the New Request form.
 *
 * WHY A SEPARATE DATABASE FROM THE OUTBOX
 * ───────────────────────────────────────
 * The Outbox holds submissions the user has already committed to — losing one
 * loses real work. This store holds a scratch backup that is rewritten every
 * few seconds. Keeping them in separate IndexedDB databases means an
 * auto-save bug (a bad upgrade, a quota blow-out from a large draft) can never
 * take the submission queue down with it. They also version independently.
 *
 * HOW FILES SURVIVE
 * ─────────────────
 * IndexedDB persists values with the structured clone algorithm, which handles
 * File/Blob natively: the browser stores the underlying bytes (disk-backed),
 * not a JS reference. On read they come back as genuine `File` instances with
 * name/size/type/lastModified intact, ready to hand straight to
 * compressImage() or supabase.storage.upload() — no re-encoding, no base64.
 *
 * The one thing deliberately NOT stored is each image's `preview` data URL.
 * Those are base64 strings ~1.4x the size of the image itself, and they are
 * fully derivable from the File. They are stripped on save and regenerated on
 * restore via URL.createObjectURL(), which is both smaller at rest and cheaper
 * at runtime than a FileReader round-trip.
 */

import type { ProductImage, ProductItem } from '@/types';

const DB_NAME = 'samplehub-autosave';
const DB_VERSION = 1;
const STORE = 'drafts';

/** Single active-form backup. Scoped per user so a shared device stays clean. */
const AUTO_SAVE_KEY = 'auto-save-draft';

/** Debounce window before a change is written. */
export const AUTO_SAVE_DEBOUNCE_MS = 3000;

/** Backups older than this are treated as stale and dropped on restore. */
export const AUTO_SAVE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface AutoSavedDocument {
  file: File | null;
  name: string;
  url: string | null;
}

export interface AutoSavedDraft {
  key: string;
  version: 1;
  /** Owner — a restore never crosses accounts on a shared browser. */
  userId: string;
  savedAt: number;
  /** react-hook-form values as returned by watch(). */
  formValues: Record<string, unknown>;
  /** Product cards with Files intact and previews stripped. */
  products: ProductItem[];
  coordinatorDoc: AutoSavedDocument | null;
}

export function isAutoSaveSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

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

/** Drop every image `preview` — regenerated from the File on restore. */
function stripPreviews(products: ProductItem[]): ProductItem[] {
  const strip = (images: ProductImage[]): ProductImage[] =>
    images.map(({ preview: _preview, ...rest }) => ({ ...rest }));

  return products.map((product) => {
    const next: ProductItem = { ...product, image_preview: null };
    if (product.images?.length) next.images = strip(product.images);
    if (product.quality_images) {
      const qualityImages: Record<string, ProductImage[]> = {};
      for (const [quality, images] of Object.entries(product.quality_images)) {
        qualityImages[quality] = strip(images);
      }
      next.quality_images = qualityImages;
    }
    return next;
  });
}

/**
 * Rebuild thumbnail previews from the restored Files.
 *
 * Returns the rehydrated cards plus every object URL created, so the caller
 * can revoke them on unmount — object URLs pin their blob in memory until
 * released.
 */
export function rehydratePreviews(products: ProductItem[]): {
  products: ProductItem[];
  objectUrls: string[];
} {
  const objectUrls: string[] = [];

  const rehydrate = (images: ProductImage[]): ProductImage[] =>
    images.map((image) => {
      // An already-uploaded image keeps its remote url; nothing to rebuild.
      if (!image.file || image.preview) return image;
      try {
        const preview = URL.createObjectURL(image.file);
        objectUrls.push(preview);
        return { ...image, preview };
      } catch {
        // Preview is cosmetic — the File still uploads without it.
        return image;
      }
    });

  const restored = products.map((product) => {
    const next: ProductItem = { ...product };
    if (product.images?.length) next.images = rehydrate(product.images);
    if (product.quality_images) {
      const qualityImages: Record<string, ProductImage[]> = {};
      for (const [quality, images] of Object.entries(product.quality_images)) {
        qualityImages[quality] = rehydrate(images);
      }
      next.quality_images = qualityImages;
    }
    return next;
  });

  return { products: restored, objectUrls };
}

/**
 * Write (or overwrite) the backup. Never throws — a failed auto-save must not
 * interrupt typing, so failures are logged and swallowed.
 */
export async function saveAutoSavedDraft(input: {
  userId: string;
  formValues: Record<string, unknown>;
  products: ProductItem[];
  coordinatorDoc: AutoSavedDocument | null;
}): Promise<void> {
  if (!isAutoSaveSupported()) return;

  const draft: AutoSavedDraft = {
    key: AUTO_SAVE_KEY,
    version: 1,
    userId: input.userId,
    savedAt: Date.now(),
    formValues: input.formValues,
    products: stripPreviews(input.products),
    coordinatorDoc: input.coordinatorDoc,
  };

  try {
    await withStore('readwrite', (store) => store.put(draft) as IDBRequest<IDBValidKey>);
  } catch (error) {
    console.warn('[AutoSave] Failed to write draft backup:', error);
  }
}

/**
 * Read the backup for this user, or null when there is nothing usable.
 * Entries belonging to another account, or older than AUTO_SAVE_MAX_AGE_MS,
 * are discarded rather than returned.
 */
export async function loadAutoSavedDraft(userId: string): Promise<AutoSavedDraft | null> {
  if (!isAutoSaveSupported()) return null;

  try {
    const draft = await withStore(
      'readonly',
      (store) => store.get(AUTO_SAVE_KEY) as IDBRequest<AutoSavedDraft | undefined>,
    );
    if (!draft) return null;

    if (draft.userId !== userId || draft.version !== 1) {
      await clearAutoSavedDraft();
      return null;
    }
    if (Date.now() - draft.savedAt > AUTO_SAVE_MAX_AGE_MS) {
      await clearAutoSavedDraft();
      return null;
    }
    return draft;
  } catch (error) {
    console.warn('[AutoSave] Failed to read draft backup:', error);
    return null;
  }
}

/**
 * Delete the backup. Called the moment work is safely on the server, so the
 * next new request starts from a blank form.
 */
export async function clearAutoSavedDraft(): Promise<void> {
  if (!isAutoSaveSupported()) return;
  try {
    await withStore(
      'readwrite',
      (store) => store.delete(AUTO_SAVE_KEY) as unknown as IDBRequest<undefined>,
    );
  } catch (error) {
    console.warn('[AutoSave] Failed to clear draft backup:', error);
  }
}

/** True when the backup holds anything worth restoring. */
export function isRestorableDraft(draft: AutoSavedDraft | null): draft is AutoSavedDraft {
  if (!draft) return false;

  const hasProducts = draft.products.some(
    (p) => p.category || p.selected_qualities?.length > 0 || p.quality,
  );
  const hasFormValues = Object.values(draft.formValues ?? {}).some((value) => {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });

  return hasProducts || hasFormValues || !!draft.coordinatorDoc;
}
