import { GraduationCap, Users, BookOpen, UserCheck } from 'lucide-react';
import { DetailCard, type DetailField } from './DetailCard';
import { api } from '../../lib/api';
import { useQuery } from '../../hooks/useQuery';
import { queryKeys } from '../../hooks/useQuery';
import { StatusBanner } from '../ui/StatusBanner';

export interface ClassDetailViewProps {
  classId: string;
  onClose?: () => void;
}

/**
 * Comprehensive class detail view component
 * Displays all class information including students, teachers, subjects, and grades
 */
export function ClassDetailView({ classId }: ClassDetailViewProps) {
  // Fetch class details
  const { data: classes = [] } = useQuery(
    queryKeys.admin.classes(),
    () => api.listClasses(),
    { staleTime: 60000 }
  );

  const schoolClass = classes.find((c) => c.id === classId);

  // Fetch students in this class
  const { data: allStudents = [] } = useQuery(
    queryKeys.admin.students(),
    () => api.listStudents({ classId }),
    { enabled: !!classId, staleTime: 30000 }
  );

  const classStudents = allStudents.filter((s) => s.class_id === classId);

  // Fetch class subjects
  const { data: classSubjects = [] } = useQuery(
    ['class', 'subjects', classId],
    () => api.admin.getClassSubjects(classId),
    { enabled: !!classId, staleTime: 60000 }
  );

  // Fetch all teachers to find class teachers
  const { data: allTeachers = [] } = useQuery(
    queryKeys.admin.teachers(),
    () => api.listTeachers(),
    { staleTime: 60000 }
  );

  // Find class teacher (teacher assigned to this class)
  const classTeacher = allTeachers.find((teacher) =>
    teacher.assigned_classes.includes(classId)
  );

  // Fetch teacher assignments for this class
  const { data: teacherAssignments = [] } = useQuery(
    ['admin', 'teacher-assignments'],
    () => api.admin.listTeacherAssignments(),
    { staleTime: 60000 }
  );

  const classTeacherAssignments = teacherAssignments.filter(
    (assignment) => assignment.class_id === classId
  );

  if (!schoolClass) {
    return <StatusBanner status="error" message="Class not found" />;
  }

  const fields: DetailField[] = [
    {
      label: 'Class Name',
      value: (
        <div className="flex items-center gap-2">
          <GraduationCap className="h-5 w-5 text-[var(--brand-primary)]" />
          <span className="text-lg font-semibold">{schoolClass.name}</span>
        </div>
      )
    },
    {
      label: 'Class ID',
      value: schoolClass.id
    },
    {
      label: 'Total Students',
      value: (
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-[var(--brand-muted)]" />
          <span className="font-semibold">{classStudents.length}</span>
          <span className="text-[var(--brand-muted)]">students</span>
        </div>
      )
    },
    {
      label: 'Class Teacher',
      value: classTeacher ? (
        <div className="flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-[var(--brand-muted)]" />
          <span>{classTeacher.name}</span>
          <span className="text-xs text-[var(--brand-muted)]">({classTeacher.email})</span>
        </div>
      ) : (
        'Not assigned'
      )
    },
    {
      label: 'Subjects',
      value: (
        <div className="flex flex-wrap gap-2">
          {classSubjects.length > 0 ? (
            classSubjects.map((subject, idx) => (
              <span
                key={subject.subject_id || idx}
                className="inline-flex items-center gap-1 rounded-full bg-[var(--brand-primary)]/20 px-3 py-1 text-xs font-medium text-[var(--brand-primary)]"
              >
                <BookOpen className="h-3 w-3" />
                {subject.name}
              </span>
            ))
          ) : (
            <span className="text-[var(--brand-muted)]">No subjects assigned</span>
          )}
        </div>
      ),
      span: 2
    },
    {
      label: 'Teachers Assigned',
      value: classTeacherAssignments.length > 0 ? (
        <div className="space-y-2">
          {classTeacherAssignments.map((assignment) => {
            const teacher = allTeachers.find((t) => t.id === assignment.teacher_id);
            return teacher ? (
              <div
                key={assignment.id}
                className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-2"
              >
                <div>
                  <p className="text-sm font-medium">{teacher.name}</p>
                  <p className="text-xs text-[var(--brand-muted)]">
                    {assignment.subject_name} {assignment.is_class_teacher ? '(Class Teacher)' : ''}
                  </p>
                </div>
              </div>
            ) : null;
          })}
        </div>
      ) : (
        <span className="text-[var(--brand-muted)]">No teachers assigned</span>
      ),
      span: 2
    }
  ];

  return (
    <div className="space-y-4">
      <DetailCard title="Class Information" fields={fields} />

      {/* Students in Class */}
      {classStudents.length > 0 && (
        <DetailCard
          title={`Students in ${schoolClass.name}`}
          fields={[
            {
              label: 'Student Roster',
              value: (
                <div className="space-y-2">
                  {classStudents.map((student) => (
                    <div
                      key={student.id}
                      className="flex items-center justify-between rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-3"
                    >
                      <div>
                        <p className="font-medium text-[var(--brand-surface-contrast)]">
                          {student.first_name} {student.last_name}
                        </p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-[var(--brand-muted)]">
                          {student.admission_number && (
                            <span>ID: {student.admission_number}</span>
                          )}
                          {student.enrollment_status && (
                            <span
                              className={`rounded-full px-2 py-0.5 ${
                                student.enrollment_status === 'active'
                                  ? 'bg-green-500/20 text-green-500'
                                  : 'bg-gray-500/20 text-gray-500'
                              }`}
                            >
                              {student.enrollment_status}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ),
              span: 2
            }
          ]}
        />
      )}
    </div>
  );
}

export default ClassDetailView;

