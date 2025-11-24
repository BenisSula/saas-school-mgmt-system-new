/**
 * HOD Teachers Page
 * Lists all teachers under HOD's department with filters
 */

import { useState, useMemo } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useHodTeachers, type HODTeacher } from '../../hooks/queries/hod';
import { Search, RefreshCw, Mail, BookOpen, Calendar } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';

export default function TeachersUnderHodPage() {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string>('');
  const queryClient = useQueryClient();

  const {
    data: teachers,
    isLoading,
    error,
  } = useHodTeachers({
    search: search || undefined,
    subject: subjectFilter || undefined,
  });

  const refreshTeachers = () => {
    queryClient.invalidateQueries({ queryKey: ['hod', 'teachers'] });
  };

  // Extract unique subjects for filter
  const uniqueSubjects = useMemo(() => {
    if (!teachers) return [];
    const subjects = new Set<string>();
    teachers.forEach((teacher) => {
      teacher.subjects.forEach((subject) => subjects.add(subject));
    });
    return Array.from(subjects).sort();
  }, [teachers]);

  const columns: DataTableColumn<HODTeacher>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Teacher Name',
        render: (row) => (
          <div className="font-medium text-[var(--brand-surface-contrast)]">{row.name}</div>
        ),
        sortable: true,
      },
      {
        key: 'email',
        header: 'Email',
        render: (row) => (
          <div className="flex items-center gap-2 text-sm text-[var(--brand-muted)]">
            <Mail className="h-4 w-4" />
            {row.email || 'N/A'}
          </div>
        ),
        sortable: true,
      },
      {
        key: 'subjects',
        header: 'Subjects',
        render: (row) => (
          <div className="flex flex-wrap gap-1">
            {row.subjects.map((subject) => (
              <span
                key={subject}
                className="rounded-full border border-[var(--brand-border)] bg-black/15 px-2 py-1 text-xs text-[var(--brand-surface-contrast)]"
              >
                {subject}
              </span>
            ))}
            {row.subjects.length === 0 && (
              <span className="text-xs text-[var(--brand-muted)]">No subjects assigned</span>
            )}
          </div>
        ),
      },
      {
        key: 'classes',
        header: 'Classes',
        render: (row) => (
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="h-4 w-4 text-[var(--brand-muted)]" />
            <span>{row.classes.length} classes</span>
          </div>
        ),
      },
      {
        key: 'lastActive',
        header: 'Last Active',
        render: (row) => (
          <div className="flex items-center gap-2 text-sm text-[var(--brand-muted)]">
            <Calendar className="h-4 w-4" />
            {row.lastActive ? new Date(row.lastActive).toLocaleDateString() : 'Never'}
          </div>
        ),
        sortable: true,
      },
    ],
    []
  );

  if (isLoading) {
    return (
      <RouteMeta title="Department Teachers">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Department Teachers">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Department Teachers">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Department Teachers
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage and oversee teachers in your department
            </p>
          </div>
          <Button onClick={refreshTeachers} leftIcon={<RefreshCw className="h-4 w-4" />}>
            Refresh
          </Button>
        </header>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="flex-1">
            <Input
              type="text"
              placeholder="Search teachers by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search className="h-4 w-4" />}
            />
          </div>
          <div className="w-full sm:w-48">
            <Select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              placeholder="Filter by subject"
            >
              <option value="">All Subjects</option>
              {uniqueSubjects.map((subject) => (
                <option key={subject} value={subject}>
                  {subject}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Teachers Table */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <DataTable<HODTeacher>
            data={teachers || []}
            columns={columns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No teachers found in your department."
          />
        </div>
      </div>
    </RouteMeta>
  );
}
