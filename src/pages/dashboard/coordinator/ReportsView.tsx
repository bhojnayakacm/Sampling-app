import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DateRangeFilter, { DateRange } from '@/components/analytics/DateRangeFilter';
import StatCard from '@/components/analytics/StatCard';
import QualityBarChart from '@/components/analytics/QualityBarChart';
import ProductPieChart from '@/components/analytics/ProductPieChart';
import { Button } from '@/components/ui/button';
import { Package, Clock, FileSpreadsheet, Lock, ChevronRight } from 'lucide-react';

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
  const navigate = useNavigate();
  const [dateRange, setDateRange] = useState<DateRange>('this_month');
  const data = getAnalyticsData(dateRange);

  return (
    <div className="h-[calc(100vh-theme('spacing.16'))] flex flex-col p-4 gap-3">
      {/* ===================================
          HEADER ROW - Compact
          =================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 flex-shrink-0">
        {/* Left: Title */}
        <div>
          <h2 className="text-lg font-bold text-foreground tracking-tight">
            Reports & Analytics
          </h2>
          <p className="text-xs text-muted-foreground">
            Performance metrics and insights
          </p>
        </div>

        {/* Right: Date Range Filter */}
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* ===================================
          SUMMARY CARDS ROW - Reduced gap
          =================================== */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-shrink-0">
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
          CHARTS SECTION - Expanded (takes most space)
          =================================== */}
      <div className="flex flex-col lg:flex-row gap-3 flex-1 min-h-0">
        {/* Left: Quality Bar Chart (65% width) */}
        <div className="flex-[2] min-w-0 min-h-[280px] lg:min-h-0">
          <QualityBarChart dateRange={dateRange} />
        </div>

        {/* Right: Product Pie Chart (35% width) */}
        <div className="flex-[1] min-w-0 min-h-[280px] lg:min-h-0">
          <ProductPieChart dateRange={dateRange} />
        </div>
      </div>

      {/* ===================================
          EXPORT REPORTS - Compact Action Bar
          =================================== */}
      <div className="flex-shrink-0 bg-muted/40 rounded-lg border border-border/50 px-4 py-2.5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          {/* Left: Label */}
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Export Reports:</span>
          </div>

          {/* Right: Buttons */}
          <div className="flex items-center gap-2">
            {/* Requester Report Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/reports/requester')}
              className="h-8 gap-2 bg-white hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Requester Report</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>

            {/* Product Report Button - Disabled */}
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-8 gap-2 opacity-50"
            >
              <Package className="h-3.5 w-3.5" />
              <span>Product Report</span>
              <Lock className="h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
