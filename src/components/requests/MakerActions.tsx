import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateRequestStatus } from '@/lib/api/requests';
import { toast } from 'sonner';
import type { Request } from '@/types';
import { useState } from 'react';

interface MakerActionsProps {
  request: Request;
  userRole: string;
  userId: string;
}

export default function MakerActions({ request, userRole, userId }: MakerActionsProps) {
  const [notes, setNotes] = useState('');
  const updateStatus = useUpdateRequestStatus();

  const handleStatusUpdate = async (newStatus: string) => {
    try {
      await updateStatus.mutateAsync({ requestId: request.id, status: newStatus });
      toast.success(`Status updated to ${newStatus.replace('_', ' ')}`);
      setNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to update status');
    }
  };

  // Only show to makers, and only for their assigned requests
  if (userRole !== 'maker' || request.assigned_to !== userId) {
    return null;
  }

  return (
    <div className="mt-4 p-4 border rounded-lg bg-blue-50">
      <h3 className="font-semibold mb-3">Maker Task Actions</h3>

      {/* Notes input - for future enhancement */}
      <Textarea
        placeholder="Add completion notes (optional)..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        className="mb-3"
        disabled
      />
      <p className="text-xs text-gray-500 mb-3">
        Note: Completion notes feature coming soon
      </p>

      {/* Action buttons based on current status */}
      <div className="flex gap-2 flex-wrap">
        {request.status === 'assigned' && (
          <Button
            onClick={() => handleStatusUpdate('in_production')}
            size="sm"
            disabled={updateStatus.isPending}
          >
            Start Work (In Progress)
          </Button>
        )}

        {request.status === 'in_production' && (
          <Button
            onClick={() => handleStatusUpdate('ready')}
            size="sm"
            disabled={updateStatus.isPending}
          >
            Mark as Ready
          </Button>
        )}

        {request.status === 'ready' && (
          <p className="text-sm text-gray-600 py-2">
            Sample is ready. Waiting for coordinator to dispatch.
          </p>
        )}

        {request.status === 'dispatched' && (
          <p className="text-sm text-gray-600 py-2">
            This sample has been dispatched.
          </p>
        )}
      </div>

      {/* Help text */}
      <p className="text-xs text-gray-600 mt-3">
        {request.status === 'assigned' && 'Click "Start Work" when you begin working on this sample.'}
        {request.status === 'in_production' && 'Click "Mark as Ready" when the sample is complete.'}
      </p>
    </div>
  );
}
