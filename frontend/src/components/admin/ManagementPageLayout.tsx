import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button } from '../ui/Button';
import { StatusBanner } from '../ui/StatusBanner';
import { ExportButtons } from './ExportButtons';
import { RouteMeta } from '../layout/RouteMeta';
import { slideIn } from '../../lib/utils/animations';

interface ManagementPageLayoutProps {
  title: string;
  description: string;
  error: string | null;
  loading: boolean;
  onRefresh?: () => void;
  onExportCSV: () => void;
  onExportPDF?: () => void;
  onExportExcel?: () => void;
  bulkActionButton?: ReactNode;
  children: ReactNode;
}

export function ManagementPageLayout({
  title,
  description,
  error,
  loading,
  onRefresh,
  onExportCSV,
  onExportPDF,
  onExportExcel,
  bulkActionButton,
  children,
}: ManagementPageLayoutProps) {
  return (
    <RouteMeta title={title}>
      <div className="space-y-4 sm:space-y-6">
        <motion.header
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
          variants={slideIn.fromTop}
          initial="hidden"
          animate="visible"
        >
          <div>
            <h1 className="text-xl font-semibold text-[var(--brand-text-primary)] sm:text-2xl">
              {title}
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">{description}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons
              onExportCSV={onExportCSV}
              onExportPDF={onExportPDF}
              onExportExcel={onExportExcel}
              disabled={loading}
            />
            {bulkActionButton}
            {onRefresh && (
              <Button variant="outline" onClick={onRefresh} disabled={loading}>
                Refresh
              </Button>
            )}
          </div>
        </motion.header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        {children}
      </div>
    </RouteMeta>
  );
}
