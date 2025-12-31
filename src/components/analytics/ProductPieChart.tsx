import { useMemo, useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { PieChart as PieChartIcon } from 'lucide-react';
import type { DateRange } from '@/components/analytics/DateRangeFilter';

interface ProductPieChartProps {
  dateRange?: DateRange;
}

interface ProductData {
  name: string;
  value: number;
  color: string;
  percentage: number;
  [key: string]: string | number;
}

// Color palette matching the bar chart
const CHART_COLORS = {
  Marble: '#4F46E5',      // indigo
  Tile: '#10B981',        // emerald
  'Magro Stone': '#8B5CF6', // violet
  Terrazzo: '#F59E0B',    // amber
  Quartz: '#EC4899',      // pink
};

// Base data - will be modified by dateRange
const BASE_DATA = [
  { name: 'Marble', baseValue: 120 },
  { name: 'Tile', baseValue: 95 },
  { name: 'Magro Stone', baseValue: 68 },
  { name: 'Terrazzo', baseValue: 65 },
  { name: 'Quartz', baseValue: 52 },
];

// Map date range to a multiplier for data variation
function dateRangeToMultiplier(range: DateRange): number {
  const multipliers: Record<DateRange, number> = {
    today: 0.08,
    this_week: 0.25,
    this_month: 1,
    this_year: 8.5,
    custom: 0.6,
  };
  return multipliers[range] || 1;
}

// Generate data based on date range
function generateData(range: DateRange, seed: number): ProductData[] {
  const multiplier = dateRangeToMultiplier(range);

  // Add some variation using the seed
  const data = BASE_DATA.map((item, index) => {
    const variation = Math.sin(index * seed + 1) * 0.2 + 1; // 0.8 to 1.2 variation
    const value = Math.round(item.baseValue * multiplier * variation);
    return {
      name: item.name,
      value,
      color: CHART_COLORS[item.name as keyof typeof CHART_COLORS],
      percentage: 0, // Will be calculated below
    };
  });

  // Calculate percentages
  const total = data.reduce((sum, item) => sum + item.value, 0);
  data.forEach(item => {
    item.percentage = Math.round((item.value / total) * 100);
  });

  // Ensure percentages sum to 100 (adjust largest if needed)
  const percentageSum = data.reduce((sum, item) => sum + item.percentage, 0);
  if (percentageSum !== 100) {
    const largest = data.reduce((max, item) => item.value > max.value ? item : max, data[0]);
    largest.percentage += (100 - percentageSum);
  }

  return data;
}

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-semibold text-slate-900">{data.name}</p>
        <p className="text-base font-bold text-primary">
          {data.value} <span className="text-xs text-slate-500">requests</span>
        </p>
        <p className="text-xs text-slate-500">{data.percentage}% of total</p>
      </div>
    );
  }
  return null;
};

// Label renderer
const renderLabel = (entry: any) => `${entry.percentage}%`;

export default function ProductPieChart({ dateRange = 'this_month' }: ProductPieChartProps) {
  const [animationKey, setAnimationKey] = useState(0);

  // Trigger animation when dateRange changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [dateRange]);

  // Generate data based on date range
  const productData = useMemo(() => {
    const seed = animationKey + 1;
    return generateData(dateRange, seed);
  }, [dateRange, animationKey]);

  // Calculate total
  const total = useMemo(() => {
    return productData.reduce((sum, item) => sum + item.value, 0);
  }, [productData]);

  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 h-full w-full flex flex-col">
      {/* Header - Consistent with QualityBarChart */}
      <CardHeader className="py-3 px-4 bg-gradient-to-br from-slate-50/80 to-transparent border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <PieChartIcon className="h-4 w-4 text-primary" />
            Product Distribution
          </CardTitle>
          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {total} total
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1 flex flex-col min-h-0">
        {/* Donut Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart key={animationKey} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
              <Pie
                data={productData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderLabel}
                outerRadius="80%"
                innerRadius="55%"
                fill="#8884d8"
                dataKey="value"
                animationDuration={500}
              >
                {productData.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.color}
                    stroke="#fff"
                    strokeWidth={2}
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Legend - Standardized (matching QualityBarChart) */}
        <div className="flex flex-wrap justify-center gap-4 pt-3 mt-2 border-t border-slate-100">
          {productData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-xs text-muted-foreground">
                {item.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
