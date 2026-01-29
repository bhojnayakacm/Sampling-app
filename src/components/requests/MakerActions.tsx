import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUpdateRequestStatus } from '@/lib/api/requests';
import { toast } from 'sonner';
import type { Request } from '@/types';
import { Play, CheckCircle, Loader2, Clock, Truck, Hammer, AlertCircle } from 'lucide-react';

interface MakerActionsProps {
  request: Request;
  userRole: string;
  userId: string;
}

export default function MakerActions({ request, userRole, userId }: MakerActionsProps) {
  const updateStatus = useUpdateRequestStatus();

  const isCoordinator = userRole === 'coordinator';
  const isAssignedUser = request.assigned_to === userId;

  // Show actions if:
  // 1. User is assigned to this request (maker or self-assigned coordinator)
  // 2. OR user is a coordinator (manager override for any request)
  const canPerformActions = isAssignedUser || isCoordinator;

  const handleStatusUpdate = async (newStatus: string) => {
    // Deadline compliance: block overdue requests for makers
    if (request.required_by && new Date() > new Date(request.required_by)) {
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
        return;
      }
    }

    try {
      await updateStatus.mutateAsync({ requestId: request.id, status: newStatus });

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
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
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
              disabled={updateStatus.isPending}
              size="sm"
              className="h-9 px-4 bg-emerald-600 hover:bg-emerald-700 text-white gap-2 shrink-0"
            >
              {updateStatus.isPending ? (
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
            <Button
              onClick={() => handleStatusUpdate('ready')}
              disabled={updateStatus.isPending}
              size="sm"
              className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shrink-0"
            >
              {updateStatus.isPending ? (
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
    </Card>
  );
}
