/**
 * Coordinator document attachments (PDF / Word / Excel).
 *
 * ⚠️  These files MUST NOT pass through `compressImage()`. That utility is a
 * Canvas-based raster-image compressor: handing it a PDF or XLSX would either
 * fail to decode (returning the file unchanged, wasting a decode attempt) or —
 * worse, if the contract ever changed — corrupt a binary document by
 * re-encoding it as an image. Documents are uploaded byte-for-byte as picked.
 * Their size is bounded by MAX_DOCUMENT_BYTES instead.
 */

import { supabase } from '@/lib/supabase';
import { isNetworkError, markNonRetryable } from '@/lib/networkErrors';

export const DOCUMENTS_BUCKET = 'request-documents';

/** 10 MB — matches the bucket's file_size_limit in migration 1022. */
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

/** Accepted document types. Mirrors the bucket's allowed_mime_types. */
export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv',
] as const;

/** `accept` attribute for the file input — extensions cover OS pickers that report odd MIME types. */
export const DOCUMENT_ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv';

/**
 * Raised when the storage bucket rejects a document for size or type.
 * Carries a user-ready message; getFriendlyErrorMessage surfaces it verbatim.
 */
export class DocumentUploadError extends Error {
  readonly isDocumentUploadError = true;
  constructor(message: string) {
    super(message);
    this.name = 'DocumentUploadError';
  }
}

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv'];

/**
 * Validate a picked document. Returns an error string, or null when valid.
 * Checks extension rather than MIME alone: Android/Windows pickers routinely
 * report `application/octet-stream` for a perfectly valid .docx.
 */
export function validateDocument(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return 'Unsupported file type. Please attach a PDF, Word, Excel or CSV file.';
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return 'Document is too large. Maximum size is 10MB.';
  }
  return null;
}

/** Strip anything that could break a storage path, keeping the name readable. */
function sanitizeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(-80) || 'document';
}

/**
 * Upload a coordinator document and return its public URL.
 * NOTE: no compression — see the file header.
 */
export async function uploadCoordinatorDocument(file: File): Promise<string> {
  const validationError = validateDocument(file);
  if (validationError) throw new Error(validationError);

  // UUID prefix guarantees uniqueness; the readable suffix keeps the
  // downloaded filename meaningful even straight from the URL.
  const path = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) throw decodeDocumentUploadError(error);

  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Turn a raw storage failure into something the user can act on.
 *
 * THE PROBLEM: when the bucket rejects a document — over its 10MB
 * `file_size_limit`, or a MIME type outside `allowed_mime_types` — the
 * rejection can arrive as a 413 whose CORS headers never make it back, so the
 * browser surfaces a bare `TypeError: Failed to fetch`. Indistinguishable
 * from a dead network, it was reported as "Connection Error" and would now
 * also be queued into the offline Outbox to retry forever.
 *
 * A genuine transport failure is passed through untouched so the Outbox can
 * still queue it; only a decodable rejection is converted, and it is marked
 * NON_RETRYABLE so no retry loop picks it up.
 */
function decodeDocumentUploadError(error: unknown): Error {
  // Real network failure — let it bubble so the Outbox can queue the submission.
  if (isNetworkError(error)) return error as Error;

  const err = (error ?? {}) as Record<string, unknown>;
  const rawStatus = err.statusCode ?? err.status;
  const status = typeof rawStatus === 'string' ? parseInt(rawStatus, 10) : rawStatus;
  const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';

  const isSizeOrTypeRejection =
    status === 413
    || status === 415
    || message.includes('payload too large')
    || message.includes('entity too large')
    || message.includes('maximum allowed size')
    || message.includes('exceeded the maximum')
    || message.includes('file too large')
    || message.includes('mime type')
    || message.includes('invalid_mime_type');

  if (isSizeOrTypeRejection) {
    return markNonRetryable(
      new DocumentUploadError(
        'Document exceeds 10MB or is invalid. Attach a smaller PDF, Word, Excel or CSV file.',
      ),
    );
  }

  return error as Error;
}
