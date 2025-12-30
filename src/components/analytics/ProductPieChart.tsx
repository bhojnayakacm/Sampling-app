import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { Layers } from 'lucide-react';

interface ProductData {
  name: string;
  value: number;
  color: string;
  percentage: number;
  [key: string]: string | number;
}

// ===================================================================
// SMART DUMMY DATA - Product Distribution
// ===================================================================
const productData: ProductData[] = [
  { name: 'Marble', value: 120, color: '#4F46E5', percentage: 30 },
  { name: 'Tile', value: 95, color: '#10B981', percentage: 24 },
  { name: 'Magro Stone', value: 68, color: '#8B5CF6', percentage: 17 },
  { name: 'Terrazzo', value: 65, color: '#F59E0B', percentage: 16 },
  { name: 'Quartz', value: 52, color: '#EC4899', percentage: 13 },
];

// Calculate total
const TOTAL = productData.reduce((sum, item) => sum + item.value, 0);

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

export default function ProductPieChart() {
  return (
    <Card className="border-slate-200 shadow-sm hover:shadow-md transition-shadow duration-200 h-full w-full flex flex-col">
      {/* Header - Consistent with QualityBarChart */}
      <CardHeader className="py-2.5 px-3 bg-gradient-to-br from-slate-50/80 to-transparent border-b border-slate-100">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold text-slate-800 flex items-center gap-2">
            <Layers className="h-4 w-4 text-primary" />
            Product Distribution
          </CardTitle>
          <span className="text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
            {TOTAL} total
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-2 flex-1 flex flex-col min-h-0">
        {/* Donut Chart */}
        <div className="flex-1 min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
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
                animationDuration={600}
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

        {/* Legend - Single Horizontal Line (Consistent with QualityBarChart) */}
        <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 pt-2 border-t border-slate-100">
          {productData.map((item) => (
            <div key={item.name} className="flex items-center gap-1.5">
              <div
                className="w-2.5 h-2.5 rounded-sm"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-[11px] font-medium text-slate-600">
                {item.name}: <span className="text-slate-800">{item.percentage}%</span>
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
