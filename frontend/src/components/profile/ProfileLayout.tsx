import type { ReactNode } from 'react';
import { RouteMeta } from '../layout/RouteMeta';
import { StatusBanner } from '../ui/StatusBanner';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { Button } from '../ui/Button';

export interface ProfileSection {
  id: string;
  title: string;
  description?: string;
  content: ReactNode;
  collapsible?: boolean;
}

export interface ProfileLayoutProps {
  title: string;
  subtitle?: string;
  loading?: boolean;
  error?: string | null;
  avatar?: ReactNode;
  headerActions?: ReactNode;
  sections: ProfileSection[];
  onEdit?: () => void;
  showEditButton?: boolean;
}

export function ProfileLayout({
  title,
  subtitle,
  loading = false,
  error = null,
  avatar,
  headerActions,
  sections,
  onEdit,
  showEditButton = false,
}: ProfileLayoutProps) {
  if (loading) {
    return (
      <RouteMeta title={title}>
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title={title}>
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title={title}>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-4">
            {avatar && <div className="flex-shrink-0">{avatar}</div>}
            <div>
              <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                {title}
              </h1>
              {subtitle && <p className="mt-1 text-sm text-[var(--brand-muted)]">{subtitle}</p>}
            </div>
          </div>
          <div className="flex gap-2">
            {headerActions}
            {showEditButton && onEdit && (
              <Button variant="outline" onClick={onEdit}>
                Edit Profile
              </Button>
            )}
          </div>
        </header>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.id}
              className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm"
              aria-labelledby={`section-${section.id}`}
            >
              <header className="mb-4">
                <h2
                  id={`section-${section.id}`}
                  className="text-lg font-semibold text-[var(--brand-surface-contrast)]"
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="mt-1 text-sm text-[var(--brand-muted)]">{section.description}</p>
                )}
              </header>
              <div>{section.content}</div>
            </section>
          ))}
        </div>
      </div>
    </RouteMeta>
  );
}
