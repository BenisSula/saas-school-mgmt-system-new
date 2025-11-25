import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { fadeIn } from '../../lib/utils/animations';
import { Card } from '../ui/Card';

interface ProfileSectionProps {
  title?: string;
  description?: string;
  children: ReactNode;
  emptyMessage?: string;
  isEmpty?: boolean;
}

export function ProfileSection({
  title,
  description,
  children,
  emptyMessage = 'No data available',
  isEmpty = false
}: ProfileSectionProps) {
  return (
    <motion.div variants={fadeIn} initial="hidden" animate="visible">
      <Card padding="md" className="w-full">
        {title && (
          <h3 className="mb-2 text-base font-semibold text-[var(--brand-text-primary)] sm:text-lg">
            {title}
          </h3>
        )}
        {description && <p className="mb-4 text-sm text-[var(--brand-muted)]">{description}</p>}
        {isEmpty ? <p className="text-sm text-[var(--brand-muted)]">{emptyMessage}</p> : children}
      </Card>
    </motion.div>
  );
}
