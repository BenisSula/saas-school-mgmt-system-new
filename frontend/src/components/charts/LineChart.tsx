import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { fadeIn } from '../../lib/utils/animations';

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

export function LineChart({
  data,
  title,
  height = 200,
  color = 'var(--brand-primary)',
  showDots = true,
  responsive = true,
}: LineChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);
  const minValue = useMemo(() => Math.min(...data.map((d) => d.value), 0), [data]);
  const range = maxValue - minValue || 1;

  const points = useMemo(() => {
    return data.map((point, index) => {
      const x = (index / (data.length - 1 || 1)) * 100;
      const y = 100 - ((point.value - minValue) / range) * 100;
      return { x, y, ...point };
    });
  }, [data, minValue, range]);

  const pathData = useMemo(() => {
    if (points.length === 0) return '';
    const first = points[0];
    let path = `M ${first.x} ${first.y}`;
    for (let i = 1; i < points.length; i++) {
      path += ` L ${points[i].x} ${points[i].y}`;
    }
    return path;
  }, [points]);

  return (
    <motion.div
      className={`w-full ${responsive ? 'overflow-x-auto scrollbar-thin' : ''}`}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-[var(--brand-text-primary)] sm:text-base">
          {title}
        </h3>
      )}
      <div className="relative" style={{ height: `${height}px` }}>
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0"
        >
          {/* Grid lines */}
          {[0, 25, 50, 75, 100].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y}
              x2="100"
              y2={y}
              stroke="var(--brand-border)"
              strokeWidth="0.5"
              opacity="0.3"
            />
          ))}
          {/* Line */}
          <path
            d={pathData}
            fill="none"
            stroke={color}
            strokeWidth="2"
            vectorEffect="non-scaling-stroke"
          />
          {/* Dots */}
          {showDots &&
            points.map((point, index) => (
              <circle
                key={index}
                cx={point.x}
                cy={point.y}
                r="1.5"
                fill={color}
                className="hover:r-2 transition-all"
              />
            ))}
        </svg>
        {/* Labels */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-[var(--brand-muted)]">
          {data.map((point, index) => (
            <span key={index} className="truncate">
              {point.label}
            </span>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
