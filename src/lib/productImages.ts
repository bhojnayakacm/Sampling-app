/**
 * Shared helpers for product-card reference images.
 *
 * Both the authoring UI (ProductItemCard) and the submit pipeline
 * (NewRequest) need the same view of "which images belong to this card /
 * this quality", including the normalisation of the DEPRECATED single-image
 * fields (image_file / image_preview / image_url) into the array model. One
 * place, so the two can never drift.
 */

import type { ProductImage, ProductItem } from '@/types';

/**
 * Cap per dropzone. Keeps a single request's upload burst sane — this is the
 * same size pressure that produced the 413 "Connection Error" bug, so the cap
 * works alongside compressImage() rather than replacing it.
 */
export const MAX_IMAGES_PER_SLOT = 5;

/** Per-file ceiling enforced at pick time, before any compression. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

let idCounter = 0;
/** Stable-enough client-side id for React keys + individual removal. */
export function newImageId(): string {
  idCounter += 1;
  return `img-${Date.now().toString(36)}-${idCounter}`;
}

/** True when the card is in batch mode (2+ distinct qualities selected). */
export function isBatchCard(product: ProductItem): boolean {
  return new Set(product.selected_qualities).size > 1;
}

/**
 * Images for a SINGLE / zero-quality card, normalising legacy single-image
 * state so older drafts and template-loaded cards keep working.
 */
export function cardImages(product: ProductItem): ProductImage[] {
  if (product.images && product.images.length > 0) return product.images;

  if (product.image_file || product.image_preview || product.image_url) {
    return [
      {
        id: 'legacy-single',
        file: product.image_file ?? null,
        preview: product.image_preview ?? null,
        url: product.image_url ?? null,
      },
    ];
  }
  return [];
}

/** Images attached to one quality of a batch card. */
export function qualityImages(product: ProductItem, quality: string): ProductImage[] {
  return product.quality_images?.[quality] ?? [];
}

/** Whatever should render in a thumbnail right now (fresh pick or existing). */
export function previewSrc(image: ProductImage): string | null {
  return image.preview || image.url || null;
}
