import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Truck,
  ImagePlus,
  X,
  Loader2,
  UploadCloud,
  AlertCircle,
} from 'lucide-react';
import type { Request, DispatchMode, DispatchMetadata } from '@/types';
import { FIELD_BOYS } from '@/lib/dispatch';

// ============================================================
// Hardcoded lists (per spec)
// ============================================================
const COURIER_SERVICES = [
  'DTDC',
  'Shree Maruti',
  'Shree Mahavir',
  'Trackon',
  'Blue dart',
  'Other',
] as const;

const MAX_IMAGES   = 8;
const MAX_FILE_MB  = 10;
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

interface DispatchDialogProps {
  request:      Request;
  /** courier / company_vehicle / field_boy — derived from request.pickup_responsibility. */
  mode:         DispatchMode;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback after a successful dispatch (for parent dashboards to refetch). */
  onDispatched?: () => void;
}

interface StagedFile {
  /** Local stable id so we can key React lists. */
  id:      string;
  file:    File;
  /** object-URL for the thumbnail preview. Revoked on remove / unmount. */
  preview: string;
}

/**
 * Unified dispatch confirmation modal. Renders the right field set
 * for the active delivery mode, lets the user stage 1–8 photos with
 * drag-and-drop, then performs the full dispatch transaction:
 *
 *   1. Upload every staged image to `dispatch-images/<request_id>/...`
 *      in parallel.
 *   2. UPDATE requests SET status='dispatched', dispatch_metadata=…,
 *      dispatched_at=now() — the trigger from migration 1014 will
 *      fire any downstream notifications.
 *   3. Invalidate the relevant TanStack Query caches.
 *
 * If the UPDATE fails after uploads have happened, the upload helper
 * fires a best-effort cleanup so the bucket doesn't accumulate
 * orphans. The status flip is the single source of truth — until it
 * commits, the dispatch hasn't happened.
 */
export default function DispatchDialog({
  request,
  mode,
  open,
  onOpenChange,
  onDispatched,
}: DispatchDialogProps) {
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef  = useRef<HTMLDivElement>(null);

  // ── State ──────────────────────────────────────────────────
  const [staged, setStaged]   = useState<StagedFile[]>([]);
  const [note, setNote]       = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Courier-specific
  const [courierService, setCourierService] = useState<string>('');
  const [courierOther,   setCourierOther]   = useState('');

  // Company-vehicle-specific
  const [driverName,  setDriverName]  = useState('');
  const [driverPhone, setDriverPhone] = useState('');

  // Field-boy-specific
  const [fieldBoy, setFieldBoy] = useState<string>('');

  // ── Reset on close ─────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      // Revoke object URLs to prevent memory leaks.
      staged.forEach((s) => URL.revokeObjectURL(s.preview));
      setStaged([]);
      setNote('');
      setCourierService('');
      setCourierOther('');
      setDriverName('');
      setDriverPhone('');
      setFieldBoy('');
      setIsDragging(false);
      setIsSubmitting(false);
    }
    // We intentionally don't depend on `staged` here — the cleanup
    // only needs to run on the close transition, not on every staging
    // change. Re-listing `staged` would revoke previews mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // ── Cleanup any straggler previews on unmount ──────────────
  useEffect(() => {
    return () => {
      staged.forEach((s) => URL.revokeObjectURL(s.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── File staging ───────────────────────────────────────────
  const addFiles = (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (incoming.length === 0) return;

    const accepted: StagedFile[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (!ALLOWED_MIME.includes(file.type) && !file.type.startsWith('image/')) {
        rejected.push(`${file.name}: unsupported file type`);
        continue;
      }
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        rejected.push(`${file.name}: exceeds ${MAX_FILE_MB} MB limit`);
        continue;
      }
      accepted.push({
        id:      `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setStaged((prev) => {
      const room = Math.max(0, MAX_IMAGES - prev.length);
      const trimmed = accepted.slice(0, room);
      // If we had to drop some for the cap, surface that.
      if (accepted.length > trimmed.length) {
        toast.warning(`Only ${MAX_IMAGES} images allowed. Extras were ignored.`);
        // Revoke the previews we won't keep.
        accepted.slice(room).forEach((s) => URL.revokeObjectURL(s.preview));
      }
      return [...prev, ...trimmed];
    });

    if (rejected.length > 0) {
      toast.error(rejected[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    // Allow re-selecting the same file later.
    e.target.value = '';
  };

  const handleRemove = (id: string) => {
    setStaged((prev) => {
      const target = prev.find((s) => s.id === id);
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((s) => s.id !== id);
    });
  };

  // ── Drag and drop ──────────────────────────────────────────
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    // Only treat it as leave if we're leaving the drop zone itself,
    // not a child. relatedTarget tells us where focus is heading.
    if (
      dropZoneRef.current
      && e.relatedTarget instanceof Node
      && dropZoneRef.current.contains(e.relatedTarget)
    ) {
      return;
    }
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer?.files?.length) {
      addFiles(e.dataTransfer.files);
    }
  };

  // ── Mode metadata for the header ───────────────────────────
  const headerCopy = useMemo(() => {
    switch (mode) {
      case 'courier':
        return {
          title: 'Courier Dispatch',
          subtitle: 'Confirm courier details and upload the package photos.',
        };
      case 'company_vehicle':
        return {
          title: 'Company Vehicle Dispatch',
          subtitle: 'Capture the driver details and the package photos.',
        };
      case 'field_boy':
        return {
          title: 'Field Boy Dispatch',
          subtitle: 'Assign the field boy and upload the pickup photos.',
        };
    }
  }, [mode]);

  // ── Validation ─────────────────────────────────────────────
  // Photos are mandatory for courier + company_vehicle (coordinator
  // surfaces — the package gets handed to a third party and the
  // photos are the only proof of condition at hand-off). For the
  // field_boy mode the dispatcher is often already on the move with
  // a sample in hand, so we don't want a missing photo to block the
  // status flip. Treat photos as optional in that mode.
  const photosRequired = mode !== 'field_boy';

  const validationError = useMemo<string | null>(() => {
    if (photosRequired && staged.length === 0) {
      return 'Upload at least one photo of the package.';
    }
    switch (mode) {
      case 'courier':
        if (!courierService) return 'Choose the courier service.';
        if (courierService === 'Other' && !courierOther.trim()) {
          return 'Specify the courier name.';
        }
        return null;
      case 'company_vehicle':
        if (!driverName.trim())  return 'Driver name is required.';
        if (!driverPhone.trim()) return 'Driver number is required.';
        return null;
      case 'field_boy':
        if (!fieldBoy) return 'Choose a field boy.';
        return null;
    }
  }, [photosRequired, staged.length, mode, courierService, courierOther, driverName, driverPhone, fieldBoy]);

  // ── Upload helper ──────────────────────────────────────────
  /**
   * Uploads every staged file to `dispatch-images/<request_id>/...`
   * in parallel. Returns the list of public URLs in the same order
   * as `staged`.
   *
   * On failure, the partial uploads are best-effort removed so we
   * don't leak orphans into storage.
   */
  const uploadAll = async (): Promise<string[]> => {
    const uploadedPaths: string[] = [];

    try {
      const results = await Promise.all(
        staged.map(async (s, idx) => {
          const ext = s.file.name.split('.').pop() || 'jpg';
          const path = `${request.id}/${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from('dispatch-images')
            .upload(path, s.file, {
              cacheControl: '3600',
              upsert: false,
              contentType: s.file.type || undefined,
            });

          if (uploadError) throw new Error(`Upload failed for ${s.file.name}: ${uploadError.message}`);

          uploadedPaths.push(path);

          const { data } = supabase.storage.from('dispatch-images').getPublicUrl(path);
          return data.publicUrl;
        }),
      );
      return results;
    } catch (err) {
      // Best-effort orphan cleanup.
      if (uploadedPaths.length > 0) {
        try {
          await supabase.storage.from('dispatch-images').remove(uploadedPaths);
        } catch {
          // Swallow — the error from the original upload is what matters.
        }
      }
      throw err;
    }
  };

  // ── Submit ─────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setIsSubmitting(true);

    try {
      // 1. Upload images. Field-boy dispatch allows zero photos, so we
      //    skip the storage round-trip entirely in that case rather than
      //    relying on `Promise.all([])` returning [] — clearer intent
      //    and saves a brief mutation lock on the bucket.
      const imageUrls = staged.length === 0 ? [] : await uploadAll();

      // 2. Build the metadata payload — only set the fields relevant
      //    to the active mode so we don't carry stale data forward.
      const metadata: DispatchMetadata = {
        type:   mode,
        images: imageUrls,
        note:   note.trim() || undefined,
        dispatched_by_id:   profile?.id ?? null,
        dispatched_by_name: profile?.full_name ?? null,
      };

      if (mode === 'courier') {
        metadata.courier_service = courierService;
        if (courierService === 'Other') {
          metadata.courier_other_name = courierOther.trim();
        }
      } else if (mode === 'company_vehicle') {
        metadata.driver_name  = driverName.trim();
        metadata.driver_phone = driverPhone.trim();
      } else if (mode === 'field_boy') {
        metadata.field_boy = fieldBoy;
      }

      // 3. Status + metadata + timestamp + denormalised legacy note.
      //    We also write the existing dispatch_notes column so any
      //    UI built before migration 1016 still surfaces the courier
      //    label without having to dig into JSONB.
      const legacyNote = (() => {
        switch (mode) {
          case 'courier': {
            const svc = courierService === 'Other' ? courierOther.trim() : courierService;
            return note.trim() ? `Courier: ${svc}. ${note.trim()}` : `Courier: ${svc}`;
          }
          case 'company_vehicle': {
            const base = `Company vehicle — Driver: ${driverName.trim()} (${driverPhone.trim()})`;
            return note.trim() ? `${base}. ${note.trim()}` : base;
          }
          case 'field_boy':
            return note.trim() ? `Field boy: ${fieldBoy}. ${note.trim()}` : `Field boy: ${fieldBoy}`;
        }
      })();

      const { error: updateError } = await supabase
        .from('requests')
        .update({
          status:            'dispatched',
          dispatched_at:     new Date().toISOString(),
          dispatch_metadata: metadata,
          dispatch_notes:    legacyNote,
        })
        .eq('id', request.id);

      if (updateError) {
        // Best-effort cleanup so we don't leak uploaded images when
        // the status flip fails (e.g. RLS denied at the last second).
        try {
          await supabase.storage
            .from('dispatch-images')
            .remove(imageUrls
              .map((u) => {
                const marker = '/storage/v1/object/public/dispatch-images/';
                const idx = u.indexOf(marker);
                return idx >= 0 ? decodeURIComponent(u.slice(idx + marker.length)) : null;
              })
              .filter((p): p is string => !!p));
        } catch {
          // Same — original error wins.
        }
        throw updateError;
      }

      // 4. Cache invalidations.
      queryClient.invalidateQueries({ queryKey: ['requests'] });
      queryClient.invalidateQueries({ queryKey: ['request', request.id] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items'] });
      queryClient.invalidateQueries({ queryKey: ['request-with-items', request.id] });
      queryClient.invalidateQueries({ queryKey: ['request-timeline'] });
      queryClient.invalidateQueries({ queryKey: ['paginated-requests'] });
      queryClient.invalidateQueries({ queryKey: ['field-boy-ready-requests'] });
      queryClient.invalidateQueries({ queryKey: ['dispatcher-stats'] });
      queryClient.invalidateQueries({ queryKey: ['all-requests-stats'] });

      toast.success(`${request.request_number} marked as dispatched.`);
      onOpenChange(false);
      onDispatched?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to dispatch';
      toast.error(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!isSubmitting) onOpenChange(o); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:w-full sm:max-w-lg mx-auto max-h-[calc(100vh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700">
            <Truck className="h-5 w-5" />
            {headerCopy.title}
          </DialogTitle>
          <DialogDescription>
            {headerCopy.subtitle} Request <strong>{request.request_number}</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-3">
          {/* ── Multi-image uploader ───────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-slate-700">
                Package Photos{' '}
                {photosRequired ? (
                  <span className="text-red-500">*</span>
                ) : (
                  <span className="text-slate-400 font-normal">(Optional)</span>
                )}
              </Label>
              <span className="text-[11px] text-slate-400">
                {staged.length}/{MAX_IMAGES}
              </span>
            </div>

            <div
              ref={dropZoneRef}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`
                relative cursor-pointer rounded-xl border-2 border-dashed p-5 text-center transition-colors
                ${isDragging
                  ? 'border-indigo-500 bg-indigo-50/70'
                  : 'border-slate-300 bg-slate-50 hover:border-indigo-400 hover:bg-indigo-50/40'
                }
              `}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileInput}
                className="sr-only"
                aria-label="Choose photos"
              />
              <UploadCloud className="h-7 w-7 text-indigo-500 mx-auto mb-1.5" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-700">
                Tap to upload or drag &amp; drop
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                PNG / JPG / WEBP · Up to {MAX_FILE_MB} MB each
              </p>
            </div>

            {staged.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                {staged.map((s) => (
                  <div
                    key={s.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-slate-200 group bg-slate-100"
                  >
                    <img
                      src={s.preview}
                      alt={s.file.name}
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemove(s.id);
                      }}
                      disabled={isSubmitting}
                      aria-label={`Remove ${s.file.name}`}
                      className="absolute top-1 right-1 h-7 w-7 rounded-full bg-black/60 text-white inline-flex items-center justify-center opacity-90 hover:bg-red-600 hover:opacity-100 transition-colors disabled:opacity-40"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {staged.length < MAX_IMAGES && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSubmitting}
                    className="aspect-square rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors flex items-center justify-center disabled:opacity-50"
                    aria-label="Add another photo"
                  >
                    <ImagePlus className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ── Courier-specific fields ─────────────────────── */}
          {mode === 'courier' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Courier Service <span className="text-red-500">*</span>
                </Label>
                <Select value={courierService} onValueChange={setCourierService}>
                  <SelectTrigger className="h-10 border-slate-200">
                    <SelectValue placeholder="Choose courier service" />
                  </SelectTrigger>
                  <SelectContent>
                    {COURIER_SERVICES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {courierService === 'Other' && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium text-slate-700">
                    Courier Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    value={courierOther}
                    onChange={(e) => setCourierOther(e.target.value)}
                    placeholder="E.g., FedEx, India Post"
                    className="h-10 border-slate-200"
                  />
                </div>
              )}
            </div>
          )}

          {/* ── Company-vehicle-specific fields ─────────────── */}
          {mode === 'company_vehicle' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Driver Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  placeholder="E.g., Suresh Sharma"
                  className="h-10 border-slate-200"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-slate-700">
                  Driver Number <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={driverPhone}
                  onChange={(e) => setDriverPhone(e.target.value)}
                  placeholder="+91 9XXXX XXXXX"
                  className="h-10 border-slate-200"
                />
              </div>
            </div>
          )}

          {/* ── Field-boy-specific fields ───────────────────── */}
          {mode === 'field_boy' && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-slate-700">
                Field Boy <span className="text-red-500">*</span>
              </Label>
              <Select value={fieldBoy} onValueChange={setFieldBoy}>
                <SelectTrigger className="h-10 border-slate-200">
                  <SelectValue placeholder="Choose the field boy" />
                </SelectTrigger>
                <SelectContent>
                  {FIELD_BOYS.map((fb) => (
                    <SelectItem key={fb} value={fb}>{fb}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Optional note (shared) ──────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium text-slate-700">
              Note <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="E.g., Tracking #BD123456789. Handled with care."
              className="text-sm min-h-[60px] border-slate-200 resize-none"
              rows={2}
            />
            <p className="text-[11px] text-slate-500">
              Visible to the requester on the request details page.
            </p>
          </div>

          {/* ── Validation hint ─────────────────────────────── */}
          {validationError && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">{validationError}</p>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="min-h-[44px] py-2 px-4 text-sm font-semibold flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting || !!validationError}
            className="min-h-[44px] py-2 px-4 text-sm font-semibold flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Dispatching…
              </>
            ) : (
              <>
                <Truck className="mr-1.5 h-4 w-4" />
                Confirm Dispatch
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
