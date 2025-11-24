import { Phone, Calendar, GraduationCap, Users } from 'lucide-react';
import { DetailCard, type DetailField } from './DetailCard';
import { api } from '../../lib/api';
import { useQuery } from '../../hooks/useQuery';
import { DashboardSkeleton } from '../ui/DashboardSkeleton';
import { StatusBanner } from '../ui/StatusBanner';

export interface StudentDetailViewProps {
  studentId: string;
  onClose?: () => void;
}

/**
 * Comprehensive student detail view component
 * Displays all student information using APIs
 */
export function StudentDetailView({ studentId }: StudentDetailViewProps) {
  const {
    data: student,
    isLoading,
    error,
  } = useQuery(['student', studentId], () => api.getStudent(studentId), { enabled: !!studentId });

  // Fetch student subjects if available
  const { data: studentSubjects } = useQuery(
    ['student', 'subjects', studentId],
    () => api.admin.getStudentSubjects(studentId),
    { enabled: !!studentId, staleTime: 60000 }
  );

  if (isLoading) {
    return <DashboardSkeleton />;
  }

  if (error) {
    return (
      <StatusBanner
        status="error"
        message={error instanceof Error ? error.message : 'Failed to load student details'}
      />
    );
  }

  if (!student) {
    return <StatusBanner status="error" message="Student not found" />;
  }

  // Memoize expensive computations
  const fullName = useMemo(
    () => `${student.first_name} ${student.last_name}`,
    [student.first_name, student.last_name]
  );

  const age = useMemo(() => {
    if (!student.date_of_birth) return null;
    return Math.floor(
      (new Date().getTime() - new Date(student.date_of_birth).getTime()) /
        (365.25 * 24 * 60 * 60 * 1000)
    );
  }, [student.date_of_birth]);

  const parentContacts = useMemo(() => {
    if (Array.isArray(student.parent_contacts)) {
      return student.parent_contacts;
    }
    if (typeof student.parent_contacts === 'string') {
      try {
        return JSON.parse(student.parent_contacts || '[]');
      } catch {
        return [];
      }
    }
    return [];
  }, [student.parent_contacts]);

  const fields: DetailField[] = [
    {
      label: 'Full Name',
      value: fullName,
    },
    {
      label: 'Admission Number',
      value: student.admission_number || 'Not assigned',
    },
    {
      label: 'Date of Birth',
      value: student.date_of_birth ? (
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-[var(--brand-muted)]" />
          <span>
            {new Date(student.date_of_birth).toLocaleDateString()}
            {age !== null && ` (${age} years old)`}
          </span>
        </div>
      ) : (
        'Not provided'
      ),
    },
    {
      label: 'Class',
      value: student.class_id ? (
        <div className="flex items-center gap-2">
          <GraduationCap className="h-4 w-4 text-[var(--brand-muted)]" />
          <span>{student.class_id}</span>
        </div>
      ) : (
        'Not assigned'
      ),
    },
    {
      label: 'Enrollment Status',
      value: (
        <span
          className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
            student.enrollment_status === 'active'
              ? 'bg-green-500/20 text-green-500'
              : student.enrollment_status === 'graduated'
                ? 'bg-blue-500/20 text-blue-500'
                : student.enrollment_status === 'suspended'
                  ? 'bg-red-500/20 text-red-500'
                  : 'bg-gray-500/20 text-gray-500'
          }`}
        >
          {student.enrollment_status || 'active'}
        </span>
      ),
    },
    {
      label: 'Student ID',
      value: student.id,
    },
    {
      label: 'Subjects',
      value: (
        <div className="flex flex-wrap gap-2">
          {studentSubjects && studentSubjects.length > 0 ? (
            studentSubjects.map((subject, idx) => (
              <span
                key={subject.subject_id || idx}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)]/20 px-3 py-1 text-xs font-medium text-[var(--brand-primary)]"
              >
                {subject.name}
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
      label: 'Parent/Guardian Contacts',
      value:
        parentContacts.length > 0 ? (
          <div className="space-y-2">
            {parentContacts.map(
              (contact: { name: string; relationship: string; phone: string }, idx: number) => (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                >
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-[var(--brand-muted)]" />
                    <span className="font-medium">{contact.name}</span>
                    <span className="text-[var(--brand-muted)]">({contact.relationship})</span>
                  </div>
                  {contact.phone && (
                    <div className="mt-1 flex items-center gap-2 text-sm text-[var(--brand-muted)]">
                      <Phone className="h-3 w-3" />
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-[var(--brand-primary)] hover:underline"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        ) : (
          <span className="text-[var(--brand-muted)]">No parent/guardian contacts</span>
        ),
      span: 2,
    },
    {
      label: 'Account Created',
      value: student.created_at
        ? new Date(student.created_at).toLocaleDateString()
        : 'Not available',
    },
    {
      label: 'Last Updated',
      value: student.updated_at
        ? new Date(student.updated_at).toLocaleDateString()
        : 'Not available',
    },
  ];

  return (
    <div className="space-y-4">
      <DetailCard title="Student Information" fields={fields} />
    </div>
  );
}

export default StudentDetailView;
