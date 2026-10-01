import { Skeleton } from '@/components/ui/skeleton';

/**
 * First-load placeholder that mirrors the real layout box-for-box, so the
 * page does not jump when data lands. Used ONLY for the first load of a
 * category — a refetch keeps the previous render on screen at reduced
 * opacity instead of flashing back to skeletons.
 */
export default function AnalyticsSkeleton({ showSubCategories }: { showSubCategories: boolean }) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-8 w-20" />
            <Skeleton className="mt-3 h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="mt-2 h-3 w-64" />
          <Skeleton className="mt-6 h-[260px] w-full" />
        </div>
        <ListCardSkeleton rows={6} />
      </div>

      <div className={`grid gap-4 ${showSubCategories ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <ListCardSkeleton rows={8} />
        <ListCardSkeleton rows={4} />
        {showSubCategories && <ListCardSkeleton rows={4} />}
      </div>
    </div>
  );
}

function ListCardSkeleton({ rows }: { rows: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="mt-2 h-3 w-52" />
      <div className="mt-5 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-2.5" style={{ width: `${70 - i * 8}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}
