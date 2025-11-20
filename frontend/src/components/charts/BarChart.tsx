import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { fadeIn } from '../../lib/utils/animations';

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

export function BarChart({
  data,
  title,
  height = 200,
  showValues = true,
  responsive = true
}: BarChartProps) {
  const maxValue = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

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
        <div className="flex h-full items-end justify-between gap-1 sm:gap-2">
          {data.map((item, index) => {
            const percentage = (item.value / maxValue) * 100;
            const barColor = item.color || 'var(--brand-primary)';

            return (
              <motion.div
                key={index}
                className="flex flex-1 flex-col items-center gap-1"
                style={{ height: '100%' }}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.3 }}
              >
                {showValues && (
                  <span className="text-xs font-medium text-[var(--brand-text-primary)]">
                    {item.value}
                  </span>
                )}
                <motion.div
                  className="w-full rounded-t transition-all duration-300 hover:opacity-80"
                  style={{
                    height: `${percentage}%`,
                    backgroundColor: barColor,
                    minHeight: item.value > 0 ? '4px' : '0'
                  }}
                  role="img"
                  aria-label={`${item.label}: ${item.value}`}
                  whileHover={{ scale: 1.05 }}
                />
                <span className="mt-1 text-[10px] text-[var(--brand-muted)] text-center leading-tight">
                  {item.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
