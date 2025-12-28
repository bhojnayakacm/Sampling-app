import { useState } from 'react';
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
import { useMakers } from '@/lib/api/users';
import { useAssignRequest, useUpdateRequestStatus } from '@/lib/api/requests';
import { toast } from 'sonner';
import type { Request } from '@/types';
import { CheckCircle, XCircle, Loader2, Truck } from 'lucide-react';

interface RequestActionsProps {
  request: Request;
  userRole: string;
}

export default function RequestActions({ request, userRole }: RequestActionsProps) {
  const { data: makers } = useMakers();
  const assignRequest = useAssignRequest();
  const updateStatus = useUpdateRequestStatus();

  // Dialog states
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [dispatchNotes, setDispatchNotes] = useState('');

  const handleAssign = async (makerId: string) => {
    try {
      await assignRequest.mutateAsync({ requestId: request.id, makerId });
      toast.success('Request assigned to maker');
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign request');
    }
  };

  const handleApprove = async () => {
    try {
      await updateStatus.mutateAsync({
        requestId: request.id,
        status: 'approved',
        message: message.trim() || undefined,
      });
      toast.success('Request approved successfully!');
      setApproveDialogOpen(false);
      setMessage('');
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

  // Only coordinators can manage requests (not admins)
  if (userRole !== 'coordinator') {
    return null;
  }

  return (
    <div className="flex flex-col gap-3 mt-4 p-4 border rounded-lg bg-orange-50">
      <h3 className="font-semibold">Coordinator Actions</h3>

      {/* Assign to Maker - ONLY show after approval */}
      {request.status === 'approved' && (
        <div>
          <label className="text-sm font-medium mb-2 block">Assign to Maker</label>
          <Select onValueChange={handleAssign} disabled={assignRequest.isPending}>
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

        {request.status === 'ready' && (
          <Button
            onClick={() => setDispatchDialogOpen(true)}
            size="sm"
            className="bg-blue-600 hover:bg-blue-700 gap-2"
          >
            <Truck className="h-4 w-4" />
            Mark as Dispatched
          </Button>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-600">
        {request.status === 'pending_approval' && 'Review and approve/reject this request.'}
        {request.status === 'approved' && 'Assign this request to a maker to begin production.'}
        {request.status === 'assigned' && 'Waiting for maker to start work.'}
        {request.status === 'in_production' && 'Maker is currently working on this request.'}
        {request.status === 'ready' && 'Sample is ready. Mark as dispatched when sent.'}
        {request.status === 'dispatched' && 'This request has been dispatched.'}
      </p>

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

          <div className="py-4">
            <label htmlFor="approve-message" className="text-sm font-medium text-gray-700 mb-2 block">
              Message to Requester <span className="text-gray-500 font-normal">(Optional)</span>
            </label>
            <Textarea
              id="approve-message"
              placeholder="E.g., Estimated delivery: 1 week"
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
                setApproveDialogOpen(false);
                setMessage('');
              }}
              disabled={updateStatus.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              disabled={updateStatus.isPending}
              className="bg-green-600 hover:bg-green-700"
            >
              {updateStatus.isPending ? (
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
    </div>
  );
}
