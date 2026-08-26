/**
 * Request submission pipeline — shared by the live form and the offline Outbox.
 *
 * WHY THIS LIVES OUTSIDE NewRequest.tsx
 * ─────────────────────────────────────
 * A queued submission has to be replayed later by a background sync worker
 * with no React component mounted. If that replay reimplemented the
 * upload → explode → consolidate → write sequence, the two copies would drift
 * and the Outbox would quietly start producing different rows than the form.
 * Instead the form builds a SubmissionPlan and calls runSubmission(); the
 * Outbox stores that same plan and calls the same function. One code path.
 *
 * A SubmissionPlan is deliberately structured-cloneable (plain data + File
 * objects), which is exactly what IndexedDB can persist.
 */

import { supabase } from '@/lib/supabase';
import { compressImage } from '@/lib/imageCompression';
import { cardImages, isBatchCard, qualityImages } from '@/lib/productImages';
import { mapWithConcurrency, UPLOAD_CONCURRENCY } from '@/lib/concurrency';
import { uploadCoordinatorDocument } from '@/lib/documents';
import { markNonRetryable } from '@/lib/networkErrors';
import { createRequestWithItems, updateRequestWithItems } from '@/lib/api/requests';
import { titleCaseQuality } from '@/lib/utils';
import { PRODUCT_QUALITIES_BY_KEY, type ProductTypeKey } from '@/lib/productData';
import { PRODUCT_FINISH_OPTIONS, getOptionsKey } from '@/types';
import type {
  CreateRequestItemInput,
  ProductImage,
  ProductItem,
  RequestCategory,
} from '@/types';

async function uploadSampleImage(file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${Math.random()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('sample-images')
    .upload(filePath, file);

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from('sample-images')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

// Composite key for the uploaded-image map. Single / zero-quality cards key
// by product index alone; batch cards key by (index, quality) so every
// selected quality can carry its own reference image.
function imgKey(index: number, quality?: string): string {
  return quality === undefined ? `${index}` : `${index}::${quality}`;
}

// One unit of upload work: a single image belonging to a single slot.
// A "slot" is either a whole single-quality card or one quality of a batch
// card. Flattening every slot's images into one list is what lets the whole
// submission share ONE bounded worker pool instead of each slot opening its
// own fan-out.
interface UploadTask {
  key: string;
  image: ProductImage;
}

// Upload every reference image across every card, returning a map of
// imgKey() -> ordered public URLs.
//
// CONCURRENCY: all images from all cards are flattened into a single queue and
// drained by UPLOAD_CONCURRENCY workers. Previously each slot ran its own
// Promise.all and every slot started at once, so a 6-photo request opened 6+
// simultaneous PUTs — past the mobile per-host connection budget, where the
// surplus sockets get dropped on a flaky radio and surface as an untyped
// "Failed to fetch". Capping in-flight work keeps every upload on a real
// socket that returns a real status.
//
// Entries that already carry a url (edit mode) pass through without
// re-uploading, and every File still goes through compressImage() first.
export async function uploadAllImages(
  products: ProductItem[]
): Promise<Map<string, string[]>> {
  const tasks: UploadTask[] = [];

  const enqueue = (key: string, images: ProductImage[]) => {
    images.forEach((image) => tasks.push({ key, image }));
  };

  products.forEach((product, index) => {
    if (product.is_kit) return;

    if (isBatchCard(product)) {
      [...new Set(product.selected_qualities)].forEach((quality) => {
        enqueue(imgKey(index, quality), qualityImages(product, quality));
      });
    } else {
      enqueue(imgKey(index), cardImages(product));
    }
  });

  const resolved = await mapWithConcurrency(tasks, UPLOAD_CONCURRENCY, async (task) => {
    if (task.image.file) {
      const optimized = await compressImage(task.image.file);
      return uploadSampleImage(optimized);
    }
    return task.image.url ?? null;
  });

  // mapWithConcurrency preserves input order, and tasks were enqueued in slot
  // order, so appending in index order reproduces each slot's original
  // ordering without extra bookkeeping.
  const urlMap = new Map<string, string[]>();
  tasks.forEach((task, i) => {
    const url = resolved[i];
    if (!url) return;
    const existing = urlMap.get(task.key);
    if (existing) existing.push(url);
    else urlMap.set(task.key, [url]);
  });

  return urlMap;
}

// Resolve the final ordered image URLs for one exploded (product, quality) row.
//   • Batch item  → that quality's own images.
//   • Single item → the card's images, on the first exploded row only.
// Existing (already-uploaded) URLs are folded in by uploadImageSet, so there
// is no separate edit-mode fallback to apply here.
// `originalIndex` is the row's position within the full `products` array.
export function resolveUploadedImageUrls(
  urlMap: Map<string, string[]>,
  product: ProductItem,
  originalIndex: number,
  quality: string,
  isFirstFromCard: boolean,
): string[] {
  if (isBatchCard(product)) {
    return urlMap.get(imgKey(originalIndex, quality)) ?? [];
  }
  return isFirstFromCard ? (urlMap.get(imgKey(originalIndex)) ?? []) : [];
}

// Convert ProductItem to CreateRequestItemInput (without request_id)
// This is called AFTER exploding batch entries, so each item has exactly one quality
// Hybrid Write: when select = "Other", store the custom text directly in the primary column
export function productToItemInput(
  product: ProductItem,
  imageUrls: string[],
  qualityOverride?: string, // Used when exploding batch entries
): Omit<CreateRequestItemInput, 'request_id'> {
  // Kit items: only pass category, size, quantity, and is_kit flag
  if (product.is_kit) {
    const resolvedSize = product.sample_size === 'Other'
      ? (product.sample_size_custom || '')
      : product.sample_size;

    return {
      item_index: 0,
      product_type: product.category as RequestCategory,
      sub_category: null,
      quality: null,
      sample_size: resolvedSize,
      thickness: null,
      finish: null,
      quantity: product.quantity,
      image_url: null,
      image_urls: null,
      is_kit: true,
    };
  }

  const optionsKey = getOptionsKey(product.category, product.sub_category);
  const hasFinish = optionsKey !== null && PRODUCT_FINISH_OPTIONS[optionsKey] !== null;

  // Determine the quality value
  let qualityValue: string;
  if (qualityOverride) {
    qualityValue = qualityOverride;
  } else if (product.selected_qualities.length > 0) {
    qualityValue = product.selected_qualities[0];
  } else {
    qualityValue = product.quality;
  }

  // Custom-quality normalisation (added 2026-06): if the resolved
  // quality is NOT one of the curated catalog entries, run it through
  // titleCaseQuality so requester-typed strings like "abc", "ABC", and
  // "Abc" all converge to "Abc". Catalog entries are intentionally
  // skipped because their casing is authoritative — e.g. the marble
  // catalog stores 'ARBESCATO VIOLA' and 'Forest  gold' in literal form
  // to match the SKU register, and reformatting them would diverge from
  // the spreadsheet source of truth.
  if (qualityValue) {
    const catalog = optionsKey ? PRODUCT_QUALITIES_BY_KEY[optionsKey as ProductTypeKey] : null;
    const isCatalogEntry = !!catalog && catalog.includes(qualityValue);
    if (!isCatalogEntry) {
      qualityValue = titleCaseQuality(qualityValue);
    }
  }

  // Hybrid Write: resolve "Other" selections to their custom text
  const resolvedSize = product.sample_size === 'Other'
    ? (product.sample_size_custom || '')
    : product.sample_size;

  const resolvedFinish = hasFinish
    ? (product.finish === 'Other'
      ? (product.finish_custom || '')
      : product.finish)
    : null;

  return {
    item_index: 0, // Will be set by the API function
    product_type: product.category as RequestCategory,
    sub_category: product.category === 'magro' ? (product.sub_category as any) || null : null,
    quality: qualityValue,
    sample_size: resolvedSize,
    thickness: null, // Field removed from UI; column is now nullable in DB.
    finish: resolvedFinish,
    quantity: product.quantity,
    // image_url keeps the FIRST image so every legacy reader (request detail,
    // exports, the cleanup edge function) keeps working unchanged; image_urls
    // carries the full ordered list.
    image_url: imageUrls[0] ?? null,
    image_urls: imageUrls.length > 0 ? imageUrls : null,
    is_kit: false,
  };
}

// ============================================================
// SMART CONSOLIDATION: Merge duplicate items and sum quantities
// ============================================================

type ItemPayload = Omit<CreateRequestItemInput, 'request_id'>;

export function consolidateItems(items: ItemPayload[]): ItemPayload[] {
  // Kit items are never consolidated — each kit is a distinct placeholder
  const kitItems = items.filter(item => item.is_kit);
  const regularItems = items.filter(item => !item.is_kit);

  const map = new Map<string, ItemPayload>();

  for (const item of regularItems) {
    const key = [
      item.product_type,
      (item as any).sub_category ?? '',
      item.quality,
      item.sample_size,
      // thickness intentionally omitted — field removed in 2026-06 refactor
      item.finish ?? '',
    ].join('||');

    const existing = map.get(key);
    if (existing) {
      existing.quantity += item.quantity;
      // Union the reference images of both entries (deduped, order-preserving)
      // so consolidating identical specs never silently drops a photo.
      const merged = [
        ...(existing.image_urls ?? []),
        ...(item.image_urls ?? []),
      ];
      const deduped = [...new Set(merged)];
      existing.image_urls = deduped.length > 0 ? deduped : null;
      // Keep the image from whichever entry had one
      if (!existing.image_url && item.image_url) {
        existing.image_url = item.image_url;
      }
    } else {
      map.set(key, { ...item });
    }
  }

  // Re-index all items sequentially: consolidated regular items, then kits
  return [...Array.from(map.values()), ...kitItems].map((item, i) => ({
    ...item,
    item_index: i,
  }));
}

// ============================================================
// BATCH ENTRY: Explode products with multiple qualities into individual items
// ============================================================
//
// Example: User selects verified ["Statuario", "Michel Angelo"] + custom "MyStone"
// Result: 3 separate items with identical specs but different qualities
// Custom detection: checks if quality exists in the DB list for that product type
//
interface ExplodedItem {
  product: ProductItem;
  quality: string;
  originalIndex: number; // Track which original product this came from (for image URL mapping)
  isFirstFromCard: boolean; // True for only the first item exploded from each card
}

export function explodeProducts(products: ProductItem[]): ExplodedItem[] {
  const exploded: ExplodedItem[] = [];

  products.forEach((product, originalIndex) => {
    // Kit items pass through directly — no quality explosion
    if (product.is_kit) {
      exploded.push({
        product,
        quality: '',
        originalIndex,
        isFirstFromCard: true,
      });
      return;
    }

    // Deduplicate selected_qualities (safety net against UI bugs)
    const uniqueQualities = [...new Set(product.selected_qualities)];

    if (uniqueQualities.length > 0) {
      // Unified mode: each selected quality becomes a separate item
      uniqueQualities.forEach((quality, qualityIndex) => {
        exploded.push({
          product,
          quality,
          originalIndex,
          isFirstFromCard: qualityIndex === 0,
        });
      });
    } else if (product.quality) {
      // Legacy fallback: single quality from old format
      exploded.push({
        product,
        quality: product.quality,
        originalIndex,
        isFirstFromCard: true,
      });
    }
  });

  return exploded;
}

// ============================================================
// SUBMISSION PLAN + EXECUTOR
// ============================================================

/** Coordinator document on a submission: a fresh File, or an already-uploaded URL. */
export interface SubmissionDocument {
  file: File | null;
  name: string | null;
  url: string | null;
}

/**
 * Everything needed to perform (or re-perform) one submission.
 *
 * MUST stay structured-cloneable: plain JSON values plus File/Blob. No
 * functions, no class instances, no React state handles — IndexedDB rejects
 * those, and the Outbox persists this object verbatim.
 */
export interface SubmissionPlan {
  version: 1;
  createdAt: number;
  /** Owner of the submission; the Outbox refuses to replay another user's entry. */
  userId: string;
  /** Card state including File objects (Files survive structured clone). */
  products: ProductItem[];
  /** Resolved parent-request columns, minus the document fields. */
  requestData: Record<string, any>;
  document: SubmissionDocument | null;
  mode: 'create' | 'update';
  requestId: string | null;
  /** Resubmitting a rejected request clears the old coordinator note. */
  clearCoordinatorMessage: boolean;
  /** False during a grace-period edit, where the split path would orphan the original. */
  allowSplit: boolean;
  /** Short human label for the Outbox UI, e.g. "3 items - Marble". */
  label: string;
}

export type SubmissionResult =
  | {
      kind: 'split';
      marbleNumber: string;
      magroNumber: string;
      marbleCount: number;
      magroCount: number;
    }
  | { kind: 'updated'; itemCount: number }
  | { kind: 'created'; requestNumber: string; itemCount: number; cardCount: number };

/**
 * Execute a submission plan: upload assets, then write the rows.
 *
 * ORDERING IS INTENTIONAL. Images upload first through the bounded pool, and
 * the document uploads only after they finish rather than racing alongside
 * them in a Promise.all. That keeps total in-flight requests at
 * UPLOAD_CONCURRENCY rather than UPLOAD_CONCURRENCY + 1, and lets a document
 * rejection surface on its own instead of tangled with image failures.
 */
export async function runSubmission(plan: SubmissionPlan): Promise<SubmissionResult> {
  // ── 1. Reference images (bounded concurrency) ───────────────
  const imageUrlMap = await uploadAllImages(plan.products);

  // ── 2. Coordinator document (sequential, never compressed) ──
  let documentUrl: string | null = plan.document?.url ?? null;
  if (plan.document?.file) {
    documentUrl = await uploadCoordinatorDocument(plan.document.file);
  }

  const requestData: Record<string, any> = {
    ...plan.requestData,
    coordinator_document_url: documentUrl,
    coordinator_document_name: documentUrl ? plan.document?.name ?? null : null,
  };
  if (plan.clearCoordinatorMessage) {
    requestData.coordinator_message = null;
  }

  // ── 3. Build the item rows ──────────────────────────────────
  const { products } = plan;
  const marbleProducts = products.filter((p) => p.category === 'marble');
  const magroProducts = products.filter((p) => p.category === 'magro');
  const isMixed = marbleProducts.length > 0 && magroProducts.length > 0;

  const buildItemsForProducts = (subset: ProductItem[]) => {
    const exploded = explodeProducts(subset);
    const rawItems = exploded.map((explodedItem) => {
      // Index within the FULL products array — that is the key imgKey() used.
      const originalIndex = products.indexOf(explodedItem.product);
      const imageUrls = resolveUploadedImageUrls(
        imageUrlMap,
        explodedItem.product,
        originalIndex,
        explodedItem.quality,
        explodedItem.isFirstFromCard,
      );
      return productToItemInput(explodedItem.product, imageUrls, explodedItem.quality);
    });
    return consolidateItems(rawItems);
  };

  // ── 4. Write ────────────────────────────────────────────────
  if (isMixed) {
    if (!plan.allowSplit) {
      // Defensive: the form blocks this before submitting. Non-retryable so a
      // queued copy can never spin on it forever.
      throw markNonRetryable(
        new Error(
          'This request cannot be split into two while editing. Keep every item in one category.',
        ),
      );
    }

    // A split replaces one request with two, so the original goes first.
    if (plan.mode === 'update' && plan.requestId) {
      const { error: deleteError } = await supabase
        .from('requests')
        .delete()
        .eq('id', plan.requestId);
      if (deleteError) throw deleteError;
    }

    const marbleItems = buildItemsForProducts(marbleProducts);
    const magroItems = buildItemsForProducts(magroProducts);

    const { data: rpcResult, error: rpcError } = await supabase.rpc('create_split_requests', {
      p_request_data: requestData,
      p_marble_items: marbleItems,
      p_magro_items: magroItems,
    });
    if (rpcError) throw rpcError;

    return {
      kind: 'split',
      marbleNumber: rpcResult.marble_number,
      magroNumber: rpcResult.magro_number,
      marbleCount: marbleItems.length,
      magroCount: magroItems.length,
    };
  }

  const itemsData = buildItemsForProducts(products);
  const category = (marbleProducts.length > 0 ? 'marble' : 'magro') as RequestCategory;
  const singleRequestData = { ...requestData, category };

  if (plan.mode === 'update' && plan.requestId) {
    await updateRequestWithItems(plan.requestId, singleRequestData, itemsData);
    return { kind: 'updated', itemCount: itemsData.length };
  }

  const result = await createRequestWithItems(singleRequestData, itemsData);
  return {
    kind: 'created',
    requestNumber: result.request.request_number,
    itemCount: itemsData.length,
    cardCount: products.length,
  };
}
