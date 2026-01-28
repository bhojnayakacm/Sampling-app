import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useMarkAsReceived } from '@/lib/api/requests';
import { toast } from 'sonner';
import { PackageCheck, User, Users, Loader2 } from 'lucide-react';
import type { Request } from '@/types';

interface ReceiveConfirmDialogProps {
  request: Request;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export default function ReceiveConfirmDialog({
  request,
  open,
  onOpenChange,
  onSuccess,
}: ReceiveConfirmDialogProps) {
  const markAsReceived = useMarkAsReceived();
  const [receivedByOption, setReceivedByOption] = useState<'requester' | 'other'>('requester');
  const [customReceiverName, setCustomReceiverName] = useState('');

  const requesterName = request.creator?.full_name || 'Requester';

  const handleConfirm = async () => {
    const receivedBy =
      receivedByOption === 'requester' ? requesterName : customReceiverName.trim();

    if (receivedByOption === 'other' && !receivedBy) {
      toast.error('Please enter the receiver name');
      return;
    }

    try {
      await markAsReceived.mutateAsync({ requestId: request.id, receivedBy });
      toast.success('Sample marked as received!');
      onOpenChange(false);
      setReceivedByOption('requester');
      setCustomReceiverName('');
      onSuccess?.();
    } catch (error: any) {
      toast.error(error.message || 'Failed to mark as received');
    }
  };

  const handleClose = (newOpen: boolean) => {
    if (!newOpen) {
      setReceivedByOption('requester');
      setCustomReceiverName('');
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-700">
            <PackageCheck className="h-5 w-5" />
            Confirm Receipt
          </DialogTitle>
          <DialogDescription>
            Who received the sample for <strong>{request.request_number}</strong>?
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-3">
          {/* Option A: Received by Requester */}
          <button
            type="button"
            onClick={() => setReceivedByOption('requester')}
            className={`w-full p-3.5 rounded-lg border-2 text-left transition-all ${
              receivedByOption === 'requester'
                ? 'border-teal-500 bg-teal-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${
                  receivedByOption === 'requester' ? 'bg-teal-100' : 'bg-slate-100'
                }`}
              >
                <User
                  className={`h-4 w-4 ${
                    receivedByOption === 'requester' ? 'text-teal-600' : 'text-slate-400'
                  }`}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Received by Requester</p>
                <p className="text-xs text-slate-500">{requesterName}</p>
              </div>
            </div>
          </button>

          {/* Option B: Received by Someone Else */}
          <button
            type="button"
            onClick={() => setReceivedByOption('other')}
            className={`w-full p-3.5 rounded-lg border-2 text-left transition-all ${
              receivedByOption === 'other'
                ? 'border-teal-500 bg-teal-50 shadow-sm'
                : 'border-slate-200 hover:border-slate-300'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center ${
                  receivedByOption === 'other' ? 'bg-teal-100' : 'bg-slate-100'
                }`}
              >
                <Users
                  className={`h-4 w-4 ${
                    receivedByOption === 'other' ? 'text-teal-600' : 'text-slate-400'
                  }`}
                />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-900">Received by Someone Else</p>
                <p className="text-xs text-slate-500">Specify who received the sample</p>
              </div>
            </div>
          </button>

          {/* Custom Name Input (shown when "Someone Else" is selected) */}
          {receivedByOption === 'other' && (
            <div className="pl-1">
              <Input
                value={customReceiverName}
                onChange={(e) => setCustomReceiverName(e.target.value)}
                placeholder="Enter receiver name / details..."
                className="h-11 border-slate-200"
                autoFocus
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            disabled={markAsReceived.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={
              markAsReceived.isPending ||
              (receivedByOption === 'other' && !customReceiverName.trim())
            }
            className="bg-teal-600 hover:bg-teal-700"
          >
            {markAsReceived.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <PackageCheck className="mr-2 h-4 w-4" />
                Confirm Receipt
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
