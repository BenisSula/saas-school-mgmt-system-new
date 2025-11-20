import { ProfileSection } from '../ProfileSection';

interface DepartmentSectionProps {
  department: string | null | undefined;
  teachersUnderOversight?: Array<{
    id: string;
    name: string;
    email?: string;
    subjects?: string[];
  }>;
  emptyMessage?: string;
  title?: string;
  description?: string;
}

export function DepartmentSection({
  department,
  teachersUnderOversight,
  emptyMessage = 'No department assigned',
  title,
  description
}: DepartmentSectionProps) {
  const hasContent = department || (teachersUnderOversight && teachersUnderOversight.length > 0);

  return (
    <ProfileSection
      title={title}
      description={description}
      isEmpty={!hasContent}
      emptyMessage={emptyMessage}
    >
      <div className="space-y-4">
        {department && (
          <div className="rounded-lg border border-[var(--brand-border)] bg-slate-950/40 p-4">
            <p className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              {department}
            </p>
          </div>
        )}
        {teachersUnderOversight && teachersUnderOversight.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--brand-surface-contrast)]">
              Teachers under oversight
            </h3>
            {teachersUnderOversight.map((teacher) => (
              <div
                key={teacher.id}
                className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-3"
              >
                <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                  {teacher.name}
                </p>
                {teacher.email && (
                  <p className="text-xs text-[var(--brand-muted)]">{teacher.email}</p>
                )}
                {teacher.subjects && teacher.subjects.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {teacher.subjects.map((subject) => (
                      <span
                        key={subject}
                        className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
                      >
                        {subject}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </ProfileSection>
  );
}

