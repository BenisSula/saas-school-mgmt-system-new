import { ProfileSection } from '../ProfileSection';

export interface AssignedClass {
  id: string;
  name: string;
  subjects?: string[];
  isClassTeacher?: boolean;
  metadata?: Record<string, unknown>;
}

interface AssignedClassesSectionProps {
  classes: AssignedClass[];
  emptyMessage?: string;
  title?: string;
  description?: string;
}

export function AssignedClassesSection({
  classes,
  emptyMessage = 'No classes assigned',
  title,
  description
}: AssignedClassesSectionProps) {
  return (
    <ProfileSection
      title={title}
      description={description}
      isEmpty={classes.length === 0}
      emptyMessage={emptyMessage}
    >
      <div className="space-y-3">
        {classes.map((clazz) => (
          <div
            key={clazz.id}
            className="rounded-lg border border-[var(--brand-border)] bg-slate-950/40 p-4"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
                {clazz.name}
              </p>
              {clazz.isClassTeacher && (
                <span className="rounded-full bg-emerald-500/20 px-2 py-1 text-[11px] font-semibold text-emerald-200">
                  Classroom teacher
                </span>
              )}
            </div>
            {clazz.subjects && clazz.subjects.length > 0 && (
              <>
                <p className="mt-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                  Subjects
                </p>
                <p className="text-sm text-[var(--brand-muted)]">
                  {clazz.subjects.join(', ')}
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

