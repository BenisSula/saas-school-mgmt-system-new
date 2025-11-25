import { Mail, BookOpen, Users } from 'lucide-react';
import { DetailCard, type DetailField } from './DetailCard';
import { api } from '../../lib/api';
import { useQuery } from '../../hooks/useQuery';
import { queryKeys } from '../../hooks/useQuery';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { StatusBanner } from '../ui/StatusBanner';

export interface TeacherDetailViewProps {
  teacherId: string;
  onClose?: () => void;
}

/**
 * Comprehensive teacher detail view component
 * Displays all teacher information using APIs
 */
export function TeacherDetailView({ teacherId }: TeacherDetailViewProps) {
  const {
    data: teacher,
    isLoading,
    error,
  } = useQuery(queryKeys.admin.teachers(), () => api.getTeacher(teacherId), {
    enabled: !!teacherId,
  });

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <StatusBanner
        status="error"
        message={error instanceof Error ? error.message : 'Failed to load teacher details'}
      />
    );
  }

  if (!teacher) {
    return <StatusBanner status="error" message="Teacher not found" />;
  }

  const fields: DetailField[] = [
    {
      label: 'Full Name',
      value: teacher.name,
    },
    {
      label: 'Email',
      value: (
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-[var(--brand-muted)]" />
          <a
            href={`mailto:${teacher.email}`}
            className="text-[var(--brand-primary)] hover:underline"
          >
            {teacher.email}
          </a>
        </div>
      ),
    },
    {
      label: 'Teacher ID',
      value: teacher.id,
    },
    {
      label: 'Account Created',
      value: teacher.created_at
        ? new Date(teacher.created_at).toLocaleDateString()
        : 'Not available',
    },
    {
      label: 'Subjects Taught',
      value: (
        <div className="flex flex-wrap gap-2">
          {teacher.subjects && teacher.subjects.length > 0 ? (
            teacher.subjects.map((subject) => (
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
          {teacher.assigned_classes && teacher.assigned_classes.length > 0 ? (
            teacher.assigned_classes.map((className) => (
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
      label: 'Last Updated',
      value: teacher.updated_at
        ? new Date(teacher.updated_at).toLocaleDateString()
        : 'Not available',
    },
  ];

  return (
    <div className="space-y-4">
      <DetailCard title="Teacher Information" fields={fields} />
    </div>
  );
}

export default TeacherDetailView;
