import React, { type ReactNode } from 'react';
import { Inbox, Users, GraduationCap, Shield } from 'lucide-react';
import { Button } from '../ui/Button';

export interface EmptyStateProps {
  type: 'teachers' | 'students' | 'hods' | 'generic';
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode;
}

const typeConfig = {
  teachers: {
    icon: <Users className="h-12 w-12" />,
    defaultTitle: 'No teachers yet',
    defaultDescription: 'Get started by creating your first teacher account. Teachers can manage classes, mark attendance, and enter grades.',
    defaultActionLabel: 'Create Teacher'
  },
  students: {
    icon: <GraduationCap className="h-12 w-12" />,
    defaultTitle: 'No students yet',
    defaultDescription: 'Start managing your student roster by adding your first student. You can import multiple students at once using CSV.',
    defaultActionLabel: 'Create Student'
  },
  hods: {
    icon: <Shield className="h-12 w-12" />,
    defaultTitle: 'No Heads of Department yet',
    defaultDescription: 'Create HOD accounts to oversee departments and manage teachers. HODs can view department analytics and reports.',
    defaultActionLabel: 'Create HOD'
  },
  generic: {
    icon: <Inbox className="h-12 w-12" />,
    defaultTitle: 'No data found',
    defaultDescription: 'There are no items to display. Use filters to refine your search or create new items.',
    defaultActionLabel: 'Create New'
  }
};

export function EmptyState({
  type,
  title,
  description,
  actionLabel,
  onAction,
  icon
}: EmptyStateProps) {
  const config = typeConfig[type];
  const displayIcon = icon || config.icon;
  const displayTitle = title || config.defaultTitle;
  const displayDescription = description || config.defaultDescription;
  const displayActionLabel = actionLabel || config.defaultActionLabel;

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-12 text-center">
      <div className="mb-4 text-[var(--brand-muted)]">
        {displayIcon}
      </div>
      <h3 className="mb-2 text-xl font-semibold text-[var(--brand-surface-contrast)]">
        {displayTitle}
      </h3>
      <p className="mb-6 max-w-md text-sm text-[var(--brand-muted)]">
        {displayDescription}
      </p>
      {onAction && (
        <Button onClick={onAction} className="gap-2">
          {displayActionLabel}
        </Button>
      )}
    </div>
  );
}

export default EmptyState;

