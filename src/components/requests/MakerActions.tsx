import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useUpdateRequestStatus } from '@/lib/api/requests';
import { toast } from 'sonner';
import type { Request } from '@/types';
import { Play, CheckCircle, Loader2, Clock, Truck, Hammer, AlertCircle } from 'lucide-react';

/**
 * Milliseconds the action button stays disabled after a successful status
 * change.
 *
 * THE BUG THIS FIXES: "Start" (assigned → in_production) and "Mark Ready"
 * (in_production → ready) render in the SAME position. The moment "Start"
 * succeeds the card re-renders and "Mark Ready" appears under the maker's
 * finger, so the second tap of an accidental double-tap lands on it and the
 * sample skips production entirely. The cooldown swallows that second tap;
 * the confirmation dialog below is the hard stop behind it.
 */
const POST_ACTION_COOLDOWN_MS = 1500;

interface MakerActionsProps {
  request: Request;
  userRole: string;
  userId: string;
}

export default function MakerActions({ request, userRole, userId }: MakerActionsProps) {
  const updateStatus = useUpdateRequestStatus();

  // Synchronous re-entry guard. `updateStatus.isPending` only turns true
  // after React re-renders, which leaves a window where two taps in the same
  // frame both fire the mutation. A ref flips immediately, so the second call
  // returns before it can reach the network.
  const inFlightRef = useRef(false);

  // Post-success cooldown — see POST_ACTION_COOLDOWN_MS.
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Confirmation gate for the destructive-by-mistake "Mark Ready" transition.
  const [confirmReadyOpen, setConfirmReadyOpen] = useState(false);

  // Clear the pending timer if the component unmounts mid-cooldown.
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    };
  }, []);

  const startCooldown = () => {
    setIsCoolingDown(true);
    if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
    cooldownTimerRef.current = setTimeout(
      () => setIsCoolingDown(false),
      POST_ACTION_COOLDOWN_MS,
    );
  };

  // Single source of truth for "no action may be taken right now".
  const isBusy = updateStatus.isPending || isCoolingDown;

  const isCoordinator = ['coordinator', 'marble_coordinator', 'magro_coordinator'].includes(userRole);
  const isAssignedUser = request.assigned_to === userId;

  // Show actions if:
  // 1. User is assigned to this request (maker or self-assigned coordinator)
  // 2. OR user is a coordinator (manager override for any request)
  const canPerformActions = isAssignedUser || isCoordinator;

  // Statuses where the physical work is already done (or being confirmed
  // as done). The deadline gate is skipped for these to unblock makers
  // who finish a sample late — better to record it as 'ready' than force
  // a coordinator round-trip just to nudge the deadline.
  const DEADLINE_BYPASS_STATUSES = new Set(['ready', 'dispatched', 'received']);

  /**
   * Returns false ONLY when the mutation itself failed, so a caller (the
   * confirm dialog) can stay open for a retry. Guard/deadline early-exits
   * return true — nothing was changed and their toast already explains why,
   * so the dialog should close.
   */
  const handleStatusUpdate = async (newStatus: string): Promise<boolean> => {
    // Absorb stray double-taps before anything else can run.
    if (inFlightRef.current || isCoolingDown) return true;

    // Deadline compliance: block overdue requests for makers, but only
    // for transitions that aren't already terminal physical-work states.
    //
    // Belt-and-suspenders requester guard: this toast text is targeted at
    // makers ("contact the Coordinator..."). RequestDetail's render gate
    // (`isMaker && assigned_to === profile.id`) should already prevent
    // this component from mounting for a requester, but if a future
    // regression loosens that gate — or if a profile with role
    // 'requester' is somehow assigned to the request — we must not fire
    // a maker-targeted deadline block at the requester. Requesters
    // confirming receipt should NEVER be blocked here.
    const isRequesterCaller = userRole === 'requester';
    const bypassDeadline = DEADLINE_BYPASS_STATUSES.has(newStatus);
    if (!isRequesterCaller && !bypassDeadline && request.required_by && new Date() > new Date(request.required_by)) {
      if (!isCoordinator) {
        toast.error(
          <div className="flex items-start gap-2">
            <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-bold">Deadline Exceeded</p>
              <p className="text-sm">Please contact the Coordinator to extend the date before proceeding.</p>
            </div>
          </div>,
          { duration: 5000 }
        );
        return true;
      }
    }

    inFlightRef.current = true;
    try {
      await updateStatus.mutateAsync({ requestId: request.id, status: newStatus });

      // Freeze the (now swapped) button so the second tap of a double-tap
      // can't immediately trigger the next transition.
      startCooldown();

      if (newStatus === 'in_production') {
        toast.success(
          <div>
            <p className="font-bold">Production Started!</p>
            <p className="text-sm">{isAssignedUser ? 'You can now begin working on this sample.' : 'Status updated on behalf of the maker.'}</p>
          </div>
        );
      } else if (newStatus === 'ready') {
        toast.success(
          <div>
            <p className="font-bold">Marked as Ready!</p>
            <p className="text-sm">The sample is ready for dispatch.</p>
          </div>
        );
      }
      return true;
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  // Hide if user cannot perform actions
  if (!canPerformActions) {
    return null;
  }

  // Completed states - show simple status card
  if (['ready', 'dispatched', 'received'].includes(request.status)) {
    const statusConfig = {
      ready: {
        icon: CheckCircle,
        title: 'Ready for Dispatch',
        subtitle: 'Waiting for coordinator to dispatch',
        bgColor: 'bg-emerald-50',
        borderColor: 'border-emerald-200',
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        textColor: 'text-emerald-700',
      },
      dispatched: {
        icon: Truck,
        title: 'Dispatched',
        subtitle: 'Sample has been sent out',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        textColor: 'text-blue-700',
      },
      received: {
        icon: CheckCircle,
        title: 'Delivered',
        subtitle: 'Sample confirmed received',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        iconBg: 'bg-green-100',
        iconColor: 'text-green-600',
        textColor: 'text-green-700',
      },
    };

    const config = statusConfig[request.status as keyof typeof statusConfig];
    const Icon = config.icon;

    return (
      <Card className={`mt-5 ${config.bgColor} border ${config.borderColor} shadow-sm`}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-lg ${config.iconBg} flex items-center justify-center`}>
              <Icon className={`h-5 w-5 ${config.iconColor}`} />
            </div>
            <div>
              <p className={`text-sm font-semibold ${config.textColor}`}>{config.title}</p>
              <p className="text-xs text-slate-500">{config.subtitle}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Active states - show action card
  const isAssigned = request.status === 'assigned';
  const isInProduction = request.status === 'in_production';

  return (
    <Card className="mt-5 bg-white border border-slate-200 shadow-sm">
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          {/* Left: Status indicator */}
          <div className="flex items-center gap-3 min-w-0">
            <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${
              isAssigned ? 'bg-blue-100' : 'bg-amber-100'
            }`}>
              {isAssigned ? (
                <Clock className="h-5 w-5 text-blue-600" />
              ) : (
                <Hammer className="h-5 w-5 text-amber-600" />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">
                {isAssigned ? 'Ready to Start' : 'In Production'}
              </p>
              <p className="text-xs text-slate-500 truncate">
                {isAssigned ? 'Click to begin work' : 'Mark ready when done'}
              </p>
            </div>
          </div>

          {/* Right: Action button */}
          {isAssigned && (
            <Button
              onClick={() => handleStatusUpdate('in_production')}
              disabled={isBusy}
              size="sm"
              className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  <span className="hidden sm:inline">Start</span>
                </>
              )}
            </Button>
          )}

          {isInProduction && (
            // Opens a confirmation instead of transitioning directly — this
            // button occupies the same spot "Start" just vacated.
            <Button
              onClick={() => setConfirmReadyOpen(true)}
              disabled={isBusy}
              size="sm"
              className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shrink-0"
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark Ready</span>
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>

      {/* Confirmation gate for in_production → ready. */}
      <AlertDialog open={confirmReadyOpen} onOpenChange={setConfirmReadyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this sample as ready?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure this sample is completely finished and ready for pickup?
              {request.request_number && (
                <span className="mt-2 block font-medium text-slate-700">
                  {request.request_number}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={updateStatus.isPending}>
              No, still working
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={updateStatus.isPending}
              onClick={(e) => {
                // Keep the dialog mounted until the mutation settles so the
                // confirm button can show its own pending state.
                e.preventDefault();
                void handleStatusUpdate('ready').then((ok) => {
                  if (ok) setConfirmReadyOpen(false);
                });
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateStatus.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Marking…
                </>
              ) : (
                'Yes, it is ready'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
