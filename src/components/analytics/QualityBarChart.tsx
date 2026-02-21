import { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Combobox } from '@/components/ui/combobox';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { PRODUCT_TYPES, PRODUCT_QUALITIES, POPULAR_QUALITIES, type ProductType, type ProductTypeKey } from '@/lib/productData';
import type { DateRange } from '@/components/analytics/DateRangeFilter';

interface QualityBarChartProps {
  dateRange?: DateRange;
}

interface QualityData {
  name: string;
  fullName: string;
  count: number;
  color: string;
}

// Color palette for Top 4 bars
const CHART_COLORS = [
  '#4F46E5', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
];

// "Others" bar color - neutral gray
const OTHERS_COLOR = '#94A3B8';

// ===================================================================
// SMART DUMMY DATA - Top 4 + Others Logic
// ===================================================================
function generateDummyData(
  productType: ProductType,
  selectedQuality: string,
  seed: number = 1
): QualityData[] {
  const qualities = PRODUCT_QUALITIES[productType];

  // If a specific quality is selected, show just that one
  if (selectedQuality) {
    const randomCount = Math.floor((Math.random() * seed * 50) % 80) + 15;
    return [{
      name: selectedQuality.length > 12 ? selectedQuality.substring(0, 12) + '…' : selectedQuality,
      fullName: selectedQuality,
      count: randomCount,
      color: CHART_COLORS[0],
    }];
  }

  // Generate random counts for all qualities (seeded by dateRange)
  const qualityCounts = qualities.map((quality, index) => ({
    name: quality,
    fullName: quality,
    count: Math.floor(((Math.sin(index * seed) + 1) * 30) + Math.random() * 20 + 5),
  }));

  // Sort by count descending
  qualityCounts.sort((a, b) => b.count - a.count);

  // Take top 4
  const top4 = qualityCounts.slice(0, 4).map((item, index) => ({
    name: item.name.length > 10 ? item.name.substring(0, 10) + '…' : item.name,
    fullName: item.fullName,
    count: item.count,
    color: CHART_COLORS[index],
  }));

  // Sum the rest as "Others"
  const othersCount = qualityCounts.slice(4).reduce((sum, item) => sum + item.count, 0);

  if (othersCount > 0) {
    top4.push({
      name: 'Others',
      fullName: `${qualityCounts.length - 4} other qualities`,
      count: othersCount,
      color: OTHERS_COLOR,
    });
  }

  return top4;
}

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-semibold text-slate-900">{data.fullName}</p>
        <p className="text-base font-bold text-primary">
          {payload[0].value} <span className="text-xs text-slate-500">samples</span>
        </p>
      </div>
    );
  }
  return null;
};

// Map date range to a seed for pseudo-random but consistent data
function dateRangeToSeed(range: DateRange): number {
  const seeds: Record<DateRange, number> = {
    today: 1.2,
    this_week: 2.5,
    this_month: 3.8,
    this_year: 5.1,
    custom: 4.2,
  };
  return seeds[range] || 1;
}

export default function QualityBarChart({ dateRange = 'this_month' }: QualityBarChartProps) {
  const [selectedProduct, setSelectedProduct] = useState<ProductType>('Marble');
  const [selectedQuality, setSelectedQuality] = useState<string>('');
  const [animationKey, setAnimationKey] = useState(0);

  // Map capitalized product type to lowercase key for popular qualities
  const productKeyMap: Record<ProductType, ProductTypeKey> = {
    'Marble': 'marble',
    'Tile': 'tile',
    'Stone': 'stone',
    'Quartz': 'quartz',
    'Terrazzo': 'terrazzo',
  };

  // Trigger animation when dateRange changes
  useEffect(() => {
    setAnimationKey(prev => prev + 1);
  }, [dateRange]);

  // Get qualities for selected product
  const qualityOptions = useMemo(() => {
    return PRODUCT_QUALITIES[selectedProduct] || [];
  }, [selectedProduct]);

  // Get popular qualities for the selected product
  const popularOptions = useMemo(() => {
    const key = productKeyMap[selectedProduct];
    return key ? POPULAR_QUALITIES[key] || [] : [];
  }, [selectedProduct]);

  // Generate chart data with dateRange seed
  const data = useMemo(() => {
    const seed = dateRangeToSeed(dateRange);
    return generateDummyData(selectedProduct, selectedQuality, seed);
  }, [selectedProduct, selectedQuality, dateRange]);

  // Reset quality when product changes
  const handleProductChange = (value: string) => {
    setSelectedProduct(value as ProductType);
    setSelectedQuality('');
  };

  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 h-full w-full flex flex-col">
      {/* Header */}
      <CardHeader className="py-3 px-4 bg-gradient-to-br from-slate-50/80 to-transparent border-b border-slate-100">
        <div className="flex flex-col gap-3">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              Quality Breakdown
            </CardTitle>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              Top 4 + Others
            </span>
          </div>

          {/* Filters Row - Fixed widths, proper gap */}
          <div className="flex items-center gap-3">
            {/* Product Type Filter - Fixed width */}
            <Select value={selectedProduct} onValueChange={handleProductChange}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_TYPES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quality Filter - Fixed width */}
            <Combobox
              options={qualityOptions}
              popularOptions={popularOptions}
              value={selectedQuality}
              onChange={setSelectedQuality}
              placeholder="All Qualities"
              searchPlaceholder="Type to search..."
              emptyMessage="No matching quality"
              className="w-[200px]"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-3 flex-1 flex flex-col">
        {/* Bar Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              key={animationKey}
              data={data}
              margin={{ top: 10, right: 10, left: -10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748B', fontSize: 11 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
                interval={0}
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 11 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
                width={35}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
              <Bar
                dataKey="count"
                radius={[4, 4, 0, 0]}
                maxBarSize={50}
                animationDuration={500}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend - Standardized */}
        <div className="flex flex-wrap justify-center gap-4 pt-3 mt-2 border-t border-slate-100">
          {data.map((item) => (
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
