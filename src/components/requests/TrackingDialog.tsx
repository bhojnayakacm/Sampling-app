import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRequestTimeline, useMarkAsReceived } from '@/lib/api/requests';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime } from '@/lib/utils';
import { Request, RequestStatus } from '@/types';
import ReceiveConfirmDialog from './ReceiveConfirmDialog';
import {
  MapPin,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  PackageCheck,
  XCircle,
  Loader2,
  Box,
} from 'lucide-react';
import { toast } from 'sonner';

interface TrackingDialogProps {
  request: Request;
  trigger?: React.ReactNode;
}

// Timeline step configuration
const TIMELINE_STEPS = [
  {
    status: 'pending_approval' as RequestStatus,
    label: 'Request Placed',
    description: 'Request submitted for approval',
    icon: MapPin,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
  },
  {
    status: 'approved' as RequestStatus,
    label: 'Approved',
    description: 'Request approved by coordinator',
    icon: CheckCircle2,
    color: 'text-green-600',
    bgColor: 'bg-green-100',
  },
  {
    status: 'in_production' as RequestStatus,
    label: 'In Production',
    description: 'Sample being prepared',
    icon: Package,
    color: 'text-purple-600',
    bgColor: 'bg-purple-100',
  },
  {
    status: 'ready' as RequestStatus,
    label: 'Ready',
    description: 'Sample completed and ready for dispatch',
    icon: Box,
    color: 'text-amber-600',
    bgColor: 'bg-amber-100',
  },
  {
    status: 'dispatched' as RequestStatus,
    label: 'Dispatched',
    description: 'Sample shipped to destination',
    icon: Truck,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
  },
  {
    status: 'received' as RequestStatus,
    label: 'Received',
    description: 'Sample delivered and confirmed',
    icon: PackageCheck,
    color: 'text-teal-600',
    bgColor: 'bg-teal-100',
  },
];

export default function TrackingDialog({ request, trigger }: TrackingDialogProps) {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);

  const { data: history, isLoading } = useRequestTimeline(request.id);
  const markAsReceived = useMarkAsReceived();

  // Check if self pickup - skip dispatched step
  const isSelfPickup = request.pickup_responsibility === 'self_pickup';

  // Both requester and coordinator can mark as received
  const isRequester = profile?.id === request.created_by;
  const isCoordinator = profile?.role === 'coordinator';
  const canMarkReceived = (isRequester || isCoordinator) && (
    request.status === 'dispatched' ||
    (request.status === 'ready' && isSelfPickup)
  );

  // Dynamic timeline steps - filter out "Dispatched" for self pickup
  const timelineSteps = isSelfPickup
    ? TIMELINE_STEPS.filter((step) => step.status !== 'dispatched')
    : TIMELINE_STEPS;

  // Find the timestamp for each step
  const getStepTimestamp = (status: RequestStatus) => {
    const historyItem = history?.find((h) => h.status === status);
    return historyItem?.changed_at;
  };

  // Get current step index (using filtered timeline for self pickup)
  const getCurrentStepIndex = () => {
    const currentStepIndex = timelineSteps.findIndex((step) => step.status === request.status);
    return currentStepIndex >= 0 ? currentStepIndex : 0;
  };

  const currentStepIndex = getCurrentStepIndex();

  // Handle "Mark as Received" click — self-pickup auto-completes, others open modal
  const handleMarkReceivedClick = async () => {
    if (isSelfPickup) {
      try {
        await markAsReceived.mutateAsync({
          requestId: request.id,
          receivedBy: request.creator?.full_name || 'Requester (Self Pickup)',
        });
        toast.success('Sample marked as received!');
        setOpen(false);
      } catch (error: any) {
        toast.error(error.message || 'Failed to mark as received');
      }
    } else {
      setReceiveDialogOpen(true);
    }
  };

  // Check if request is rejected or draft
  const isRejected = request.status === 'rejected';
  const isDraft = request.status === 'draft';

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {trigger || (
            <Button variant="outline" size="sm">
              <MapPin className="h-4 w-4 mr-2" />
              Track
            </Button>
          )}
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-blue-600" />
              Track Sample: {request.request_number}
            </DialogTitle>
            <DialogDescription>
              {request.client_project_name} - {request.company_firm_name}
            </DialogDescription>
          </DialogHeader>

          {/* Loading State */}
          {isLoading && (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-4">Loading tracking information...</p>
            </div>
          )}

          {/* Draft/Rejected State */}
          {!isLoading && (isDraft || isRejected) && (
            <div className="py-12 text-center">
              <XCircle className="h-12 w-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-500 text-lg font-medium">
                {isDraft ? 'This request is still a draft' : 'This request has been rejected'}
              </p>
              <p className="text-gray-400 text-sm mt-2">
                {isDraft
                  ? 'Submit the request to start tracking'
                  : 'Rejected requests cannot be tracked'}
              </p>
            </div>
          )}

          {/* Timeline */}
          {!isLoading && !isDraft && !isRejected && (
            <div className="py-6">
              <div className="relative">
                {timelineSteps.map((step, index) => {
                  const timestamp = getStepTimestamp(step.status);
                  const isCompleted = !!timestamp;
                  const isCurrent = index === currentStepIndex && !timestamp;
                  const isFuture = index > currentStepIndex;

                  const Icon = step.icon;

                  return (
                    <div key={step.status} className="relative pb-8 last:pb-0">
                      {/* Vertical Line */}
                      {index < timelineSteps.length - 1 && (
                        <div
                          className={`absolute left-5 top-10 h-full w-0.5 ${
                            isCompleted ? 'bg-green-500' : 'bg-gray-200'
                          }`}
                        />
                      )}

                      {/* Step Content */}
                      <div className="flex items-start gap-4">
                        {/* Icon */}
                        <div
                          className={`relative z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 ${
                            isCompleted
                              ? 'border-green-500 bg-green-500 text-white'
                              : isCurrent
                              ? `border-${step.color.split('-')[1]}-500 ${step.bgColor} ${step.color} animate-pulse`
                              : 'border-gray-300 bg-white text-gray-400'
                          }`}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="h-6 w-6" />
                          ) : (
                            <Icon className="h-5 w-5" />
                          )}
                        </div>

                        {/* Step Details */}
                        <div className="flex-1 pt-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4
                              className={`font-semibold ${
                                isCompleted || isCurrent ? 'text-gray-900' : 'text-gray-400'
                              }`}
                            >
                              {step.label}
                            </h4>
                            {isCurrent && (
                              <Badge variant="default" className="text-xs">
                                Current
                              </Badge>
                            )}
                          </div>
                          <p
                            className={`text-sm ${
                              isCompleted || isCurrent ? 'text-gray-600' : 'text-gray-400'
                            }`}
                          >
                            {step.description}
                          </p>
                          {timestamp && (
                            <div className="flex items-center gap-1 mt-2 text-xs text-gray-500">
                              <Clock className="h-3 w-3" />
                              <span>{formatDateTime(timestamp)}</span>
                            </div>
                          )}
                          {isFuture && !timestamp && (
                            <p className="text-xs text-gray-400 mt-2 italic">Pending</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          {!isLoading && !isDraft && !isRejected && (
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Close
              </Button>
              {canMarkReceived && (
                <Button
                  onClick={handleMarkReceivedClick}
                  disabled={markAsReceived.isPending}
                  className="bg-teal-600 hover:bg-teal-700"
                >
                  {markAsReceived.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <PackageCheck className="mr-2 h-4 w-4" />
                      Mark as Received
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>

      {/* Receive Confirmation Modal (for non-self-pickup) */}
      <ReceiveConfirmDialog
        request={request}
        open={receiveDialogOpen}
        onOpenChange={setReceiveDialogOpen}
        onSuccess={() => setOpen(false)}
      />
    </>
  );
}
