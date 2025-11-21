import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { Select } from '../../components/ui/Select';
import { api, type TeacherStudent, type TeacherClassInfo } from '../../lib/api';
import { extractPaginatedData } from '../../lib/api/pagination';
import { Users } from 'lucide-react';

export default function TeacherStudentsPage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');

  const { data: classes, isLoading: loadingClasses, error: classesError } = useQuery<TeacherClassInfo[]>({
    queryKey: ['teacher-classes'],
    queryFn: () => api.teachers.getMyClasses()
  });

  const { data: studentsData, isLoading: loadingStudents, error: studentsError } = useQuery({
    queryKey: ['teacher-students', selectedClassId],
    queryFn: () => api.teachers.getMyStudents({ classId: selectedClassId || undefined }),
    enabled: !!classes && classes.length > 0
  });

  const students = studentsData ? extractPaginatedData(studentsData) : [];
  const error = classesError || studentsError;

  useEffect(() => {
    if (classes && classes.length > 0 && !selectedClassId) {
      setSelectedClassId(classes[0].id);
    }
  }, [classes, selectedClassId]);

  const columns: DataTableColumn<TeacherStudent>[] = [
    {
      key: 'name',
      header: 'Name',
      render: (row) => `${row.first_name} ${row.last_name}`,
      sortable: true
    },
    {
      key: 'admission_number',
      header: 'Admission Number',
      render: (row) => row.admission_number || 'N/A',
      sortable: true
    },
    {
      key: 'class_id',
      header: 'Class',
      render: (row) => row.class_id || 'N/A',
      sortable: true
    }
  ];

  if (loadingClasses || loadingStudents) {
    return (
      <RouteMeta title="My Students">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="My Students">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            My Students
          </h1>
        </div>

        {error && (
          <StatusBanner status="error" message={error instanceof Error ? error.message : 'Failed to load students'} />
        )}

        {classes && classes.length > 0 && (
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium">Filter by Class:</label>
            <Select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              options={classes.map((c) => ({ value: c.id, label: `${c.name} (${c.studentCount} students)` }))}
            />
          </div>
        )}

        {students.length === 0 && !error && (
          <StatusBanner
            status="info"
            message={selectedClassId ? 'No students found in the selected class.' : 'You are not assigned to any classes yet.'}
          />
        )}

        {students.length > 0 && (
          <DataTable columns={columns} data={students} />
        )}
      </div>
    </RouteMeta>
  );
}

