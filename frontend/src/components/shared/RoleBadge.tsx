import { motion } from 'framer-motion';
import { fadeIn } from '../../lib/utils/animations';
import type { Role } from '../../lib/api';

export interface RoleBadgeProps {
  role: Role;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const roleColors: Record<Role, string> = {
  superadmin: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  admin: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  hod: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300',
  teacher: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  student: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
};

const roleLabels: Record<Role, string> = {
  superadmin: 'Super Admin',
  admin: 'Admin',
  hod: 'HOD',
  teacher: 'Teacher',
  student: 'Student'
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-xs',
  lg: 'px-3 py-1.5 text-sm'
};

/**
 * Reusable role badge component
 * Displays user role with consistent styling
 */
export function RoleBadge({ role, className = '', size = 'md' }: RoleBadgeProps) {
  const badgeClass = roleColors[role] || roleColors.student;
  const label = roleLabels[role] || role;

  return (
    <motion.span
      className={`inline-flex items-center rounded-full font-semibold transition-colors duration-200 ${badgeClass} ${sizeClasses[size]} ${className}`}
      variants={fadeIn}
      initial="hidden"
      animate="visible"
      whileHover={{ scale: 1.05 }}
      transition={{ duration: 0.15 }}
      title={`Role: ${label}`}
    >
      {label}
    </motion.span>
  );
}

export default RoleBadge;

