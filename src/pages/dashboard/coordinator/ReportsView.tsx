import { useState } from 'react';
import DateRangeFilter, { DateRange } from '@/components/analytics/DateRangeFilter';
import StatCard from '@/components/analytics/StatCard';
import QualityBarChart from '@/components/analytics/QualityBarChart';
import ProductPieChart from '@/components/analytics/ProductPieChart';
import { Package, Clock } from 'lucide-react';

// ===================================================================
// SMART DUMMY DATA - Reacts to Date Range Filter
// ===================================================================
interface AnalyticsData {
  totalSamples: number;
  avgTurnaround: number; // in days
  trends: {
    totalSamples: { value: number; label: string } | null;
    avgTurnaround: { value: number; label: string } | null;
  };
}

function getAnalyticsData(range: DateRange): AnalyticsData {
  switch (range) {
    case 'today':
      return {
        totalSamples: 3,
        avgTurnaround: 3.8,
        trends: {
          totalSamples: { value: -25, label: 'from yesterday' },
          avgTurnaround: { value: 12, label: 'from yesterday' },
        },
      };

    case 'this_week':
      return {
        totalSamples: 12,
        avgTurnaround: 4.1,
        trends: {
          totalSamples: { value: 15, label: 'from last week' },
          avgTurnaround: { value: -5, label: 'from last week' },
        },
      };

    case 'this_month':
      return {
        totalSamples: 45,
        avgTurnaround: 4.2,
        trends: {
          totalSamples: { value: 22, label: 'from last month' },
          avgTurnaround: { value: -8, label: 'from last month' },
        },
      };

    case 'this_year':
      return {
        totalSamples: 384,
        avgTurnaround: 4.5,
        trends: {
          totalSamples: { value: 18, label: 'from last year' },
          avgTurnaround: { value: -12, label: 'from last year' },
        },
      };

    case 'custom':
      // Custom range: No trend comparison
      return {
        totalSamples: 28,
        avgTurnaround: 3.9,
        trends: {
          totalSamples: null,
          avgTurnaround: null,
        },
      };

    default:
      return {
        totalSamples: 0,
        avgTurnaround: 0,
        trends: {
          totalSamples: null,
          avgTurnaround: null,
        },
      };
  }
}

// ===================================================================
// MAIN COMPONENT
// ===================================================================
export default function ReportsView() {
  const [dateRange, setDateRange] = useState<DateRange>('this_month');
  const data = getAnalyticsData(dateRange);

  return (
    <div className="h-[calc(100vh-theme('spacing.16'))] flex flex-col p-4 gap-4">
      {/* ===================================
          HEADER ROW
          =================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left: Title */}
        <div>
          <h2 className="text-xl font-bold text-foreground tracking-tight">
            Reports & Analytics
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            View detailed insights and performance metrics
          </p>
        </div>

        {/* Right: Date Range Filter */}
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* ===================================
          SUMMARY CARDS ROW
          =================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Samples */}
        <StatCard
          title="Total Samples"
          value={data.totalSamples}
          icon={Package}
          iconColor="text-indigo-600"
          trend={data.trends.totalSamples || undefined}
        />

        {/* Card 2: Avg. Turnaround */}
        <StatCard
          title="Avg. Turnaround"
          value={`${data.avgTurnaround} days`}
          icon={Clock}
          iconColor="text-amber-600"
          trend={data.trends.avgTurnaround || undefined}
        />

        {/* Card 3: Placeholder */}
        <StatCard title="" value="" isPlaceholder />

        {/* Card 4: Placeholder */}
        <StatCard title="" value="" isPlaceholder />
      </div>

      {/* ===================================
          CHARTS SECTION - Full Width Fill Strategy
          =================================== */}
      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
        {/* Left: Quality Bar Chart (65% width) */}
        <div className="flex-[2] min-w-0">
          <QualityBarChart />
        </div>

        {/* Right: Product Pie Chart (35% width) */}
        <div className="flex-[1] min-w-0">
          <ProductPieChart />
        </div>
      </div>

      {/* Debug Info (Optional - Remove in production) */}
      <div className="p-3 bg-muted/30 rounded-xl border border-border/30">
        <p className="text-xs text-muted-foreground font-mono">
          <strong>Debug:</strong> Current Range = <code className="bg-background px-2 py-0.5 rounded">{dateRange}</code>
          {' '} | Total Samples = <code className="bg-background px-2 py-0.5 rounded">{data.totalSamples}</code>
          {' '} | Avg Turnaround = <code className="bg-background px-2 py-0.5 rounded">{data.avgTurnaround} days</code>
        </p>
      </div>
    </div>
  );
}
