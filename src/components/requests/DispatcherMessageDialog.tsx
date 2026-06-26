import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useSetDispatcherMessage } from '@/lib/api/requests';
import { toast } from 'sonner';
import { MessageSquarePlus, Loader2, Send, Users } from 'lucide-react';
import type { Request } from '@/types';

const MAX_LEN = 500;

interface DispatcherMessageDialogProps {
  request:      Request;
  open:         boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional callback after a successful send (for dashboards to refetch). */
  onSent?: () => void;
}

/**
 * Lets a dispatcher leave a pre-dispatch note on a ready field_boy
 * request. Submitting writes requests.dispatcher_message, which fires
 * the migration-1019 trigger that pushes the note to BOTH the requester
 * and the responsible coordinators.
 *
 * Prefills with any existing message so the dispatcher can edit/resend
 * rather than only append.
 */
export default function DispatcherMessageDialog({
  request,
  open,
  onOpenChange,
  onSent,
}: DispatcherMessageDialogProps) {
  const setMessage = useSetDispatcherMessage();
  const [text, setText] = useState('');

  const existing = request.dispatcher_message ?? '';
  const isEdit = !!existing.trim();

  // Seed the textarea with the current message each time the dialog opens.
  useEffect(() => {
    if (open) setText(existing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const trimmed = text.trim();
  const unchanged = trimmed === existing.trim();
  const disabled = setMessage.isPending || !trimmed || unchanged;

  const handleSubmit = async () => {
    if (!trimmed) {
      toast.error('Type a message before sending.');
      return;
    }
    try {
      await setMessage.mutateAsync({ requestId: request.id, message: trimmed });
      toast.success(
        <div>
          <p className="font-bold">Message sent</p>
          <p className="text-sm">The requester and coordinator have been notified.</p>
        </div>
      );
      onOpenChange(false);
      onSent?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send message');
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!setMessage.isPending) onOpenChange(o); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md sm:w-full sm:max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-teal-700">
            <MessageSquarePlus className="h-5 w-5" />
            {isEdit ? 'Edit Message' : 'Send a Message'}
          </DialogTitle>
          <DialogDescription>
            Leave a note about <strong>{request.request_number}</strong> before dispatching it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          <Label htmlFor="dispatcher-message" className="text-sm font-medium text-slate-700">
            Message
          </Label>
          <Textarea
            id="dispatcher-message"
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
            placeholder="E.g., Picking this up tomorrow morning. Please confirm the gate code."
            className="text-sm min-h-[96px] border-slate-200 resize-none"
            rows={4}
            autoFocus
          />
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <Users className="h-3.5 w-3.5" />
              Sent to the requester &amp; coordinator
            </p>
            <span className="text-[11px] text-slate-400">{text.length}/{MAX_LEN}</span>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={setMessage.isPending}
            className="min-h-[44px] py-2 px-4 text-sm font-semibold flex-1 sm:flex-initial"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disabled}
            className="min-h-[44px] py-2 px-4 text-sm font-semibold flex-1 sm:flex-initial bg-teal-600 hover:bg-teal-700"
          >
            {setMessage.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="mr-1.5 h-4 w-4" />
                {isEdit ? 'Update' : 'Send'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
