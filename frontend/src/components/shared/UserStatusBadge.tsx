import { motion } from 'framer-motion';
import { fadeIn } from '../../lib/utils/animations';

export type UserStatus = 'pending' | 'active' | 'suspended' | 'rejected';

export interface UserStatusBadgeProps {
  status: UserStatus | string | null | undefined;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const statusColors: Record<UserStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  suspended: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  rejected: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
};

const statusLabels: Record<UserStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  suspended: 'Suspended',
  rejected: 'Rejected'
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm'
};

/**
 * Reusable user status badge component
 * Displays user status with consistent styling
 */
export function UserStatusBadge({
  status,
  className = '',
  size = 'md'
}: UserStatusBadgeProps) {
  const normalizedStatus = (status || 'pending') as UserStatus;
  const badgeClass = statusColors[normalizedStatus] || statusColors.pending;
  const label = statusLabels[normalizedStatus] || normalizedStatus;

  return (
    <motion.span
      className={`inline-flex items-center rounded-full font-semibold transition-colors duration-200 ${badgeClass} ${sizeClasses[size]} ${className}`}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.15 }}
      title={`Status: ${label}`}
    >
      {label}
    </motion.span>
  );
}

export default UserStatusBadge;

