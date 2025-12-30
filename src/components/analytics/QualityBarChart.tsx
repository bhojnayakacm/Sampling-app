import { useState, useMemo } from 'react';
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
import { Package } from 'lucide-react';
import { PRODUCT_TYPES, PRODUCT_QUALITIES, POPULAR_QUALITIES, type ProductType, type ProductTypeKey } from '@/lib/productData';

interface QualityData {
  name: string;
  count: number;
  color: string;
}

// Color palette for bars
const CHART_COLORS = [
  '#4F46E5', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#EF4444', // red
  '#84CC16', // lime
];

// ===================================================================
// SMART DUMMY DATA - Generates sample data for any quality
// In production, this would come from actual database queries
// ===================================================================
function generateDummyData(productType: ProductType, selectedQuality: string): QualityData[] {
  const qualities = PRODUCT_QUALITIES[productType];

  if (selectedQuality) {
    // If a specific quality is selected, show just that one
    const randomCount = Math.floor(Math.random() * 50) + 10;
    return [{
      name: selectedQuality.length > 15 ? selectedQuality.substring(0, 15) + '...' : selectedQuality,
      count: randomCount,
      color: CHART_COLORS[0],
    }];
  }

  // Show top 6 qualities with dummy data
  const topQualities = qualities.slice(0, 6);
  return topQualities.map((quality, index) => ({
    name: quality.length > 12 ? quality.substring(0, 12) + '...' : quality,
    count: Math.floor(Math.random() * 45) + 10,
    color: CHART_COLORS[index % CHART_COLORS.length],
  }));
}

// Custom Tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white px-3 py-2 rounded-lg shadow-lg border border-slate-200">
        <p className="text-sm font-semibold text-slate-900">{payload[0].payload.name}</p>
        <p className="text-base font-bold text-primary">
          {payload[0].value} <span className="text-xs text-slate-500">samples</span>
        </p>
      </div>
    );
  }
  return null;
};

export default function QualityBarChart() {
  const [selectedProduct, setSelectedProduct] = useState<ProductType>('Marble');
  const [selectedQuality, setSelectedQuality] = useState<string>('');

  // Map capitalized product type to lowercase key for popular qualities
  const productKeyMap: Record<ProductType, ProductTypeKey> = {
    'Marble': 'marble',
    'Tile': 'tile',
    'Magro Stone': 'magro_stone',
    'Quartz': 'quartz',
    'Terrazzo': 'terrazzo',
  };

  // Get qualities for selected product
  const qualityOptions = useMemo(() => {
    return PRODUCT_QUALITIES[selectedProduct] || [];
  }, [selectedProduct]);

  // Get popular qualities for the selected product
  const popularOptions = useMemo(() => {
    const key = productKeyMap[selectedProduct];
    return key ? POPULAR_QUALITIES[key] || [] : [];
  }, [selectedProduct]);

  // Generate chart data
  const data = useMemo(() => {
    return generateDummyData(selectedProduct, selectedQuality);
  }, [selectedProduct, selectedQuality]);

  // Reset quality when product changes
  const handleProductChange = (value: string) => {
    setSelectedProduct(value as ProductType);
    setSelectedQuality(''); // Reset quality filter
  };

  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 h-full w-full flex flex-col">
      {/* Header */}
      <CardHeader className="py-2.5 px-3 bg-gradient-to-br from-slate-50/80 to-transparent border-b border-slate-100">
        <div className="flex flex-col gap-2">
          {/* Title Row */}
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Quality Breakdown
            </CardTitle>
            <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {qualityOptions.length} qualities
            </span>
          </div>

          {/* Filters Row */}
          <div className="flex items-center gap-2">
            {/* Product Type Filter */}
            <Select value={selectedProduct} onValueChange={handleProductChange}>
              <SelectTrigger className="w-[110px] h-7 rounded-md border border-slate-200 text-xs bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                {PRODUCT_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-sm">
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Quality Filter - Searchable Combobox */}
            <Combobox
              options={qualityOptions}
              popularOptions={popularOptions}
              value={selectedQuality}
              onChange={setSelectedQuality}
              placeholder="All Qualities"
              searchPlaceholder="Type to search..."
              emptyMessage="No matching quality"
              className="flex-1 min-w-[140px]"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-2 flex-1 flex flex-col">
        {/* Bar Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 15, right: 5, left: 0, bottom: 15 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: '#64748B', fontSize: 10 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: '#64748B', fontSize: 11 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
                width={30}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
              <Bar
                dataKey="count"
                radius={[5, 5, 0, 0]}
                maxBarSize={45}
                animationDuration={600}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 pt-2 border-t border-slate-100">
          {data.slice(0, 4).map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[10px] font-medium text-slate-600">
                {item.name}: <span className="text-slate-800">{item.count}</span>
              </span>
            </div>
          ))}
          {data.length > 4 && (
            <span className="text-[10px] text-slate-400">+{data.length - 4} more</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
