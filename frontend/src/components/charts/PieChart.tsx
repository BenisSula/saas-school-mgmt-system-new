import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { fadeIn } from '../../lib/utils/animations';

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

export function PieChart({
  data,
  title,
  size = 200,
  showLegend = true,
  responsive = true,
}: PieChartProps) {
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const segments = useMemo(() => {
    let currentAngle = -90; // Start at top
    return data.map((item) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + angle;
      currentAngle = endAngle;

      const startAngleRad = (startAngle * Math.PI) / 180;
      const endAngleRad = (endAngle * Math.PI) / 180;
      const radius = size / 2 - 10;
      const centerX = size / 2;
      const centerY = size / 2;

      const x1 = centerX + radius * Math.cos(startAngleRad);
      const y1 = centerY + radius * Math.sin(startAngleRad);
      const x2 = centerX + radius * Math.cos(endAngleRad);
      const y2 = centerY + radius * Math.sin(endAngleRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${centerX} ${centerY}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');

      return {
        ...item,
        pathData,
        percentage,
        color: item.color || `hsl(${(data.indexOf(item) * 360) / data.length}, 70%, 50%)`,
      };
    });
  }, [data, total, size]);

  return (
    <motion.div
      className={`flex flex-col items-center gap-4 ${responsive ? 'w-full' : ''}`}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      {title && (
        <h3 className="text-sm font-semibold text-[var(--brand-text-primary)] sm:text-base">
          {title}
        </h3>
      )}
      <div className="flex flex-col items-center gap-4 sm:flex-row">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {segments.map((segment, index) => (
            <path
              key={index}
              d={segment.pathData}
              fill={segment.color}
              stroke="var(--brand-surface)"
              strokeWidth="2"
              className="transition-opacity hover:opacity-80"
            />
          ))}
        </svg>
        {showLegend && (
          <div className="space-y-2">
            {segments.map((segment, index) => (
              <div key={index} className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                <span className="text-xs text-[var(--brand-surface-contrast)]">
                  {segment.label}: {segment.value} ({segment.percentage.toFixed(1)}%)
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
