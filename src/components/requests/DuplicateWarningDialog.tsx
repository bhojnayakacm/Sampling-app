import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ExistingRequest } from '@/lib/api/requests';
import { AlertTriangle, User, Calendar, Package, Layers, Ruler, Hash } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';

interface DuplicateWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicateType: 'exact_match' | 'client_match';
  existingRequest: ExistingRequest;
  onCancel: () => void;
  onContinue: () => void;
}

export default function DuplicateWarningDialog({
  open,
  onOpenChange,
  duplicateType,
  existingRequest,
  onCancel,
  onContinue,
}: DuplicateWarningDialogProps) {
  const isExactMatch = duplicateType === 'exact_match';

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending_approval: { label: 'Pending Approval', variant: 'outline' },
      approved: { label: 'Approved', variant: 'secondary' },
      assigned: { label: 'Assigned', variant: 'secondary' },
      in_production: { label: 'In Production', variant: 'default' },
      ready: { label: 'Ready', variant: 'default' },
      dispatched: { label: 'Dispatched', variant: 'default' },
      received: { label: 'Received', variant: 'secondary' },
      rejected: { label: 'Rejected', variant: 'destructive' },
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' };
    return <Badge variant={variant}>{label}</Badge>;
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
              <AlertTriangle className="h-6 w-6 text-yellow-600" />
            </div>
            <div>
              <AlertDialogTitle className="text-xl">
                {isExactMatch ? 'Exact Duplicate Detected' : 'Similar Request Found'}
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm text-gray-500 mt-1">
                {isExactMatch
                  ? 'This exact sample was already requested recently'
                  : 'This client has recently requested samples'}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        {/* Warning Message */}
        <div className={`rounded-lg border p-4 ${isExactMatch ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'}`}>
          <p className={`text-sm font-medium ${isExactMatch ? 'text-red-900' : 'text-yellow-900'}`}>
            {isExactMatch ? (
              <>
                This exact sample (<strong>{existingRequest.quality}</strong> {existingRequest.product_type},{' '}
                <strong>{existingRequest.sample_size}</strong>, <strong>{existingRequest.thickness}</strong>,{' '}
                <strong>{existingRequest.quantity} pcs</strong>) was already requested by{' '}
                <strong>{existingRequest.requester_name}</strong> on{' '}
                <strong>{formatDateTime(existingRequest.created_at)}</strong>.
              </>
            ) : (
              <>
                This client (<strong>{existingRequest.client_contact_name}</strong>) already has a sample request (
                <strong>{existingRequest.request_number}</strong>) created by{' '}
                <strong>{existingRequest.requester_name}</strong> on{' '}
                <strong>{formatDateTime(existingRequest.created_at)}</strong>.
              </>
            )}
          </p>
        </div>

        {/* Existing Request Details */}
        <Card className="border-2">
          <CardContent className="pt-6">
            <h4 className="font-semibold text-sm text-gray-700 mb-3">Existing Request Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2 text-sm">
                <Hash className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Request:</span>
                <span className="font-medium">{existingRequest.request_number}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Created:</span>
                <span className="font-medium">{formatDateTime(existingRequest.created_at)}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Requester:</span>
                <span className="font-medium">{existingRequest.requester_name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-gray-600">Status:</span>
                {getStatusBadge(existingRequest.status)}
              </div>
            </div>

            {/* Sample Specifications */}
            <div className="mt-4 pt-4 border-t">
              <h5 className="font-medium text-sm text-gray-700 mb-2">Sample Specifications</h5>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Product:</span>
                  <span className="font-medium capitalize">{existingRequest.product_type}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Quality:</span>
                  <span className="font-medium capitalize">{existingRequest.quality}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Size:</span>
                  <span className="font-medium">{existingRequest.sample_size}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Ruler className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Thickness:</span>
                  <span className="font-medium">{existingRequest.thickness}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Hash className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Quantity:</span>
                  <span className="font-medium">{existingRequest.quantity} pcs</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            Cancel Submission
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            className={isExactMatch ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
          >
            Continue Anyway
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
