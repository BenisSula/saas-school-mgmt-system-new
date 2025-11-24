import { useMemo } from 'react';
import { Mail, Shield, BookOpen, Users, Building2 } from 'lucide-react';
import { DetailCard, type DetailField } from './DetailCard';
import { api, type TeacherProfile } from '../../lib/api';
import { useQuery } from '../../hooks/useQuery';
import { queryKeys } from '../../hooks/useQuery';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { StatusBanner } from '../ui/StatusBanner';

export interface HODRecord extends TeacherProfile {
  department?: string;
  teachersUnderOversight?: number;
}

export interface HODDetailViewProps {
  hodId: string;
  onClose?: () => void;
}

/**
 * Comprehensive HOD detail view component
 * Displays all HOD information using APIs
 */
export function HODDetailView({ hodId }: HODDetailViewProps) {
  const {
    data: hod,
    isLoading,
    error,
  } = useQuery(['hod', hodId], () => api.getTeacher(hodId), { enabled: !!hodId });

  // Fetch all teachers to count those under HOD oversight
  const { data: allTeachers = [] } = useQuery(
    queryKeys.admin.teachers(),
    () => api.listTeachers(),
    { staleTime: 60000 }
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <StatusBanner
        status="error"
        message={error instanceof Error ? error.message : 'Failed to load HOD details'}
      />
    );
  }

  if (!hod) {
    return <StatusBanner status="error" message="HOD not found" />;
  }

  // Calculate teachers under oversight (teachers with same subjects/department)
  // Memoized to avoid recalculating on every render
  const teachersUnderOversight = useMemo(() => {
    return allTeachers.filter((teacher) => {
      if (teacher.id === hod.id) return false;
      // Teachers with overlapping subjects are under HOD oversight
      return teacher.subjects.some((subject) => hod.subjects.includes(subject));
    });
  }, [allTeachers, hod.id, hod.subjects]);

  const fields: DetailField[] = [
    {
      label: 'Full Name',
      value: hod.name,
    },
    {
      label: 'Email',
      value: (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--brand-muted)]" />
          <a href={`mailto:${hod.email}`} className="text-[var(--brand-primary)] hover:underline">
            {hod.email}
          </a>
        </div>
      ),
    },
    {
      label: 'Department',
      value: hodRecord.department ? (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--brand-muted)]" />
          <span className="inline-flex items-center rounded-full bg-[var(--brand-primary)]/20 px-3 py-1 text-xs font-semibold text-[var(--brand-primary)]">
            {hodRecord.department}
          </span>
        </div>
      ) : (
        'Not assigned'
      ),
    },
    {
      label: 'HOD ID',
      value: hod.id,
    },
    {
      label: 'Subjects',
      value: (
        <div className="flex flex-wrap gap-2">
          {hod.subjects && hod.subjects.length > 0 ? (
            hod.subjects.map((subject) => (
              <span
                key={subject}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)]/20 px-3 py-1 text-xs font-medium text-[var(--brand-primary)]"
              >
                <BookOpen className="h-3 w-3" />
                {subject}
              </span>
            ))
          ) : (
            <span className="text-[var(--brand-muted)]">No subjects assigned</span>
          )}
        </div>
      ),
      span: 2,
    },
    {
      label: 'Assigned Classes',
      value: (
        <div className="flex flex-wrap gap-2">
          {hod.assigned_classes && hod.assigned_classes.length > 0 ? (
            hod.assigned_classes.map((className) => (
              <span
                key={className}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-accent)]/20 px-3 py-1 text-xs font-medium text-[var(--brand-accent)]"
              >
                <Users className="h-3 w-3" />
                {className}
              </span>
            ))
          ) : (
            <span className="text-[var(--brand-muted)]">No classes assigned</span>
          )}
        </div>
      ),
      span: 2,
    },
    {
      label: 'Teachers Under Oversight',
      value: (
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--brand-muted)]" />
          <span className="font-semibold">{teachersUnderOversight.length}</span>
          <span className="text-[var(--brand-muted)]">teachers</span>
        </div>
      ),
    },
    {
      label: 'Account Created',
      value: hod.created_at ? new Date(hod.created_at).toLocaleDateString() : 'Not available',
    },
    {
      label: 'Last Updated',
      value: hod.updated_at ? new Date(hod.updated_at).toLocaleDateString() : 'Not available',
    },
  ];

  return (
    <div className="space-y-4">
      <DetailCard title="Head of Department Information" fields={fields} />

      {/* Teachers Under Oversight Section */}
      {teachersUnderOversight.length > 0 && (
        <DetailCard
          title="Teachers Under Oversight"
          fields={[
            {
              label: 'Teachers',
              value: (
                <div className="space-y-2">
                  {teachersUnderOversight.slice(0, 10).map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                    >
                      <div>
                        <p className="font-medium text-[var(--brand-surface-contrast)]">
                          {teacher.name}
                        </p>
                        <p className="text-xs text-[var(--brand-muted)]">{teacher.email}</p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {teacher.subjects.slice(0, 3).map((subject) => (
                          <span
                            key={subject}
                            className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-0.5 text-xs text-[var(--brand-primary)]"
                          >
                            {subject}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                  {teachersUnderOversight.length > 10 && (
                    <p className="text-sm text-[var(--brand-muted)]">
                      +{teachersUnderOversight.length - 10} more teachers
                    </p>
                  )}
                </div>
              ),
              span: 2,
            },
          ]}
        />
      )}
    </div>
  );
}

export default HODDetailView;
