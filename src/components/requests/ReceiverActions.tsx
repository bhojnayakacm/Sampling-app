import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PackageCheck, User } from 'lucide-react';
import ReceiveConfirmDialog from './ReceiveConfirmDialog';
import type { Request } from '@/types';

interface ReceiverActionsProps {
  request: Request;
}

/**
 * Sticky bottom action bar shown ONLY to the requester (i.e. the user
 * who created the request). Surfaces the "Mark as Received" action
 * prominently on `RequestDetail` so the requester doesn't have to
 * hunt for it inside the timeline dialog.
 *
 * Visibility matrix
 * ─────────────────
 *   status = 'dispatched'                            → show
 *   status = 'ready' AND pickup = self_pickup        → show
 *   everything else                                  → render nothing
 *
 * The actual confirmation flow lives in `ReceiveConfirmDialog`
 * (which captures the receiver's name) — we just open it.
 */
export default function ReceiverActions({ request }: ReceiverActionsProps) {
  const [open, setOpen] = useState(false);

  const isSelfPickup    = request.pickup_responsibility === 'self_pickup';
  const showOnDispatch  = request.status === 'dispatched';
  const showOnSelfReady = request.status === 'ready' && isSelfPickup;

  if (!showOnDispatch && !showOnSelfReady) return null;

  const subtitle = showOnSelfReady
    ? 'Your sample is ready at the studio. Tap to confirm pickup.'
    : 'Your sample has been dispatched. Tap to confirm you received it.';

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] z-20 safe-area-pb">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="hidden sm:flex items-center gap-3 min-w-0">
              <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                <User className="h-4 w-4 text-teal-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">Your action</p>
                <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
              </div>
            </div>
            <div className="flex-1 sm:flex-initial">
              <Button
                onClick={() => setOpen(true)}
                size="sm"
                className="w-full sm:w-auto h-11 sm:h-10 px-5 bg-teal-600 hover:bg-teal-700 text-white gap-2 text-sm font-semibold"
              >
                <PackageCheck className="h-4 w-4" />
                Mark as Received
              </Button>
            </div>
          </div>
        </div>
      </div>

      <ReceiveConfirmDialog
        request={request}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
