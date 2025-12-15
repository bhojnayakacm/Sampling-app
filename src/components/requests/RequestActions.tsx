import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useMakers } from '@/lib/api/users';
import { useAssignRequest, useUpdateRequestStatus } from '@/lib/api/requests';
import { toast } from 'sonner';
import type { Request } from '@/types';

interface RequestActionsProps {
  request: Request;
  userRole: string;
}

export default function RequestActions({ request, userRole }: RequestActionsProps) {
  const { data: makers } = useMakers();
  const assignRequest = useAssignRequest();
  const updateStatus = useUpdateRequestStatus();

  const handleAssign = async (makerId: string) => {
    try {
      await assignRequest.mutateAsync({ requestId: request.id, makerId });
      toast.success('Request assigned to maker');
    } catch (error: any) {
      toast.error(error.message || 'Failed to assign request');
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ requestId: request.id, status: newStatus });
      toast.success('Status updated successfully');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
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
          <Button
            onClick={() => handleStatusChange('approved')}
            size="sm"
            disabled={updateStatus.isPending}
          >
            Approve Request
          </Button>
        )}

        {request.status === 'ready' && (
          <Button
            onClick={() => handleStatusChange('dispatched')}
            size="sm"
            disabled={updateStatus.isPending}
          >
            Mark as Dispatched
          </Button>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-600">
        {request.status === 'pending_approval' && 'Review and approve this request to proceed.'}
        {request.status === 'approved' && 'Assign this request to a maker to begin production.'}
        {request.status === 'assigned' && 'Waiting for maker to start work.'}
        {request.status === 'in_production' && 'Maker is currently working on this request.'}
        {request.status === 'ready' && 'Sample is ready. Mark as dispatched when sent.'}
        {request.status === 'dispatched' && 'This request has been dispatched.'}
      </p>
    </div>
  );
}
