/**
 * Unified Bar Chart Component
 * Uses Recharts internally but maintains backward-compatible API
 * Consolidates custom SVG and Recharts implementations
 */
import { useMemo } from 'react';
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useBrand } from '../ui/BrandProvider';
import { Card } from '../ui/Card';

export interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarChartData[];
  title?: string;
  height?: number;
  showValues?: boolean;
  responsive?: boolean;
}

/**
 * Unified Bar Chart - uses Recharts for better accessibility and features
 * Maintains backward compatibility with existing API
 */
export function BarChart({
  data,
  title,
  height = 200,
  responsive = true
}: BarChartProps) {
  const { tokens } = useBrand();

  // Transform data to Recharts format
  const rechartsData = useMemo(() => {
    return data.map((item) => ({
      name: item.label,
      value: item.value
    }));
  }, [data]);

  // Get colors from data or use brand colors
  const barColor = useMemo(() => {
    return data[0]?.color || tokens.primary;
  }, [data, tokens]);

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
        <RechartsBarChart
          data={rechartsData}
          margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
          role="img"
          aria-label={title || 'Bar chart'}
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
            cursor={{ fill: 'var(--brand-border)', opacity: 0.2 }}
          />
          <Bar
            dataKey="value"
            fill={barColor}
            radius={[4, 4, 0, 0]}
          />
        </RechartsBarChart>
      </ResponsiveContainer>
    </div>
  );
}
