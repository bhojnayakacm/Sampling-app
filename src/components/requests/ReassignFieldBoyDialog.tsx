import { useEffect, useState } from 'react';
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
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useReassignFieldBoy } from '@/lib/api/requests';
import { FIELD_BOYS } from '@/lib/dispatch';
import { toast } from 'sonner';
import { UserCog, Loader2, Check } from 'lucide-react';
import type { Request } from '@/types';

interface ReassignFieldBoyDialogProps {
  request:      Request;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback after a successful reassignment. */
  onReassigned?: () => void;
}

/**
 * Lets a dispatcher hand an in-flight (dispatched) field_boy delivery
 * to a different field boy, any time before it is marked received.
 * Writes requests.dispatch_metadata.field_boy via useReassignFieldBoy;
 * RLS (migration 1021) confines this to dispatched + field_boy rows.
 */
export default function ReassignFieldBoyDialog({
  request,
  open,
  onOpenChange,
  onReassigned,
}: ReassignFieldBoyDialogProps) {
  const reassign = useReassignFieldBoy();
  const current = request.dispatch_metadata?.field_boy ?? '';
  const [fieldBoy, setFieldBoy] = useState<string>(current);

  // Reset the selection to the current assignee whenever the dialog opens.
  useEffect(() => {
    if (open) setFieldBoy(current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const unchanged = fieldBoy === current;
  const disabled = reassign.isPending || !fieldBoy || unchanged;

  const handleSubmit = async () => {
    if (!fieldBoy || unchanged) return;
    try {
      await reassign.mutateAsync({ requestId: request.id, fieldBoy });
      toast.success(
        <div>
          <p className="font-bold">Field boy reassigned</p>
          <p className="text-sm">{request.request_number} is now with {fieldBoy.split(' - ')[0]}.</p>
        </div>
      );
      onOpenChange(false);
      onReassigned?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to reassign');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!reassign.isPending) onOpenChange(o); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full sm:max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-indigo-700">
            <UserCog className="h-5 w-5" />
            Reassign Field Boy
          </DialogTitle>
          <DialogDescription>
            Hand <strong>{request.request_number}</strong> to a different field boy.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5 py-1">
          <Label className="text-sm font-medium text-slate-700">
            Field Boy <span className="text-red-500">*</span>
          </Label>
          <Select value={fieldBoy} onValueChange={setFieldBoy}>
            <SelectTrigger className="h-10 border-slate-200">
              <SelectValue placeholder="Choose the field boy" />
            </SelectTrigger>
            <SelectContent>
              {FIELD_BOYS.map((fb) => (
                <SelectItem key={fb} value={fb}>{fb}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {current && (
            <p className="text-[11px] text-slate-500">
              Currently assigned to <span className="font-medium text-slate-600">{current}</span>.
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={reassign.isPending}
            className="min-h-[44px] py-2 px-4 text-sm font-semibold flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disabled}
            className="min-h-[44px] py-2 px-4 text-sm font-semibold flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700"
          >
            {reassign.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              <>
                <Check className="mr-1.5 h-4 w-4" />
                Reassign
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
