import { useQuery } from '../useQuery';
import { api } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { isHOD, hasAdditionalRole } from '../../lib/utils/userHelpers';

// Student Dashboard Queries
export function useStudentDashboard() {
  const { user } = useAuth();

  const attendanceQuery = useQuery(
    ['student', 'dashboard', 'attendance', user?.id],
    () => api.getStudentAttendance(user!.id),
    { enabled: !!user?.id }
  );

  const invoicesQuery = useQuery(
    ['student', 'dashboard', 'invoices', user?.id],
    () => api.getStudentInvoices(user!.id),
    { enabled: !!user?.id }
  );

  const profileQuery = useQuery(
    ['student', 'dashboard', 'profile', user?.id],
    () => api.student.getProfile(),
    { enabled: !!user?.id }
  );

  const latestExamQuery = useQuery(
    ['student', 'dashboard', 'latest-exam', user?.id],
    () => api.student.getLatestExamId(),
    { enabled: !!user?.id }
  );

  const resultQuery = useQuery(
    ['student', 'dashboard', 'result', user?.id, latestExamQuery.data?.examId],
    async () => {
      if (!latestExamQuery.data?.examId || !user?.id) {
        throw new Error('Missing exam ID or user ID');
      }
      return api.getStudentResult(user.id, latestExamQuery.data.examId);
    },
    { enabled: !!user?.id && !!latestExamQuery.data?.examId }
  );

  const rosterQuery = useQuery(
    ['student', 'dashboard', 'roster', user?.id],
    () => api.student.getClassRoster(),
    { enabled: !!user?.id }
  );

  return {
    attendance: attendanceQuery.data,
    invoices: invoicesQuery.data || [],
    profile: profileQuery.data,
    latestExam: latestExamQuery.data,
    result: resultQuery.data,
    roster: rosterQuery.data || [],
    loading:
      attendanceQuery.isLoading ||
      invoicesQuery.isLoading ||
      profileQuery.isLoading ||
      latestExamQuery.isLoading ||
      resultQuery.isLoading ||
      rosterQuery.isLoading,
    error:
      attendanceQuery.error ||
      invoicesQuery.error ||
      profileQuery.error ||
      latestExamQuery.error ||
      resultQuery.error ||
      rosterQuery.error
  };
}

// Teacher Dashboard Queries
export function useTeacherDashboard() {
  const { user } = useAuth();

  const overviewQuery = useQuery(
    ['teacher', 'dashboard', 'overview', user?.id],
    () => api.teacher.getOverview(),
    { enabled: !!user?.id }
  );

  // Additional queries for analytics
  const classesQuery = useQuery(
    ['teacher', 'dashboard', 'classes', user?.id],
    async () => {
      const overview = await api.teacher.getOverview();
      return overview.assignments.map((a) => a.className);
    },
    { enabled: !!user?.id }
  );

  return {
    overview: overviewQuery.data,
    classes: classesQuery.data || [],
    loading: overviewQuery.isLoading || classesQuery.isLoading,
    error: overviewQuery.error || classesQuery.error
  };
}

// HOD Dashboard Queries (if HOD is a teacher with additional role)
export function useHODDashboard() {
  const { user } = useAuth();

  // HOD dashboard would show department-level analytics
  const departmentQuery = useQuery(
    ['hod', 'dashboard', 'department', user?.id],
    async () => {
      // Get teacher profile to determine department
      const teacherProfile = await api.teacher.getProfile();
      const users = await api.listUsers();
      const currentUser = users.find((u) => u.id === user?.id);
      const isUserHOD = currentUser && isHOD(currentUser);
      const department =
        (isUserHOD && hasAdditionalRole(currentUser, 'hod')
          ? (currentUser.additional_roles?.find((r) => r.role === 'hod')?.metadata as {
              department?: string;
            })?.department
          : undefined) ||
        teacherProfile.subjects[0] ||
        'General';

      // Get teachers in same department
      const teachers = await api.listTeachers();
      const departmentTeachers = teachers.filter((t) =>
        t.subjects.some((subject) => teacherProfile.subjects.includes(subject))
      );

      // Get students in classes taught by department teachers
      const students = await api.listStudents();
      const classes = await api.listClasses();

      return {
        department,
        teachers: departmentTeachers,
        totalTeachers: departmentTeachers.length,
        totalStudents: students.length, // Approximate - can be enhanced
        classes: classes.length
      };
    },
    { enabled: !!user?.id }
  );

  return {
    department: departmentQuery.data,
    loading: departmentQuery.isLoading,
    error: departmentQuery.error
  };
}
