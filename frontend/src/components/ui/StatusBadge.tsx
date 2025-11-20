import { motion } from 'framer-motion';
import { getStatusBadgeClass, formatStatus } from '../../lib/utils/status';
import { fadeIn } from '../../lib/utils/animations';

export interface StatusBadgeProps {
  status: string | null | undefined;
  className?: string;
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const badgeClass = getStatusBadgeClass(status || '');
  const formattedStatus = formatStatus(status);

  return (
    <motion.span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition-colors duration-200 ${badgeClass} ${className}`}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.15 }}
    >
      {formattedStatus}
    </motion.span>
  );
}
