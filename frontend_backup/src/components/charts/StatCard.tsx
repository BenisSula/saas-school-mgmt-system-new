import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { fadeIn } from '../../lib/utils/animations';

export interface StatCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    label?: string;
  };
  icon?: ReactNode;
  description?: string;
  trend?: 'up' | 'down' | 'neutral';
}

export function StatCard({ title, value, change, icon, description, trend }: StatCardProps) {
  const trendIcon =
    trend === 'up' ? (
      <TrendingUp className="h-4 w-4 text-emerald-500" />
    ) : trend === 'down' ? (
      <TrendingDown className="h-4 w-4 text-red-500" />
    ) : (
      <Minus className="h-4 w-4 text-[var(--brand-muted)]" />
    );

  return (
    <motion.div
      className="card-hover p-4 sm:p-6"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      whileHover="hover"
      whileTap="tap"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-[var(--brand-muted)]">
            {title}
          </p>
          <p className="mt-2 text-xl font-bold text-[var(--brand-surface-contrast)] sm:text-2xl">
            {value}
          </p>
          {change && (
            <div className="mt-2 flex items-center gap-1">
              {trendIcon}
              <span
                className={`text-xs font-medium ${
                  trend === 'up'
                    ? 'text-emerald-500'
                    : trend === 'down'
                      ? 'text-red-500'
                      : 'text-[var(--brand-muted)]'
                }`}
              >
                {change.value > 0 ? '+' : ''}
                {change.value}% {change.label && `(${change.label})`}
              </span>
            </div>
          )}
          {description && <p className="mt-2 text-xs text-[var(--brand-muted)]">{description}</p>}
        </div>
        {icon && (
          <motion.div
            className="text-[var(--brand-primary)]"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
          >
            {icon}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
