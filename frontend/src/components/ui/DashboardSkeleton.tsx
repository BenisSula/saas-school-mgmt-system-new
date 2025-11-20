import { motion } from 'framer-motion';
import { fadeIn } from '../../lib/utils/animations';

export function DashboardSkeleton() {
  return (
    <motion.div
      className="space-y-5 rounded-2xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/60 p-4 sm:p-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      <div className="h-6 w-48 animate-pulse rounded bg-[var(--brand-surface-secondary)]" />
      <div className="space-y-3">
        <div className="h-4 w-full animate-pulse rounded bg-[var(--brand-surface-secondary)]" />
        <div className="h-4 w-4/5 animate-pulse rounded bg-[var(--brand-surface-secondary)]" />
        <div className="h-4 w-2/3 animate-pulse rounded bg-[var(--brand-surface-secondary)]" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="h-24 animate-pulse rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)]" />
        <div className="h-24 animate-pulse rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)]" />
        <div className="h-24 animate-pulse rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface-secondary)] hidden lg:block" />
      </div>
    </motion.div>
  );
}

export default DashboardSkeleton;
