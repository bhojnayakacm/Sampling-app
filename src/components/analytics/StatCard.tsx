import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Minus, LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon;
  iconColor?: string;
  trend?: {
    value: number; // Percentage change (e.g., 15 for +15%, -8 for -8%)
    label: string; // e.g., "from last month"
  };
  isPlaceholder?: boolean;
}

export default function StatCard({
  title,
  value,
  icon: Icon,
  iconColor = 'text-primary',
  trend,
  isPlaceholder = false,
}: StatCardProps) {
  if (isPlaceholder) {
    return (
      <Card className="border-dashed border-2 border-border/30 bg-muted/20 hover:shadow-none">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground">
            Coming Soon
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <p className="text-xl font-bold text-muted-foreground/40">--</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            More metrics
          </p>
        </CardContent>
      </Card>
    );
  }

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) return <TrendingUp className="h-3.5 w-3.5" />;
    if (trend.value < 0) return <TrendingDown className="h-3.5 w-3.5" />;
    return <Minus className="h-3.5 w-3.5" />;
  };

  const getTrendColor = () => {
    if (!trend) return '';
    if (trend.value > 0) return 'text-emerald-600 bg-emerald-50';
    if (trend.value < 0) return 'text-red-600 bg-red-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getTrendSign = () => {
    if (!trend) return '';
    if (trend.value > 0) return '+';
    if (trend.value < 0) return '';
    return '';
  };

  return (
    <Card className="border-border/50 hover:border-primary/20 transition-all duration-200">
      <CardHeader className="pb-2 px-4 pt-4">
        <CardTitle className="text-xs font-medium text-muted-foreground flex items-center justify-between">
          <span>{title}</span>
          {Icon && <Icon className={cn('h-4 w-4', iconColor)} />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 px-4 pb-4 pt-0">
        {/* Main Value - Compact */}
        <div>
          <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
        </div>

        {/* Trend Indicator - Compact */}
        {trend && (
          <div
            className={cn(
              'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold',
              getTrendColor()
            )}
          >
            {getTrendIcon()}
            <span>
              {getTrendSign()}
              {Math.abs(trend.value)}%
            </span>
            <span className="font-normal opacity-80 text-[10px]">{trend.label}</span>
          </div>
        )}

        {/* No Trend State - Compact */}
        {!trend && (
          <div className="h-5 flex items-center">
            <p className="text-[10px] text-muted-foreground">No comparison data</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
