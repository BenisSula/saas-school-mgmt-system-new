/**
 * Unified Pie Chart Component
 * Uses Recharts internally but maintains backward-compatible API
 * Consolidates custom SVG and Recharts implementations
 */
import { useMemo } from 'react';
import { PieChart as RechartsPieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useBrand } from '../ui/BrandProvider';
import { Card } from '../ui/Card';

export interface PieChartData {
  label: string;
  value: number;
  color?: string;
}

export interface PieChartProps {
  data: PieChartData[];
  title?: string;
  size?: number;
  showLegend?: boolean;
  responsive?: boolean;
}

const getAccessibleColors = (tokens: ReturnType<typeof useBrand>['tokens'], index: number): string => {
  const colors = [
    tokens.primary,
    tokens.accent,
    '#3b82f6', // info blue
    '#10b981', // success green
    '#f59e0b', // warning amber
    '#ef4444', // error red
    '#8b5cf6', // purple
    '#ec4899'  // pink
  ];
  return colors[index % colors.length];
};

/**
 * Unified Pie Chart - uses Recharts for better accessibility and features
 * Maintains backward compatibility with existing API
 */
export function PieChart({
  data,
  title,
  size = 200,
  showLegend = true,
  responsive = true
}: PieChartProps) {
  const { tokens } = useBrand();

  // Transform data to Recharts format
  const rechartsData = useMemo(() => {
    return data.map((item) => ({
      name: item.label,
      value: item.value
    }));
  }, [data]);

  // Get colors - use provided colors or generate accessible ones
  const colors = useMemo(() => {
    return data.map((item, index) => 
      item.color || getAccessibleColors(tokens, index)
    );
  }, [data, tokens]);

  if (!data || data.length === 0) {
    return (
      <Card padding="lg">
        {title && (
          <h3 className="text-sm font-semibold text-[var(--brand-text-primary)] sm:text-base">
            {title}
          </h3>
        )}
        <p className="text-sm text-[var(--brand-muted)] text-center py-8">
          No data available
        </p>
      </Card>
    );
  }

  const outerRadius = size / 2 - 10;

  return (
    <div className={`flex flex-col items-center gap-4 ${responsive ? 'w-full' : ''}`}>
      {title && (
        <h3 className="text-sm font-semibold text-[var(--brand-text-primary)] sm:text-base">
          {title}
        </h3>
      )}
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <ResponsiveContainer width={size} height={size}>
          <RechartsPieChart role="img" aria-label={title || 'Pie chart'}>
            <Pie
              data={rechartsData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${percent ? (percent * 100).toFixed(0) : 0}%`}
              outerRadius={outerRadius}
              fill="#8884d8"
              dataKey="value"
            >
              {rechartsData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={colors[index]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--brand-surface)',
                border: '1px solid var(--brand-border)',
                borderRadius: '8px',
                color: 'var(--brand-surface-contrast)'
              }}
            />
            {showLegend && (
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
            )}
          </RechartsPieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
