import { ProfileSection } from '../ProfileSection';

export interface SubjectItem {
  id: string;
  name: string;
  code?: string | null;
  status?: string;
  metadata?: Record<string, unknown>;
}

interface AssignedSubjectsSectionProps {
  subjects: SubjectItem[];
  emptyMessage?: string;
  title?: string;
  description?: string;
  renderSubject?: (subject: SubjectItem) => React.ReactNode;
}

export function AssignedSubjectsSection({
  subjects,
  emptyMessage = 'No subjects assigned',
  title,
  description,
  renderSubject
}: AssignedSubjectsSectionProps) {
  const defaultRenderSubject = (subject: SubjectItem) => (
    <div className="rounded-lg border border-[var(--brand-border)] bg-slate-950/40 p-4">
      <p className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
        {subject.name}
        {subject.code && (
          <span className="text-xs text-[var(--brand-muted)]"> ({subject.code})</span>
        )}
      </p>
      {subject.status && (
        <p className="mt-2 text-xs uppercase tracking-wide text-[var(--brand-muted)]">
          {subject.status}
        </p>
      )}
    </div>
  );

  return (
    <ProfileSection
      title={title}
      description={description}
      isEmpty={subjects.length === 0}
      emptyMessage={emptyMessage}
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((subject) => (
          <div key={subject.id}>
            {renderSubject ? renderSubject(subject) : defaultRenderSubject(subject)}
          </div>
        ))}
      </div>
    </ProfileSection>
  );
}

