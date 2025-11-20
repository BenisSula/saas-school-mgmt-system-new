/**
 * Unified Line Chart Component
 * Uses Recharts internally but maintains backward-compatible API
 * Consolidates custom SVG and Recharts implementations
 */
import { useMemo } from 'react';
import { LineChart as RechartsLineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBrand } from '../ui/BrandProvider';
import { Card } from '../ui/Card';

export interface LineChartDataPoint {
  label: string;
  value: number;
}

export interface LineChartProps {
  data: LineChartDataPoint[];
  title?: string;
  height?: number;
  color?: string;
  showDots?: boolean;
  responsive?: boolean;
}

/**
 * Unified Line Chart - uses Recharts for better accessibility and features
 * Maintains backward compatibility with existing API
 */
export function LineChart({
  data,
  title,
  height = 200,
  color,
  showDots = true,
  responsive = true
}: LineChartProps) {
  const { tokens } = useBrand();
  const lineColor = color || tokens.primary;

  // Transform data to Recharts format
  const rechartsData = useMemo(() => {
    return data.map((point) => ({
      name: point.label,
      value: point.value
    }));
  }, [data]);

  if (!data || data.length === 0) {
    return (
      <Card padding="lg">
        {title && (
          <h3 className="mb-4 text-sm font-semibold text-[var(--brand-text-primary)] sm:text-base">
            {title}
          </h3>
        )}
        <p className="text-sm text-[var(--brand-muted)] text-center py-8">
          No data available
        </p>
      </Card>
    );
  }

  return (
    <div className={`w-full ${responsive ? 'overflow-x-auto scrollbar-thin' : ''}`}>
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-[var(--brand-text-primary)] sm:text-base">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <RechartsLineChart
          data={rechartsData}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          role="img"
          aria-label={title || 'Line chart'}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--brand-border)"
            opacity={0.3}
          />
          <XAxis
            dataKey="name"
            angle={-45}
            textAnchor="end"
            height={80}
            tick={{ fill: 'var(--brand-surface-contrast)', fontSize: 12 }}
          />
          <YAxis
            tick={{ fill: 'var(--brand-surface-contrast)', fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: 'var(--brand-surface)',
              border: '1px solid var(--brand-border)',
              borderRadius: '8px',
              color: 'var(--brand-surface-contrast)'
            }}
            cursor={{ stroke: 'var(--brand-border)', strokeWidth: 1, strokeDasharray: '5 5' }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={2}
            dot={showDots ? { r: 4, fill: lineColor } : false}
            activeDot={{ r: 6 }}
          />
        </RechartsLineChart>
      </ResponsiveContainer>
    </div>
  );
}
