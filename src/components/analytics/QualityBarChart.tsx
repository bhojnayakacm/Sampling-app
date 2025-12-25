import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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

type ProductType = 'marble' | 'tile' | 'terrazzo' | 'quartz';

interface QualityData {
  name: string;
  count: number;
  color: string;
}

// ===================================================================
// SMART DUMMY DATA - Different qualities for each product type
// ===================================================================
const qualityDataByProduct: Record<ProductType, QualityData[]> = {
  marble: [
    { name: 'Premium', count: 45, color: '#4F46E5' },
    { name: 'Standard', count: 32, color: '#10B981' },
    { name: 'Commercial', count: 28, color: '#F59E0B' },
    { name: 'Rustic', count: 15, color: '#EC4899' },
  ],
  tile: [
    { name: 'Grade A', count: 38, color: '#4F46E5' },
    { name: 'Grade B', count: 25, color: '#10B981' },
    { name: 'Seconds', count: 12, color: '#F59E0B' },
  ],
  terrazzo: [
    { name: 'Premium', count: 22, color: '#4F46E5' },
    { name: 'Standard', count: 18, color: '#10B981' },
    { name: 'Economy', count: 10, color: '#F59E0B' },
  ],
  quartz: [
    { name: 'Premium Plus', count: 30, color: '#4F46E5' },
    { name: 'Premium', count: 24, color: '#10B981' },
    { name: 'Standard', count: 16, color: '#F59E0B' },
    { name: 'Builder Grade', count: 8, color: '#EC4899' },
  ],
};

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
  const [selectedProduct, setSelectedProduct] = useState<ProductType>('marble');
  const data = qualityDataByProduct[selectedProduct];

  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 h-full w-full flex flex-col">
      {/* Header - Consistent with ProductPieChart */}
      <CardHeader className="py-2.5 px-3 bg-gradient-to-br from-slate-50/80 to-transparent border-b border-slate-100">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Package className="h-4 w-4 text-primary" />
            Quality Breakdown
          </CardTitle>

          {/* Product Type Filter */}
          <Select
            value={selectedProduct}
            onValueChange={(val) => setSelectedProduct(val as ProductType)}
          >
            <SelectTrigger className="w-[110px] h-7 rounded-md border border-slate-200 text-xs bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-lg">
              <SelectItem value="marble" className="text-sm">Marble</SelectItem>
              <SelectItem value="tile" className="text-sm">Tile</SelectItem>
              <SelectItem value="terrazzo" className="text-sm">Terrazzo</SelectItem>
              <SelectItem value="quartz" className="text-sm">Quartz</SelectItem>
            </SelectContent>
          </Select>
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
                tick={{ fill: '#64748B', fontSize: 11 }}
                axisLine={{ stroke: '#E2E8F0' }}
                tickLine={false}
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

        {/* Legend - Single Horizontal Line (Consistent with ProductPieChart) */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] font-medium text-slate-600">
                {item.name}: <span className="text-slate-800">{item.count}</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
