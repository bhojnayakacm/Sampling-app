import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronRight, Headset, Phone, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

interface SupportContact {
  /** Who the requester is calling. */
  name: string;
  /** What they can help with — sets expectations before the call connects. */
  role: string;
  /** Local 10-digit number, digits only. The +91 is added at render time. */
  number: string;
  accent: string;
}

/**
 * Support numbers. Kept as data so adding a contact is a one-line change and
 * the dial links can never drift from the displayed digits — both are derived
 * from `number` below.
 */
const SUPPORT_CONTACTS: SupportContact[] = [
  {
    name: 'App Developer',
    role: 'Technical issues, bugs, app not working',
    number: '7290048997',
    accent: 'bg-indigo-50 text-indigo-600',
  },
  {
    name: 'Vijay',
    role: 'Marble Coordinator — urgent requests, approvals',
    number: '7290073526',
    accent: 'bg-emerald-50 text-emerald-600',
  },
];

/**
 * Marks the first-run highlight as seen. Written once and never cleared by the
 * app — discovering the button is a one-time event per browser.
 */
const HIGHLIGHT_STORAGE_KEY = 'hasSeenSupportFabHighlight';

/**
 * Whether the attention cue should render.
 *
 * Read LAZILY (inside useState) rather than in an effect, so the answer is
 * known before first paint. Reading it in a useEffect would flash the "New!"
 * bubble at every returning user for a frame before hiding it — tolerable for
 * a static banner, obnoxious for something that pulses.
 *
 * Fails CLOSED: if storage is unavailable (private mode, blocked cookies) a
 * dismissal cannot be persisted, so showing the cue would nag on every single
 * visit. Better to skip it than to repeat it forever.
 */
function readHighlightVisibility(): boolean {
  try {
    return localStorage.getItem(HIGHLIGHT_STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}

/** E.164 dial target. The dialer needs the country code, unformatted. */
function telHref(number: string): string {
  return `tel:+91${number}`;
}

/** Human-readable form: +91 72900 48997. Display only — never used as href. */
function displayNumber(number: string): string {
  return `+91 ${number.slice(0, 5)} ${number.slice(5)}`;
}

/**
 * Floating "Contact Support" button for requesters, with a one-time first-run
 * highlight so the affordance actually gets discovered.
 *
 * SELF-GATING: renders nothing unless the signed-in user is a requester. The
 * dashboard it mounts on is already requester-only at the route level, but
 * gating here too means dropping it on any other surface stays safe.
 *
 * Sits bottom-RIGHT deliberately: the offline Outbox pill occupies bottom-left,
 * so the two never overlap. The wrapper carries the iOS safe-area inset so the
 * button clears the home indicator in an installed PWA.
 */
export default function ContactSupportFab() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [showHighlight, setShowHighlight] = useState(readHighlightVisibility);

  if (profile?.role !== 'requester') return null;

  /**
   * Retire the cue permanently. State is updated synchronously alongside the
   * write, so the highlight is already gone by the time the dialog opens — it
   * cannot flicker back into view when the dialog is closed.
   */
  const dismissHighlight = () => {
    setShowHighlight(false);
    try {
      localStorage.setItem(HIGHLIGHT_STORAGE_KEY, '1');
    } catch {
      // Storage blocked — the cue stays hidden for this session at least.
    }
  };

  const handleFabClick = () => {
    dismissHighlight();
    setOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-40 safe-area-pb">
        <div className="relative">
          {/* Speech bubble pointing at the FAB. Slides in once on mount and
              then holds still — the pulsing ring below carries the ongoing
              motion, so the text stays comfortably readable. */}
          {showHighlight && (
            <div className="absolute right-full top-1/2 mr-3 -translate-y-1/2 animate-in fade-in slide-in-from-right-2 duration-500">
              <div className="relative flex items-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-2 shadow-lg">
                <span className="text-sm font-medium text-slate-800">
                  <span className="text-indigo-600">New!</span> Tap here for support
                </span>
                <button
                  type="button"
                  onClick={dismissHighlight}
                  aria-label="Dismiss support tip"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>

                {/* Tail: a rotated square whose two outward edges carry the
                    bubble border, so it reads as one seamless shape. */}
                <span
                  aria-hidden="true"
                  className="absolute -right-1 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-r border-t border-slate-200 bg-white"
                />
              </div>
            </div>
          )}

          {/* Pulsing ring. A sibling of the button rather than a child, and
              pointer-events-none, so the expanding ring can never swallow the
              tap it is advertising. Honours prefers-reduced-motion. */}
          {showHighlight && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 rounded-full bg-indigo-500 opacity-75 animate-ping motion-reduce:animate-none"
            />
          )}

          <button
            type="button"
            onClick={handleFabClick}
            aria-label="Contact support"
            className="relative flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-white shadow-lg shadow-indigo-600/25 transition-all hover:bg-indigo-700 hover:shadow-xl active:scale-95 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <Headset className="h-6 w-6" />
          </button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg">Need help?</DialogTitle>
            <DialogDescription>
              Tap a contact to call directly from your phone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-1">
            {SUPPORT_CONTACTS.map((contact) => (
              <a
                key={contact.number}
                href={telHref(contact.number)}
                // Closing on tap keeps the app in a clean state behind the
                // native dialer when the user returns.
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 min-h-[64px] transition-colors hover:bg-slate-50 active:bg-slate-100"
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${contact.accent}`}
                >
                  <Phone className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-900 truncate">
                    {contact.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{contact.role}</p>
                  <p className="text-sm font-medium text-indigo-600 mt-0.5">
                    {displayNumber(contact.number)}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </a>
            ))}
          </div>

          <p className="text-xs text-slate-400 text-center pt-1">
            Available during working hours.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
