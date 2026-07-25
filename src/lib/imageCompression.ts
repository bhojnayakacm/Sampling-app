/**
 * Client-side image compression — native Canvas, zero dependencies.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Modern phone cameras emit 3–12 MB JPEGs. A single request carrying 6
 * reference photos can fire a 20 MB+ upload burst at Supabase Storage,
 * tripping an ingress/body-size limit (HTTP 413). Because that rejection
 * happens before the CORS response headers are attached, the browser
 * surfaces it as an opaque `TypeError: Failed to fetch`, which the UI then
 * mislabels as a generic "Connection Error".
 *
 * Downscaling every reference image to a web-sane resolution (≤1920 px on
 * the longest edge) and re-encoding it to ~1 MB *before* upload keeps each
 * request comfortably under the limit and makes uploads dramatically faster
 * on mobile data.
 *
 * WHY CANVAS INSTEAD OF A LIBRARY
 * ───────────────────────────────
 * Using the Canvas API directly (vs. `browser-image-compression` et al.)
 * means nothing new to audit, no worker bundle to ship in the PWA, and full
 * control over the single most important property here: **fail-open**. If
 * anything about decoding or encoding fails — an exotic format, a missing
 * 2D context, an out-of-memory blip on a low-end device — we return the
 * ORIGINAL file untouched. A compression hiccup must never block a
 * submission; worst case we upload the raw file exactly as before.
 */

export interface CompressImageOptions {
  /** Longest-edge cap in px. Larger images are scaled down proportionally. */
  maxDimension?: number;
  /** Byte ceiling for the output. Quality (then size) steps down to meet it. */
  maxSizeBytes?: number;
  /** Initial encode quality (0–1). Lowered iteratively if still oversized. */
  initialQuality?: number;
  /** Quality floor before we resort to shrinking dimensions further. */
  minQuality?: number;
  /** Force an output mime. Default: WebP when the browser can encode it, else JPEG. */
  mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULTS = {
  maxDimension: 1920,
  maxSizeBytes: 1024 * 1024, // ~1 MB
  initialQuality: 0.82,
  minQuality: 0.5,
  qualityStep: 0.12,
  dimensionStep: 0.75, // multiply the scale by this when quality alone isn't enough
  maxPasses: 5,
} as const;

/**
 * Compress a single image File. Returns a new (smaller) File on success, or
 * the original File unchanged if compression is unnecessary or fails.
 *
 * The output is renamed with an extension matching the actual encoded bytes
 * (.webp / .jpg), because our storage upload helper derives the object's
 * extension — and therefore its served Content-Type — from `file.name`.
 */
export async function compressImage(
  file: File,
  options: CompressImageOptions = {},
): Promise<File> {
  const cfg = { ...DEFAULTS, ...options };

  // Fail-open guard: only touch raster images that are actually over budget.
  // A sub-threshold file is already fine to upload and re-encoding it would
  // only cost quality (or, for tiny images, grow it).
  if (!file.type.startsWith('image/') || file.size <= cfg.maxSizeBytes) {
    return file;
  }

  let loaded: LoadedImage | null = null;
  try {
    loaded = await loadOrientedImage(file);
    const outputType: 'image/jpeg' | 'image/webp' =
      cfg.mimeType ?? ((await canEncodeWebp()) ? 'image/webp' : 'image/jpeg');

    // Start by scaling the longest edge down to maxDimension (never up).
    let scale = Math.min(1, cfg.maxDimension / Math.max(loaded.width, loaded.height));
    let best: Blob | null = null;

    for (let pass = 0; pass < cfg.maxPasses; pass++) {
      const w = Math.max(1, Math.round(loaded.width * scale));
      const h = Math.max(1, Math.round(loaded.height * scale));
      const canvas = drawToCanvas(loaded.source, w, h);

      // Step quality down from initial→min looking for a size that fits.
      let quality = cfg.initialQuality;
      let blob = await canvasToBlob(canvas, outputType, quality);
      while (blob.size > cfg.maxSizeBytes && quality > cfg.minQuality) {
        quality = Math.max(cfg.minQuality, +(quality - cfg.qualityStep).toFixed(2));
        blob = await canvasToBlob(canvas, outputType, quality);
      }
      releaseCanvas(canvas);
      best = blob;

      if (blob.size <= cfg.maxSizeBytes) break;
      // Even at the quality floor it's still too big → shrink and retry.
      scale *= cfg.dimensionStep;
    }

    // If compression somehow produced something no smaller than the source
    // (already-optimised or pathologically tiny), keep the original.
    if (!best || best.size >= file.size) return file;

    return blobToFile(best, file.name, outputType);
  } catch (err) {
    // Never let a compression failure block the upload — fall back to raw.
    console.warn('[imageCompression] falling back to original file:', err);
    return file;
  } finally {
    loaded?.close();
  }
}

// ────────────────────────────────────────────────────────────────────────
// Internals
// ────────────────────────────────────────────────────────────────────────

interface LoadedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  /** Releases the underlying bitmap / object URL. Safe to call once. */
  close: () => void;
}

/**
 * Decode a file into a drawable source with EXIF orientation already
 * applied, so portrait phone photos don't come out sideways.
 *
 * Primary path: `createImageBitmap(file, { imageOrientation: 'from-image' })`
 * — decoded off the main thread and orientation-correct. Fallback: an
 * `<img>` element, which modern browsers also render with EXIF orientation
 * baked in (CSS `image-orientation: from-image` is the default).
 */
async function loadOrientedImage(file: File): Promise<LoadedImage> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: 'from-image',
      } as ImageBitmapOptions);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        close: () => bitmap.close(),
      };
    } catch {
      // Format unsupported by createImageBitmap on this browser — try <img>.
    }
  }

  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Image decode failed'));
      el.src = url;
    });
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      close: () => URL.revokeObjectURL(url),
    };
  } catch (err) {
    URL.revokeObjectURL(url);
    throw err;
  }
}

function drawToCanvas(source: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))),
      type,
      quality,
    );
  });
}

/** Zero the canvas to nudge GC — iOS Safari is notoriously slow to reclaim canvas memory. */
function releaseCanvas(canvas: HTMLCanvasElement): void {
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Detect whether the browser can actually ENCODE WebP via canvas. Critical
 * footgun: `canvas.toBlob(cb, 'image/webp')` on a browser that can't encode
 * WebP silently emits a PNG instead — which for a photo is *larger* than the
 * source JPEG. We probe once and cache: if the produced blob isn't truly
 * image/webp, we fall back to JPEG everywhere.
 */
let webpSupport: boolean | null = null;
async function canEncodeWebp(): Promise<boolean> {
  if (webpSupport !== null) return webpSupport;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    const blob = await canvasToBlob(canvas, 'image/webp', 0.5);
    webpSupport = blob.type === 'image/webp';
  } catch {
    webpSupport = false;
  }
  return webpSupport;
}

function blobToFile(blob: Blob, originalName: string, type: string): File {
  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  // Strip any existing extension so the new one matches the encoded bytes.
  const base = originalName.replace(/\.[^./\\]+$/, '') || 'image';
  return new File([blob], `${base}.${ext}`, { type, lastModified: Date.now() });
}
