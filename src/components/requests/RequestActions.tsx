import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useMakers } from '@/lib/api/users';
import { useAssignRequest, useUpdateRequestStatus, useUpdateRequiredBy } from '@/lib/api/requests';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Request } from '@/types';
import { CheckCircle, XCircle, Loader2, Truck, UserPlus, Calendar, AlertCircle, Play, PackageCheck } from 'lucide-react';
import { useMarkAsReceived } from '@/lib/api/requests';
import ReceiveConfirmDialog from './ReceiveConfirmDialog';
import { formatDateTime } from '@/lib/utils';

interface RequestActionsProps {
  request: Request;
  userRole: string;
  isCompact?: boolean;
  onDeadlineBlock?: () => void;
}

export default function RequestActions({ request, userRole, isCompact = false, onDeadlineBlock }: RequestActionsProps) {
  const { profile } = useAuth();
  const { data: makers } = useMakers();
  const assignRequest = useAssignRequest();
  const updateStatus = useUpdateRequestStatus();
  const updateRequiredBy = useUpdateRequiredBy();
  const markAsReceived = useMarkAsReceived();

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [receiveDialogOpen, setReceiveDialogOpen] = useState(false);
  const [selectedMaker, setSelectedMaker] = useState('');
  const [message, setMessage] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  // Required By date editing state (for approval dialog)
  const [editedRequiredBy, setEditedRequiredBy] = useState('');
  const originalRequiredBy = request.required_by;

  // Convert ISO date to datetime-local format for input
  const toDateTimeLocal = (isoDate: string) => {
    const date = new Date(isoDate);
    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);
    return localDate.toISOString().slice(0, 16);
  };

  // Initialize editedRequiredBy when dialog opens
  useEffect(() => {
    if (approveDialogOpen && request.required_by) {
      setEditedRequiredBy(toDateTimeLocal(request.required_by));
    }
  }, [approveDialogOpen, request.required_by]);

  // Check if required_by date was modified (compare at minute precision)
  const isRequiredByModified = () => {
    if (!editedRequiredBy || !originalRequiredBy) return false;
    // Compare at minute precision since datetime-local input truncates seconds
    const editedMinutes = new Date(editedRequiredBy).getTime();
    const originalMinutes = new Date(originalRequiredBy).getTime();
    // Round both to nearest minute for fair comparison
    const editedRounded = Math.floor(editedMinutes / 60000) * 60000;
    const originalRounded = Math.floor(originalMinutes / 60000) * 60000;
    return editedRounded !== originalRounded;
  };

  const handleAssign = async () => {
    if (!selectedMaker) {
      toast.error('Please select a maker');
      return;
    }
    try {
      await assignRequest.mutateAsync({ requestId: request.id, makerId: selectedMaker });
      toast.success('Request assigned to maker');
      setAssignDialogOpen(false);
      setSelectedMaker('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign request');
    }
  };

  const handleApprove = async () => {
    try {
      // If required_by date was modified, update it with history log
      if (isRequiredByModified()) {
        const newDate = new Date(editedRequiredBy).toISOString();
        await updateRequiredBy.mutateAsync({
          requestId: request.id,
          newDate: newDate,
          reason: 'Changed during approval',
          changedByName: profile?.full_name || 'Coordinator',
        });
      }

      // Then approve the request
      await updateStatus.mutateAsync({
        requestId: request.id,
        status: 'approved',
        message: message.trim() || undefined,
      });
      toast.success('Request approved successfully!');
      setApproveDialogOpen(false);
      setMessage('');
      setEditedRequiredBy('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to approve request');
    }
  };

  const handleReject = async () => {
    try {
      await updateStatus.mutateAsync({
        requestId: request.id,
        status: 'rejected',
        message: message.trim() || undefined,
      });
      toast.success('Request rejected');
      setRejectDialogOpen(false);
      setMessage('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to reject request');
    }
  };

  const handleDispatchClick = () => {
    if (!checkDeadlineCompliance()) return;
    setDispatchDialogOpen(true);
  };

  const handleDispatch = async () => {
    try {
      await updateStatus.mutateAsync({
        requestId: request.id,
        status: 'dispatched',
        dispatchNotes: dispatchNotes.trim() || undefined,
      });
      toast.success('Request marked as dispatched!');
      setDispatchDialogOpen(false);
      setDispatchNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to dispatch request');
    }
  };

  // Deadline compliance: check if overdue before any forward status change
  const checkDeadlineCompliance = (): boolean => {
    if (!request.required_by) return true;
    if (new Date() <= new Date(request.required_by)) return true;

    toast.error(
      <div className="flex items-start gap-2">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold">Deadline Exceeded</p>
          <p className="text-sm">Please extend the 'Required By' date before moving to the next stage.</p>
        </div>
      </div>,
      { duration: 5000 }
    );
    onDeadlineBlock?.();
    return false;
  };

  // Coordinator override: directly update status (Start Production / Mark Ready)
  const handleStatusUpdate = async (newStatus: string) => {
    if (!checkDeadlineCompliance()) return;

    try {
      await updateStatus.mutateAsync({ requestId: request.id, status: newStatus });

      if (newStatus === 'in_production') {
        toast.success(
          <div>
            <p className="font-bold">Production Started!</p>
            <p className="text-sm">Status updated on behalf of the maker.</p>
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

  // Only coordinators can manage requests (not admins)
  if (userRole !== 'coordinator') {
    return null;
  }

  // Check if self pickup - coordinator doesn't need to dispatch
  const isSelfPickup = request.pickup_responsibility === 'self_pickup';

  // Can coordinator mark as received? (dispatched, or ready + self_pickup)
  const canCoordinatorReceive =
    request.status === 'dispatched' || (request.status === 'ready' && isSelfPickup);

  // Handle "Mark as Received" — self-pickup auto-completes, others open modal
  const handleMarkReceivedClick = async () => {
    if (isSelfPickup) {
      try {
        await markAsReceived.mutateAsync({
          requestId: request.id,
          receivedBy: request.creator?.full_name || 'Requester (Self Pickup)',
        });
        toast.success('Sample marked as received!');
      } catch (error: any) {
        toast.error(error.message || 'Failed to mark as received');
      }
    } else {
      setReceiveDialogOpen(true);
    }
  };

  // Compact mode for sticky action bar
  if (isCompact) {
    return (
      <>
        <div className="flex items-center gap-2">
          {request.status === 'pending_approval' && (
            <>
              <Button
                onClick={() => setApproveDialogOpen(true)}
                size="sm"
                className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
              >
                <CheckCircle className="h-4 w-4" />
                Approve
              </Button>
              <Button
                onClick={() => setRejectDialogOpen(true)}
                size="sm"
                variant="outline"
                className="h-9 border-red-200 text-red-600 hover:bg-red-50 gap-1.5"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </Button>
            </>
          )}

          {request.status === 'approved' && (
            <Button
              onClick={() => setAssignDialogOpen(true)}
              size="sm"
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              <UserPlus className="h-4 w-4" />
              Assign Maker
            </Button>
          )}

          {/* Coordinator Override: Start Production (for assigned requests) */}
          {request.status === 'assigned' && (
            <Button
              onClick={() => handleStatusUpdate('in_production')}
              size="sm"
              disabled={updateStatus.isPending}
              className="h-9 bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Start Production
                </>
              )}
            </Button>
          )}

          {/* Coordinator Override: Mark as Ready (for in_production requests) */}
          {request.status === 'in_production' && (
            <Button
              onClick={() => handleStatusUpdate('ready')}
              size="sm"
              disabled={updateStatus.isPending}
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              {updateStatus.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Mark Ready
                </>
              )}
            </Button>
          )}

          {/* Hide Dispatch button for Self Pickup - requester will mark as received directly */}
          {request.status === 'ready' && !isSelfPickup && (
            <Button
              onClick={handleDispatchClick}
              size="sm"
              className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5"
            >
              <Truck className="h-4 w-4" />
              Dispatch
            </Button>
          )}

          {/* Mark as Received: for dispatched OR ready + self_pickup */}
          {canCoordinatorReceive && (
            <Button
              onClick={handleMarkReceivedClick}
              size="sm"
              disabled={markAsReceived.isPending}
              className="h-9 bg-teal-600 hover:bg-teal-700 text-white gap-1.5"
            >
              {markAsReceived.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PackageCheck className="h-4 w-4" />
                  Mark Received
                </>
              )}
            </Button>
          )}

          {!['pending_approval', 'approved', 'ready', 'assigned', 'in_production', 'dispatched'].includes(request.status) && (
            <span className="text-sm text-slate-500 capitalize">
              {request.status.replace(/_/g, ' ')}
            </span>
          )}
        </div>

        {/* Dialogs remain the same for compact mode */}
        {renderDialogs()}
      </>
    );
  }

  // Helper function to render dialogs (shared between compact and full mode)
  function renderDialogs() {
    return (
      <>
        {/* Approve Dialog */}
        <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-green-700">
                <CheckCircle className="h-5 w-5" />
                Approve Request
              </DialogTitle>
              <DialogDescription>
                Approve request <strong>{request.request_number}</strong> for{' '}
                <strong>{request.client_project_name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Required By Date Editor */}
              <div className="space-y-2">
                <Label htmlFor="required-by-date" className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-500" />
                  Required By Date
                </Label>
                <div className="space-y-2">
                  <Input
                    id="required-by-date"
                    type="datetime-local"
                    value={editedRequiredBy}
                    onChange={(e) => setEditedRequiredBy(e.target.value)}
                    className="h-10 border-slate-200"
                  />
                  {isRequiredByModified() && (
                    <div className="flex items-start gap-2 p-2.5 bg-amber-50 border border-amber-200 rounded-md">
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <div className="text-xs text-amber-700">
                        <span className="font-medium">Date will be changed</span>
                        <span className="block text-amber-600 mt-0.5">
                          Original: {formatDateTime(originalRequiredBy)}
                        </span>
                        <span className="block text-amber-600 mt-0.5">
                          This change will be logged in the deadline history.
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Message to Requester */}
              <div className="space-y-2">
                <Label htmlFor="approve-message" className="text-sm font-medium text-gray-700">
                  Message to Requester <span className="text-gray-500 font-normal">(Optional)</span>
                </Label>
                <Textarea
                  id="approve-message"
                  placeholder="E.g., Estimated delivery: 1 week"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500">
                  This message will be visible to the requester in the request details.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setApproveDialogOpen(false);
                  setMessage('');
                  setEditedRequiredBy('');
                }}
                disabled={updateStatus.isPending || updateRequiredBy.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleApprove}
                disabled={updateStatus.isPending || updateRequiredBy.isPending}
                className="bg-green-600 hover:bg-green-700"
              >
                {(updateStatus.isPending || updateRequiredBy.isPending) ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Approving...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Confirm Approval
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" />
                Reject Request
              </DialogTitle>
              <DialogDescription>
                Reject request <strong>{request.request_number}</strong> for{' '}
                <strong>{request.client_project_name}</strong>
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <label htmlFor="reject-message" className="text-sm font-medium text-gray-700 mb-2 block">
                Reason for Rejection <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <Textarea
                id="reject-message"
                placeholder="E.g., Out of stock, or please provide more details"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                This message will be visible to the requester in the request details.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setRejectDialogOpen(false);
                  setMessage('');
                }}
                disabled={updateStatus.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={updateStatus.isPending}
                className="bg-red-600 hover:bg-red-700"
              >
                {updateStatus.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Confirm Rejection
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Dialog */}
        <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-indigo-700">
                <UserPlus className="h-5 w-5" />
                Assign to Maker
              </DialogTitle>
              <DialogDescription>
                Assign request <strong>{request.request_number}</strong> to a maker for production.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4 space-y-4">
              {/* Assign to Me - Quick action for coordinator */}
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-indigo-900">Assign to Myself</p>
                    <p className="text-xs text-indigo-600 mt-0.5">Take on this request directly</p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (profile?.id) {
                        setSelectedMaker(profile.id);
                        handleAssign();
                      }
                    }}
                    disabled={assignRequest.isPending || !profile?.id}
                    className="h-9 px-4 bg-indigo-600 hover:bg-indigo-700 shrink-0"
                  >
                    {assignRequest.isPending && selectedMaker === profile?.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Assign to Me'
                    )}
                  </Button>
                </div>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-2 text-slate-500">or select a maker</span>
                </div>
              </div>

              <div>
                <label htmlFor="maker-select" className="text-sm font-medium text-gray-700 mb-2 block">
                  Select Maker
                </label>
                <Select value={selectedMaker} onValueChange={setSelectedMaker}>
                  <SelectTrigger id="maker-select">
                    <SelectValue placeholder="Choose a maker..." />
                  </SelectTrigger>
                  <SelectContent>
                    {makers?.map((maker) => (
                      <SelectItem key={maker.id} value={maker.id}>
                        {maker.full_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-2">
                  The selected person will be notified and can begin production.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setAssignDialogOpen(false);
                  setSelectedMaker('');
                }}
                disabled={assignRequest.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssign}
                disabled={assignRequest.isPending || !selectedMaker}
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                {assignRequest.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  <>
                    <UserPlus className="mr-2 h-4 w-4" />
                    Assign Maker
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receive Confirmation Dialog (for non-self-pickup) */}
        <ReceiveConfirmDialog
          request={request}
          open={receiveDialogOpen}
          onOpenChange={setReceiveDialogOpen}
        />

        {/* Dispatch Dialog */}
        <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-blue-700">
                <Truck className="h-5 w-5" />
                Confirm Dispatch
              </DialogTitle>
              <DialogDescription>
                Mark request <strong>{request.request_number}</strong> for{' '}
                <strong>{request.client_project_name}</strong> as dispatched.
              </DialogDescription>
            </DialogHeader>

            <div className="py-4">
              <label htmlFor="dispatch-notes" className="text-sm font-medium text-gray-700 mb-2 block">
                Dispatch Notes / Tracking Details <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <Textarea
                id="dispatch-notes"
                placeholder="E.g., Sent via BlueDart, Tracking #: BD123456789"
                value={dispatchNotes}
                onChange={(e) => setDispatchNotes(e.target.value)}
                rows={3}
                className="resize-none"
              />
              <p className="text-xs text-gray-500 mt-2">
                Add courier name, tracking number, or any delivery notes. This will be visible to the requester.
              </p>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDispatchDialogOpen(false);
                  setDispatchNotes('');
                }}
                disabled={updateStatus.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDispatch}
                disabled={updateStatus.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {updateStatus.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Truck className="mr-2 h-4 w-4" />
                    Confirm Dispatch
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  // Full mode (original layout - now deprecated, keeping for backward compatibility)
  return (
    <div className="flex flex-col gap-3 mt-4 p-4 border rounded-lg bg-slate-50">
      <h3 className="font-semibold text-slate-900">Coordinator Actions</h3>

      {/* Assign to Maker - ONLY show after approval */}
      {request.status === 'approved' && (
        <div>
          <label className="text-sm font-medium mb-2 block text-slate-700">Assign to Maker</label>
          <Select value={selectedMaker} onValueChange={setSelectedMaker}>
            <SelectTrigger>
              <SelectValue placeholder="Select maker..." />
            </SelectTrigger>
            <SelectContent>
              {makers?.map((maker) => (
                <SelectItem key={maker.id} value={maker.id}>
                  {maker.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedMaker && (
            <Button
              onClick={handleAssign}
              size="sm"
              className="mt-2 bg-indigo-600 hover:bg-indigo-700"
              disabled={assignRequest.isPending}
            >
              {assignRequest.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Assign
            </Button>
          )}
        </div>
      )}

      {/* Status Actions */}
      <div className="flex gap-2 flex-wrap">
        {request.status === 'pending_approval' && (
          <>
            <Button
              onClick={() => setApproveDialogOpen(true)}
              size="sm"
              className="bg-green-600 hover:bg-green-700 gap-2"
            >
              <CheckCircle className="h-4 w-4" />
              Approve Request
            </Button>
            <Button
              onClick={() => setRejectDialogOpen(true)}
              size="sm"
              variant="destructive"
              className="gap-2"
            >
              <XCircle className="h-4 w-4" />
              Reject Request
            </Button>
          </>
        )}

        {/* Coordinator Override: Start Production */}
        {request.status === 'assigned' && (
          <Button
            onClick={() => handleStatusUpdate('in_production')}
            size="sm"
            disabled={updateStatus.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 gap-2"
          >
            {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Start Production
          </Button>
        )}

        {/* Coordinator Override: Mark as Ready */}
        {request.status === 'in_production' && (
          <Button
            onClick={() => handleStatusUpdate('ready')}
            size="sm"
            disabled={updateStatus.isPending}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            {updateStatus.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
            Mark as Ready
          </Button>
        )}

        {/* Hide Dispatch button for Self Pickup */}
        {request.status === 'ready' && !isSelfPickup && (
          <Button
            onClick={handleDispatchClick}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Truck className="h-4 w-4" />
            Mark as Dispatched
          </Button>
        )}

        {/* Mark as Received */}
        {canCoordinatorReceive && (
          <Button
            onClick={handleMarkReceivedClick}
            size="sm"
            disabled={markAsReceived.isPending}
            className="bg-teal-600 hover:bg-teal-700 gap-2"
          >
            {markAsReceived.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
            Mark as Received
          </Button>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-slate-500">
        {request.status === 'pending_approval' && 'Review and approve/reject this request.'}
        {request.status === 'approved' && 'Assign this request to a maker to begin production.'}
        {request.status === 'assigned' && 'Start production on behalf of the maker.'}
        {request.status === 'in_production' && 'Mark as ready on behalf of the maker.'}
        {request.status === 'ready' && isSelfPickup && 'Sample is ready. Mark as received when picked up.'}
        {request.status === 'ready' && !isSelfPickup && 'Sample is ready. Mark as dispatched when sent.'}
        {request.status === 'dispatched' && 'Sample dispatched. Mark as received on delivery.'}
      </p>

      {renderDialogs()}
    </div>
  );
}
