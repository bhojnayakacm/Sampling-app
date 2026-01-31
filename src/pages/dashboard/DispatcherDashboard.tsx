import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import {
  useDispatcherStats,
  useFieldBoyReadyRequests,
  useUpdateRequestStatus,
} from '@/lib/api/requests';
import { toast } from 'sonner';
import {
  Package,
  Truck,
  CheckCircle,
  MapPin,
  Phone,
  User,
  Loader2,
  LogOut,
  Calendar,
} from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import type { Request } from '@/types';

export default function DispatcherDashboard() {
  const { profile, signOut } = useAuth();

  const { data: stats, isLoading: statsLoading } = useDispatcherStats(profile?.id);
  const { data: readyRequests, isLoading: requestsLoading } = useFieldBoyReadyRequests();
  const updateStatus = useUpdateRequestStatus();

  // Dispatch confirmation dialog
  const [dispatchTarget, setDispatchTarget] = useState<Request | null>(null);
  const [dispatchNotes, setDispatchNotes] = useState('');

  const handleDispatchClick = (request: Request) => {
    setDispatchTarget(request);
    setDispatchNotes('');
  };

  const handleConfirmDispatch = async () => {
    if (!dispatchTarget) return;

    try {
      await updateStatus.mutateAsync({
        requestId: dispatchTarget.id,
        status: 'dispatched',
        dispatchNotes: dispatchNotes.trim() || undefined,
      });
      toast.success(
        <div>
          <p className="font-bold">Dispatched!</p>
          <p className="text-sm">{dispatchTarget.request_number} marked as dispatched.</p>
        </div>
      );
      setDispatchTarget(null);
      setDispatchNotes('');
    } catch (error: any) {
      toast.error(error.message || 'Failed to dispatch');
    }
  };

  // Stat cards config
  const statCards = [
    {
      key: 'ready',
      label: 'Ready for Pickup',
      icon: Package,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      value: stats?.readyForPickup || 0,
      accent: 'border-teal-200',
    },
    {
      key: 'today',
      label: 'Dispatched Today',
      icon: Truck,
      iconBg: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      value: stats?.dispatchedToday || 0,
      accent: 'border-emerald-200',
    },
    {
      key: 'total',
      label: 'Total Dispatched',
      icon: CheckCircle,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      value: stats?.totalDispatched || 0,
      accent: 'border-green-200',
    },
  ];

  // Deadline helper
  const getDeadlineInfo = (requiredBy: string | null) => {
    if (!requiredBy) return null;
    const now = new Date();
    const deadline = new Date(requiredBy);
    const hoursLeft = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursLeft < 0) return { label: 'Overdue', className: 'text-red-600 bg-red-50 border-red-200' };
    if (hoursLeft <= 24) return { label: 'Due Soon', className: 'text-amber-600 bg-amber-50 border-amber-200' };
    return null;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ============================================ */}
      {/* HEADER */}
      {/* ============================================ */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center">
                <Truck className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-base font-bold text-slate-900">Dispatch</h1>
                <p className="text-xs text-slate-500">{profile?.full_name}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={signOut}
              className="h-9 px-3 text-xs text-slate-500 hover:bg-slate-100"
            >
              <LogOut className="h-4 w-4 sm:mr-1.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-8">
        {/* ============================================ */}
        {/* STATS CARDS */}
        {/* ============================================ */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.key} className={`bg-white border ${card.accent} shadow-sm`}>
                <CardContent className="p-3 text-center">
                  <div className={`h-8 w-8 rounded-lg ${card.iconBg} flex items-center justify-center mx-auto mb-2`}>
                    <Icon className={`h-4 w-4 ${card.iconColor}`} />
                  </div>
                  <p className="text-2xl font-bold text-slate-900">
                    {statsLoading ? '–' : card.value}
                  </p>
                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mt-0.5">
                    {card.label}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* ============================================ */}
        {/* SECTION HEADER */}
        {/* ============================================ */}
        <div className="flex items-center gap-2 mb-3">
          <Package className="h-4 w-4 text-teal-600" />
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
            Ready for Pickup
          </h2>
          {!requestsLoading && readyRequests && (
            <span className="text-xs font-medium text-slate-500">
              ({readyRequests.length})
            </span>
          )}
        </div>

        {/* ============================================ */}
        {/* LOADING STATE */}
        {/* ============================================ */}
        {requestsLoading && (
          <div className="py-16 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-slate-400" />
            <p className="text-sm text-slate-500 mt-3">Loading pickups...</p>
          </div>
        )}

        {/* ============================================ */}
        {/* EMPTY STATE */}
        {/* ============================================ */}
        {!requestsLoading && (!readyRequests || readyRequests.length === 0) && (
          <div className="py-16 text-center">
            <div className="h-16 w-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-slate-400" />
            </div>
            <p className="text-lg font-medium text-slate-700">All caught up!</p>
            <p className="text-sm text-slate-500 mt-1">No samples waiting for pickup right now.</p>
          </div>
        )}

        {/* ============================================ */}
        {/* WORK LIST — PICKUP CARDS */}
        {/* ============================================ */}
        {!requestsLoading && readyRequests && readyRequests.length > 0 && (
          <div className="space-y-3">
            {readyRequests.map((request) => {
              const deadlineInfo = getDeadlineInfo(request.required_by);
              const itemCount = request.items?.length || 1;
              const displayAddress = request.delivery_address || 'No address provided';

              return (
                <Card
                  key={request.id}
                  className="bg-white border border-slate-200 shadow-sm overflow-hidden"
                >
                  <CardContent className="p-0">
                    {/* Top: Request Number + Deadline */}
                    <div className="flex items-center justify-between px-4 pt-3 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {request.request_number}
                        </span>
                        <span className="text-xs text-slate-400">
                          · {itemCount} item{itemCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      {deadlineInfo && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${deadlineInfo.className}`}>
                          {deadlineInfo.label}
                        </span>
                      )}
                    </div>

                    {/* Address — PRIMARY (most prominent element) */}
                    <div className="px-4 pb-3">
                      <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-100">
                        <MapPin className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                        <p className="text-sm font-medium text-slate-800 leading-relaxed">
                          {displayAddress}
                        </p>
                      </div>
                    </div>

                    {/* Requester info + Contact */}
                    <div className="px-4 pb-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-600 truncate">
                          {request.creator?.full_name || 'Unknown'}
                        </span>
                        {request.creator?.department && (
                          <span className="text-xs text-slate-400 capitalize hidden sm:inline">
                            · {request.creator.department}
                          </span>
                        )}
                      </div>
                      {request.mobile_no && (
                        <a
                          href={`tel:${request.mobile_no}`}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors shrink-0"
                        >
                          <Phone className="h-3 w-3" />
                          Call
                        </a>
                      )}
                    </div>

                    {/* Deadline row */}
                    {request.required_by && (
                      <div className="px-4 pb-3">
                        <div className="flex items-center gap-1.5 text-xs text-slate-500">
                          <Calendar className="h-3 w-3" />
                          <span>Due: {formatDateTime(request.required_by)}</span>
                        </div>
                      </div>
                    )}

                    {/* Action — Large tap target */}
                    <div className="px-4 pb-4">
                      <Button
                        onClick={() => handleDispatchClick(request)}
                        disabled={updateStatus.isPending}
                        className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold gap-2 rounded-lg"
                      >
                        <Truck className="h-4 w-4" />
                        Mark as Dispatched
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* ============================================ */}
      {/* DISPATCH CONFIRMATION DIALOG */}
      {/* ============================================ */}
      <Dialog open={!!dispatchTarget} onOpenChange={(open) => { if (!open) setDispatchTarget(null); }}>
        <DialogContent className="sm:max-w-[420px] mx-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-teal-700">
              <Truck className="h-5 w-5" />
              Confirm Dispatch
            </DialogTitle>
            <DialogDescription>
              Mark <strong>{dispatchTarget?.request_number}</strong> as dispatched?
            </DialogDescription>
          </DialogHeader>

          {/* Destination summary */}
          {dispatchTarget && (
            <div className="py-2">
              <div className="flex items-start gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <MapPin className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800">
                    {dispatchTarget.delivery_address || 'No address'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {dispatchTarget.creator?.full_name} · {dispatchTarget.client_project_name}
                  </p>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-xs font-medium text-slate-600 block mb-1.5">
                  Dispatch Notes (optional)
                </label>
                <Textarea
                  value={dispatchNotes}
                  onChange={(e) => setDispatchNotes(e.target.value)}
                  placeholder="e.g., Handed to reception, Tracking ID..."
                  rows={2}
                  className="text-sm border-slate-200 resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDispatchTarget(null)}
              disabled={updateStatus.isPending}
              className="flex-1 sm:flex-initial"
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDispatch}
              disabled={updateStatus.isPending}
              className="flex-1 sm:flex-initial bg-teal-600 hover:bg-teal-700"
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
