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
import DateTimePicker from '@/components/ui/date-time-picker';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useUpdateRequiredBy } from '@/lib/api/requests';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { Request, RequestStatus } from '@/types';
import { Calendar, Loader2, AlertCircle } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface EditRequiredByModalProps {
  request: Request;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// Define editable statuses based on pickup method
// Standard (Courier/Field Boy): Edit allowed until dispatched
// Self Pickup: Edit allowed until ready (since client is notified to pick up)
const getEditableStatuses = (isSelfPickup: boolean): RequestStatus[] => {
  if (isSelfPickup) {
    // For self pickup: can edit until ready (locked when ready, received)
    return ['pending_approval', 'approved', 'assigned', 'in_production'];
  }
  // For delivery methods: can edit until dispatched (locked when dispatched, received)
  return ['pending_approval', 'approved', 'assigned', 'in_production', 'ready'];
};

export default function EditRequiredByModal({
  request,
  open,
  onOpenChange,
}: EditRequiredByModalProps) {
  const { profile } = useAuth();
  const updateRequiredBy = useUpdateRequiredBy();

  const [newDate, setNewDate] = useState('');
  const [reason, setReason] = useState('');

  const isSelfPickup = request.pickup_responsibility === 'self_pickup';
  const editableStatuses = getEditableStatuses(isSelfPickup);
  const canEdit = editableStatuses.includes(request.status as RequestStatus);

  // Initialize form when dialog opens (store as ISO string directly)
  useEffect(() => {
    if (open && request.required_by) {
      setNewDate(request.required_by);
      setReason('');
    }
  }, [open, request.required_by]);

  // Check if date was actually changed
  const isDateChanged = () => {
    if (!newDate) return false;
    const newDateISO = new Date(newDate).toISOString();
    return newDateISO !== request.required_by;
  };

  const handleSave = async () => {
    // Validate
    if (!reason.trim()) {
      toast.error('Please provide a reason for the change');
      return;
    }

    if (!isDateChanged()) {
      toast.error('Please select a different date');
      return;
    }

    try {
      const newDateISO = new Date(newDate).toISOString();
      await updateRequiredBy.mutateAsync({
        requestId: request.id,
        newDate: newDateISO,
        reason: reason.trim(),
        changedByName: profile?.full_name || 'Coordinator',
      });
      toast.success('Deadline updated successfully');
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update deadline');
    }
  };

  const handleClose = () => {
    setNewDate('');
    setReason('');
    onOpenChange(false);
  };

  // Get lock reason message
  const getLockReasonMessage = () => {
    if (isSelfPickup) {
      if (request.status === 'ready') {
        return 'Deadline cannot be changed because the sample is ready for self pickup. The client has been notified.';
      }
      if (request.status === 'received') {
        return 'Deadline cannot be changed because the sample has been received.';
      }
    } else {
      if (request.status === 'dispatched') {
        return 'Deadline cannot be changed because the sample has been dispatched.';
      }
      if (request.status === 'received') {
        return 'Deadline cannot be changed because the sample has been received.';
      }
    }
    return 'Deadline cannot be changed at this stage.';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-slate-900">
            <Calendar className="h-5 w-5 text-indigo-600" />
            Edit Required By Date
          </DialogTitle>
          <DialogDescription>
            Change the deadline for request <strong>{request.request_number}</strong>.
            {canEdit && ' A reason is required and will be logged in the history.'}
          </DialogDescription>
        </DialogHeader>

        {!canEdit ? (
          // Locked state
          <div className="py-6">
            <div className="flex items-start gap-3 p-4 bg-slate-100 border border-slate-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-slate-500 mt-0.5 shrink-0" />
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-700">
                  Editing Locked
                </p>
                <p className="text-sm text-slate-600">
                  {getLockReasonMessage()}
                </p>
                <div className="pt-2 border-t border-slate-200 mt-3">
                  <p className="text-xs text-slate-500">
                    Current deadline: <span className="font-medium text-slate-700">{formatDateTime(request.required_by)}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // Editable state
          <div className="py-4 space-y-4">
            {/* Current Date Display */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
                Current Deadline
              </p>
              <p className="text-sm font-medium text-slate-900">
                {formatDateTime(request.required_by)}
              </p>
            </div>

            {/* New Date Picker */}
            <div className="space-y-2">
              <Label htmlFor="new-date" className="text-sm font-medium text-slate-700">
                New Date & Time <span className="text-red-500">*</span>
              </Label>
              <DateTimePicker
                value={newDate}
                onChange={(v) => setNewDate(v)}
              />
            </div>

            {/* Reason (Mandatory) */}
            <div className="space-y-2">
              <Label htmlFor="reason" className="text-sm font-medium text-slate-700">
                Reason for Change <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="reason"
                placeholder="E.g., Client requested extension, Production delay, Material shortage..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="resize-none border-slate-200"
              />
              <p className="text-xs text-slate-500">
                This reason will be recorded in the deadline history for accountability.
              </p>
            </div>

            {/* Change Preview */}
            {isDateChanged() && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="text-xs text-amber-700">
                  <span className="font-medium">Change Preview:</span>
                  <span className="block mt-1">
                    {formatDateTime(request.required_by)} → {formatDateTime(new Date(newDate).toISOString())}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={updateRequiredBy.isPending}
          >
            {canEdit ? 'Cancel' : 'Close'}
          </Button>
          {canEdit && (
            <Button
              onClick={handleSave}
              disabled={updateRequiredBy.isPending || !reason.trim() || !isDateChanged()}
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              {updateRequiredBy.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
