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

  if (error) throw error;

  const { data } = supabase.storage.from(DOCUMENTS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
