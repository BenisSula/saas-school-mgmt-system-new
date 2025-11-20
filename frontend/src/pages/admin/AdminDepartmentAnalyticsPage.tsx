import { useMemo, useState } from 'react';
import { useDepartmentAnalytics } from '../../hooks/queries/useAdminQueries';
import { useTeachers, useStudents, useClasses } from '../../hooks/queries/useAdminQueries';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { PieChart, type PieChartData } from '../../components/charts/PieChart';
import { StatCard } from '../../components/charts/StatCard';
import { LineChart, type LineChartDataPoint } from '../../components/charts/LineChart';
import { ChartContainer, PageHeader } from '../../components/charts';
import { Select } from '../../components/ui/Select';
import RouteMeta from '../../components/layout/RouteMeta';
import { Users, GraduationCap, BookOpen, TrendingUp } from 'lucide-react';

export default function AdminDepartmentAnalyticsPage() {
  const [selectedDepartment, setSelectedDepartment] = useState<string>('all');

  const { data: teachersData } = useTeachers();
  const { data: studentsData } = useStudents();
  const { data: classesData } = useClasses();
  const { data: analyticsData } = useDepartmentAnalytics(
    selectedDepartment !== 'all' ? selectedDepartment : undefined
  );

  const teachers = useMemo(() => teachersData || [], [teachersData]);
  const students = useMemo(() => studentsData || [], [studentsData]);
  const classes = useMemo(() => classesData || [], [classesData]);

  // Extract departments from teachers' subjects
  const departments = useMemo(() => {
    const deptSet = new Set<string>();
    teachers.forEach((teacher) => {
      teacher.subjects.forEach((subject) => {
        // Use subject as department (can be enhanced with actual department field)
        deptSet.add(subject);
      });
    });
    return Array.from(deptSet);
  }, [teachers]);

  // Teacher distribution by department
  const teacherDistribution: BarChartData[] = useMemo(() => {
    return departments.map((dept) => ({
      label: dept,
      value: teachers.filter((t) => t.subjects.includes(dept)).length,
      color: 'var(--brand-primary)'
    }));
  }, [departments, teachers]);

  // Student distribution by class
  const studentDistribution: PieChartData[] = useMemo(() => {
    const classCounts = new Map<string, number>();
    students.forEach((student) => {
      const className = student.class_id || 'Unassigned';
      classCounts.set(className, (classCounts.get(className) || 0) + 1);
    });
    return Array.from(classCounts.entries()).map(([label, value]) => ({
      label,
      value,
      color: undefined // Will use default colors
    }));
  }, [students]);

  // Class size trend based on actual class assignments
  const classSizeTrend: LineChartDataPoint[] = useMemo(() => {
    return classes.map((clazz) => ({
      label: clazz.name,
      value: students.filter((s) => s.class_uuid === clazz.id || s.class_id === clazz.id).length
    }));
  }, [classes, students]);

  const stats = useMemo(() => {
    // Use analytics data if available for specific department
    if (analyticsData && selectedDepartment !== 'all') {
      return {
        totalTeachers: analyticsData.totalTeachers,
        totalStudents: analyticsData.totalStudents,
        totalClasses: classes.length,
        avgClassSize: analyticsData.averageClassSize
      };
    }

    // Platform-wide stats
    const totalTeachers = teachers.length;
    const totalStudents = students.length;
    const totalClasses = classes.length;
    const avgClassSize = totalClasses > 0 ? totalStudents / totalClasses : 0;

    return {
      totalTeachers,
      totalStudents,
      totalClasses,
      avgClassSize: Math.round(avgClassSize * 10) / 10
    };
  }, [teachers, students, classes, analyticsData, selectedDepartment]);

  return (
    <RouteMeta title="Department Analytics">
      <div className="space-y-6">
        <PageHeader
          title="Department Analytics"
          description="Overview of department performance and statistics"
          action={
            <div className="sm:w-48">
              <Select
                label="Department"
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                options={[
                  { label: 'All Departments', value: 'all' },
                  ...departments.map((dept) => ({ label: dept, value: dept }))
                ]}
              />
            </div>
          }
        />

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Teachers"
            value={stats.totalTeachers}
            icon={<Users className="h-5 w-5" />}
            description="Active teaching staff"
          />
          <StatCard
            title="Total Students"
            value={stats.totalStudents}
            icon={<GraduationCap className="h-5 w-5" />}
            description="Enrolled students"
          />
          <StatCard
            title="Total Classes"
            value={stats.totalClasses}
            icon={<BookOpen className="h-5 w-5" />}
            description="Active classes"
          />
          <StatCard
            title="Avg Class Size"
            value={stats.avgClassSize}
            icon={<TrendingUp className="h-5 w-5" />}
            description="Students per class"
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartContainer>
            <BarChart
              data={teacherDistribution}
              title="Teacher Distribution by Department"
              height={250}
            />
          </ChartContainer>
          <ChartContainer>
            <PieChart data={studentDistribution} title="Student Distribution by Class" size={250} />
          </ChartContainer>
          <ChartContainer className="lg:col-span-2">
            <LineChart data={classSizeTrend} title="Class Size Trend" height={200} />
          </ChartContainer>
        </div>
      </div>
    </RouteMeta>
  );
}
