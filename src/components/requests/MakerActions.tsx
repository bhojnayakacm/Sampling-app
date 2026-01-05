import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useUpdateRequestStatus } from '@/lib/api/requests';
import { toast } from 'sonner';
import type { Request } from '@/types';
import { Play, CheckCircle, Loader2, Clock, Truck, Hammer } from 'lucide-react';

interface MakerActionsProps {
  request: Request;
  userRole: string;
  userId: string;
}

export default function MakerActions({ request, userRole, userId }: MakerActionsProps) {
  const updateStatus = useUpdateRequestStatus();

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ requestId: request.id, status: newStatus });

      // Show appropriate success message
      if (newStatus === 'in_production') {
        toast.success(
          <div>
            <p className="font-bold">Production Started!</p>
            <p className="text-sm">You can now begin working on this sample.</p>
          </div>
        );
      } else if (newStatus === 'ready') {
        toast.success(
          <div>
            <p className="font-bold">Marked as Ready!</p>
            <p className="text-sm">The coordinator will be notified for dispatch.</p>
          </div>
        );
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  // Only show to makers, and only for their assigned requests
  if (userRole !== 'maker' || request.assigned_to !== userId) {
    return null;
  }

  // Don't show if the request is already ready, dispatched, or received
  if (['ready', 'dispatched', 'received'].includes(request.status)) {
    return (
      <Card className="mt-6 border-0 shadow-lg bg-gradient-to-br from-emerald-50 to-green-50 overflow-hidden">
        <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-green-500" />
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              {request.status === 'ready' && <CheckCircle className="h-7 w-7 text-white" />}
              {request.status === 'dispatched' && <Truck className="h-7 w-7 text-white" />}
              {request.status === 'received' && <CheckCircle className="h-7 w-7 text-white" />}
            </div>
            <div>
              <h3 className="text-xl font-bold text-emerald-800">
                {request.status === 'ready' && 'Sample Ready for Dispatch'}
                {request.status === 'dispatched' && 'Sample Dispatched'}
                {request.status === 'received' && 'Sample Delivered'}
              </h3>
              <p className="text-emerald-600">
                {request.status === 'ready' && 'Great work! Waiting for coordinator to dispatch.'}
                {request.status === 'dispatched' && 'This sample has been sent out.'}
                {request.status === 'received' && 'This sample has been delivered and confirmed.'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-0 shadow-xl bg-white/80 backdrop-blur-sm overflow-hidden">
      {/* Status-based accent bar */}
      <div className={`h-1.5 ${
        request.status === 'assigned'
          ? 'bg-gradient-to-r from-emerald-500 to-green-500'
          : 'bg-gradient-to-r from-blue-500 to-indigo-500'
      }`} />

      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <div className={`h-14 w-14 rounded-xl flex items-center justify-center shadow-lg ${
            request.status === 'assigned'
              ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
              : 'bg-gradient-to-br from-blue-500 to-indigo-600 shadow-blue-500/30'
          }`}>
            <Hammer className="h-7 w-7 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-800">Production Actions</h3>
            <p className="text-slate-500">
              {request.status === 'assigned' && 'Ready to start working on this sample'}
              {request.status === 'in_production' && 'Currently in production'}
            </p>
          </div>
        </div>

        {/* Current Status Indicator */}
        <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${
          request.status === 'assigned'
            ? 'bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200'
            : 'bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200'
        }`}>
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            request.status === 'assigned' ? 'bg-blue-100' : 'bg-amber-100'
          }`}>
            {request.status === 'assigned' && <Clock className="h-5 w-5 text-blue-600" />}
            {request.status === 'in_production' && <Hammer className="h-5 w-5 text-amber-600" />}
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Current Status</p>
            <p className={`font-bold ${
              request.status === 'assigned' ? 'text-blue-700' : 'text-amber-700'
            }`}>
              {request.status === 'assigned' ? 'Assigned - Not Started' : 'In Production'}
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        {request.status === 'assigned' && (
          <Button
            onClick={() => handleStatusUpdate('in_production')}
            disabled={updateStatus.isPending}
            className="w-full min-h-[80px] text-xl font-black gap-4 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 shadow-xl shadow-emerald-500/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
          >
            {updateStatus.isPending ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Play className="h-7 w-7" />
                START PRODUCTION
              </>
            )}
          </Button>
        )}

        {request.status === 'in_production' && (
          <Button
            onClick={() => handleStatusUpdate('ready')}
            disabled={updateStatus.isPending}
            className="w-full min-h-[80px] text-xl font-black gap-4 bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-xl shadow-blue-500/30 transition-all duration-200 hover:scale-[1.02] hover:shadow-2xl"
          >
            {updateStatus.isPending ? (
              <>
                <Loader2 className="h-7 w-7 animate-spin" />
                Updating...
              </>
            ) : (
              <>
                <CheckCircle className="h-7 w-7" />
                MARK AS READY
              </>
            )}
          </Button>
        )}

        {/* Help Text */}
        <p className="text-sm text-slate-500 text-center mt-4">
          {request.status === 'assigned' && (
            <>Click <strong>Start Production</strong> when you begin working on this sample.</>
          )}
          {request.status === 'in_production' && (
            <>Click <strong>Mark as Ready</strong> when the sample is complete and ready for dispatch.</>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
