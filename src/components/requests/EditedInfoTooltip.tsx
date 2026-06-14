import { useEffect, useRef, useState } from 'react';
import { Info } from 'lucide-react';

/**
 * A small, touch-friendly Info icon that reveals a coordinator's
 * edit reason in a popover bubble. Used in RequestDetail beside any
 * field that has been edited post-submission (sample_size,
 * pickup_responsibility, delivery_address).
 *
 * Behaviour
 * ─────────
 *   • Tap / click the icon → toggles the popover.
 *   • Click outside → closes.
 *   • Keyboard: Enter / Space toggles, Esc closes.
 *
 * Responsive notes
 * ────────────────
 *   • The trigger uses `p-1` for a minimum tap target ≥ 28×28px
 *     once you account for the icon's own bounds — comfortable on
 *     iOS / Android without zooming.
 *   • The bubble is `right-0` aligned so it pulls left rather than
 *     overflowing the viewport on small screens; max-width is
 *     bounded so it wraps before reaching the edge.
 */
interface EditedInfoTooltipProps {
  /** Human-readable label shown as the bubble heading (e.g., "Reason for edit"). */
  label: string;
  /** The actual reason text supplied by the coordinator. */
  reason: string;
  /** Accessible name for the icon button. */
  ariaLabel?: string;
}

export default function EditedInfoTooltip({
  label,
  reason,
  ariaLabel = 'View edit reason',
}: EditedInfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  // Dismiss on outside click + Escape
  useEffect(() => {
    if (!open) return;
    const handleClickAway = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', handleClickAway);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleClickAway);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  if (!reason || !reason.trim()) return null;

  return (
    <span ref={containerRef} className="relative inline-flex items-center align-middle">
      <button
        type="button"
        aria-label={ariaLabel}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
        className="inline-flex items-center justify-center p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 transition-colors"
      >
        <Info className="w-4 h-4" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute z-30 top-full right-0 mt-1.5 w-[min(16rem,calc(100vw-2rem))] max-w-xs rounded-lg border border-slate-200 bg-white shadow-lg p-2.5 text-left animate-in fade-in zoom-in-95 duration-100"
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
            {label}
          </span>
          <span className="block text-xs text-slate-700 leading-relaxed whitespace-pre-line break-words">
            {reason}
          </span>
        </span>
      )}
    </span>
  );
}
