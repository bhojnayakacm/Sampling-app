import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

// ============================================================
// FULL-PAGE SKELETON (replaces global auth spinners)
// ============================================================

export function FullPageSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Skeleton className="h-12 w-12 rounded-full" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  );
}

// ============================================================
// DASHBOARD STAT CARDS SKELETON
// ============================================================

/** 9-card stat grid for Coordinator/Admin dashboards */
export function CoordinatorStatsSkeleton() {
  return (
    <>
      {/* Mobile 3x3 grid */}
      <div className="md:hidden grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-2 text-center">
              <Skeleton className="h-7 w-7 rounded-lg mx-auto mb-1" />
              <Skeleton className="h-5 w-8 mx-auto mb-1" />
              <Skeleton className="h-3 w-12 mx-auto" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Desktop grid */}
      <div className="hidden md:grid grid-cols-5 xl:grid-cols-9 gap-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <Card key={i} className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-3">
              <Skeleton className="h-8 w-8 rounded-lg mb-2" />
              <Skeleton className="h-6 w-10 mb-1" />
              <Skeleton className="h-3 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

/** 8-card stat grid for Admin dashboard */
export function AdminStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Card key={i} className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-3">
            <Skeleton className="h-8 w-8 rounded-lg mb-2" />
            <Skeleton className="h-6 w-10 mb-1" />
            <Skeleton className="h-3 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** 6-card stat grid for Requester dashboard */
export function RequesterStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Card key={i} className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between mb-2">
              <Skeleton className="h-8 w-8 rounded-lg" />
              <Skeleton className="h-3.5 w-3.5 rounded" />
            </div>
            <Skeleton className="h-7 w-10 mb-1" />
            <Skeleton className="h-3.5 w-14" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** 3-card stat row for Maker dashboard */
export function MakerStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-8">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-12 mb-1" />
            <Skeleton className="h-4 w-16" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/** 3-card tab row for Dispatcher dashboard */
export function DispatcherStatsSkeleton() {
  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-xl border-2 border-slate-200 bg-white">
          <div className="p-2.5 sm:p-3 text-center">
            <Skeleton className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg mx-auto mb-1.5 sm:mb-2" />
            <Skeleton className="h-6 w-10 mx-auto mb-1" />
            <Skeleton className="h-2.5 w-16 mx-auto" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// REQUEST LIST SKELETONS
// ============================================================

/** Coordinator/Requester request list loading state */
export function RequestListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <>
      {/* Mobile card stack */}
      <div className="lg:hidden space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Card key={i} className="bg-white border border-slate-200 shadow-sm overflow-hidden border-l-4 border-l-slate-300">
            <CardContent className="p-4">
              {/* Top row: ID + badge */}
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-16 rounded-md" />
              </div>
              {/* Name */}
              <div className="flex items-center gap-2 mb-1">
                <Skeleton className="h-5 w-36" />
                <Skeleton className="h-3 w-20" />
              </div>
              {/* Client line */}
              <div className="mb-3">
                <Skeleton className="h-4 w-44 mb-1.5" />
                <div className="flex items-center justify-between mt-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-14 rounded-md" />
                </div>
              </div>
              {/* Bottom row */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <Skeleton className="h-5 w-20 rounded-md" />
                <Skeleton className="h-11 w-20 rounded-md" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block">
        <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px]">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  {['Sample ID', 'Requester', 'Client / Project', 'Items', 'Priority', 'Status', 'Created', 'Required By', 'SLA', 'Actions'].map((col) => (
                    <th key={col} className="text-left py-3 px-3 text-xs font-semibold text-slate-700 uppercase tracking-wide">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: rows }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-2.5 px-3"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-2.5 px-3">
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="py-2.5 px-3">
                      <Skeleton className="h-4 w-32 mb-1" />
                      <Skeleton className="h-3 w-24" />
                    </td>
                    <td className="py-2.5 px-3 text-center"><Skeleton className="h-4 w-6 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center"><Skeleton className="h-5 w-14 mx-auto rounded-md" /></td>
                    <td className="py-2.5 px-3 text-center"><Skeleton className="h-5 w-18 mx-auto rounded-md" /></td>
                    <td className="py-2.5 px-3 text-center"><Skeleton className="h-4 w-14 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center"><Skeleton className="h-4 w-20 mx-auto" /></td>
                    <td className="py-2.5 px-3 text-center"><Skeleton className="h-5 w-16 mx-auto rounded-md" /></td>
                    <td className="py-2.5 px-3 text-center"><Skeleton className="h-7 w-16 mx-auto rounded-md" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}

// ============================================================
// MAKER JOB CARD SKELETON
// ============================================================

export function MakerJobCardsSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="bg-white border border-slate-200 shadow-sm border-l-4 border-l-slate-300">
          <CardContent className="p-5">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <div>
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-6 w-14 rounded-md" />
            </div>
            {/* Details */}
            <div className="space-y-3 mb-5">
              <div className="bg-slate-50 rounded-lg p-3">
                <Skeleton className="h-3 w-14 mb-1" />
                <Skeleton className="h-4 w-40" />
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <Skeleton className="h-3 w-16 mb-1" />
                <Skeleton className="h-4 w-8" />
              </div>
            </div>
            {/* Button */}
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-3 w-40 mx-auto mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// DISPATCHER CARD SKELETON
// ============================================================

export function DispatcherCardsSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="bg-white border border-slate-200 shadow-sm overflow-hidden">
          <CardContent className="p-0">
            {/* Top row */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-14" />
              </div>
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            {/* Address block */}
            <div className="px-4 pb-3">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <Skeleton className="h-4 w-full mb-1" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            </div>
            {/* Requester row */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-9 w-16 rounded-lg" />
            </div>
            {/* Date row */}
            <div className="px-4 pb-3 flex items-center gap-4">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-3 w-32" />
            </div>
            {/* Action button */}
            <div className="px-4 pb-4">
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================================
// REQUEST DETAIL SKELETON
// ============================================================

export function RequestDetailSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Sticky header skeleton */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-16 rounded-md" />
              <div>
                <Skeleton className="h-5 w-28 mb-1" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-9 w-20 rounded-md" />
              <Skeleton className="h-9 w-20 rounded-md" />
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column (2/3) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Product Items Card */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
                      <Skeleton className="h-10 w-10 rounded-md" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-48" />
                      </div>
                      <Skeleton className="h-4 w-12" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Shipping Card */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar (1/3) */}
          <div className="space-y-6">
            {/* Required By */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>

            {/* Requester Info */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-28" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Client Info */}
            <Card className="bg-white border border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Skeleton className="h-4 w-4 rounded" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// FORM SKELETON (NewRequest loading state)
// ============================================================

export function FormSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-16 rounded-md" />
              <Skeleton className="h-6 w-40" />
            </div>
            <Skeleton className="h-9 w-24 rounded-md" />
          </div>
        </div>
      </div>
      {/* Form sections */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Section 1 */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-36 mb-4" />
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Skeleton className="h-3.5 w-20 mb-2" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
              <div>
                <Skeleton className="h-3.5 w-24 mb-2" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </div>
            <div>
              <Skeleton className="h-3.5 w-16 mb-2" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </CardContent>
        </Card>
        {/* Section 2 */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-40 mb-4" />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="h-3.5 w-24 mb-2" />
                  <Skeleton className="h-12 w-full rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        {/* Product section */}
        <Card className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-5 w-28 mb-4" />
            <div className="border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-12 w-full rounded-md" />
                <Skeleton className="h-12 w-full rounded-md" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================================
// USER MANAGEMENT SKELETON
// ============================================================

export function UserManagementSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Skeleton className="h-9 w-16 rounded-md" />
              <Skeleton className="h-6 w-32" />
            </div>
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </div>
      </div>
      {/* Toolbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-4">
          <Skeleton className="h-10 flex-1 max-w-sm rounded-md" />
          <div className="hidden sm:flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        </div>
        <Skeleton className="h-4 w-24 mb-4" />

        {/* Mobile cards */}
        <div className="sm:hidden space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="bg-white border border-slate-200 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 mb-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1">
                    <Skeleton className="h-4 w-28 mb-1" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-5 w-16 rounded-md" />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 flex-1 rounded-md" />
                  <Skeleton className="h-9 w-9 rounded-md" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Desktop table */}
        <div className="hidden sm:block">
          <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['User', 'Contact', 'Department', 'Current Role', 'Change Role', 'Actions'].map((col) => (
                    <th key={col} className="text-left py-3 px-4 text-xs font-semibold text-slate-700 uppercase">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="h-9 w-9 rounded-full" />
                        <div>
                          <Skeleton className="h-4 w-28 mb-1" />
                          <Skeleton className="h-3 w-36" />
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-24" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-4 w-20" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-5 w-20 rounded-md" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-9 w-28 rounded-md" /></td>
                    <td className="py-3 px-4"><Skeleton className="h-8 w-8 rounded-md" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// REPORT TABLE SKELETON
// ============================================================

export function ReportSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="bg-white border border-slate-200 shadow-sm">
            <CardContent className="p-3">
              <Skeleton className="h-3 w-16 mb-2" />
              <Skeleton className="h-6 w-12" />
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Table */}
      <Card className="bg-white border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['#', 'Requester', 'Dept', 'Total', 'Marble', 'Tile', 'Terrazzo', 'Quartz'].map((col) => (
                <th key={col} className="text-left py-3 px-3 text-xs font-semibold text-slate-700 uppercase">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                <td className="py-3 px-3"><Skeleton className="h-4 w-6" /></td>
                <td className="py-3 px-3"><Skeleton className="h-4 w-28" /></td>
                <td className="py-3 px-3"><Skeleton className="h-4 w-20" /></td>
                <td className="py-3 px-3"><Skeleton className="h-4 w-8" /></td>
                <td className="py-3 px-3"><Skeleton className="h-4 w-8" /></td>
                <td className="py-3 px-3"><Skeleton className="h-4 w-8" /></td>
                <td className="py-3 px-3"><Skeleton className="h-4 w-8" /></td>
                <td className="py-3 px-3"><Skeleton className="h-4 w-8" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

// ============================================================
// TRACKING DIALOG SKELETON
// ============================================================

export function TrackingTimelineSkeleton() {
  return (
    <div className="py-4 space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-start gap-4">
          <div className="flex flex-col items-center">
            <Skeleton className="h-8 w-8 rounded-full" />
            {i < 4 && <Skeleton className="h-12 w-0.5 mt-1" />}
          </div>
          <div className="flex-1 pt-1">
            <Skeleton className="h-4 w-28 mb-1" />
            <Skeleton className="h-3 w-36" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// TEMPLATE DRAWER SKELETON
// ============================================================

export function TemplateDrawerSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="bg-white border border-slate-200 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-start justify-between mb-3">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-6 rounded" />
            </div>
            <div className="flex items-center gap-2 mb-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <Skeleton className="h-3 w-24" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
