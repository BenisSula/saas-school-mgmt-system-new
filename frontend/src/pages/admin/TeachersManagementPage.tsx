import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { PaginatedTable } from '../../components/admin/PaginatedTable';
import { ExportButtons } from '../../components/admin/ExportButtons';
import { createExportHandlers } from '../../hooks/useExport';
import { useQueryClient } from '@tanstack/react-query';
import { useTeachers, useUpdateTeacher, useDeleteTeacher } from '../../hooks/queries/useTeachers';
import { useClasses } from '../../hooks/queries/useClasses';
import { useDebounce } from '../../hooks/useDebounce';
import { useQuery } from '../../hooks/useQuery';
import { queryKeys } from '../../hooks/useQuery';
import { api, type TeacherProfile } from '../../lib/api';
import type { TableColumn } from '../../components/ui/Table';
import { ViewButton, AssignButton, ActionButtonGroup } from '../../components/table-actions';
import { FormModal } from '../../components/shared';
import { AdminUserRegistrationModal } from '../../components/admin/AdminUserRegistrationModal';
import { EmptyState } from '../../components/admin/EmptyState';
import { CSVImportModal } from '../../components/admin/CSVImportModal';
import { AdvancedFilters, type AdvancedFilterField } from '../../components/admin/AdvancedFilters';
import { ActivityLog } from '../../components/admin/ActivityLog';
import { TeacherDetailView } from '../../components/admin/TeacherDetailView';
import { useCSVImport } from '../../hooks/useCSVImport';
import { usePermission } from '../../hooks/usePermission';
import { Plus, Upload, Eye } from 'lucide-react';

interface TeacherFilters {
  search: string;
  classId: string;
  subjectId: string;
}

const defaultFilters: TeacherFilters = {
  search: '',
  classId: 'all',
  subjectId: 'all',
};

export function TeachersManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<TeacherFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showActivityLog, setShowActivityLog] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  const [selectedTeacherId, setSelectedTeacherId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isClassTeacher, setIsClassTeacher] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // CSV Import
  const csvImportMutation = useCSVImport({
    entityType: 'teachers',
    invalidateQueries: [[...queryKeys.admin.teachers()]] as unknown as unknown[][],
  });

  // Debounce search filter to prevent excessive API calls
  const debouncedSearch = useDebounce(filters.search, 500);

  // Build API filters
  const apiFilters = useMemo(() => {
    const result: { search?: string } = {};
    if (debouncedSearch) {
      result.search = debouncedSearch;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }, [debouncedSearch]);

  // Fetch data using React Query hooks
  const {
    data: teachers = [],
    isLoading: teachersLoading,
    error: teachersError,
  } = useTeachers(apiFilters);
  const { data: classes = [], isLoading: classesLoading } = useClasses();
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery(
    queryKeys.admin.subjects(),
    () => api.admin.listSubjects(),
    { staleTime: 60000 } // Subjects don't change often
  );

  // Mutations
  const updateTeacherMutation = useUpdateTeacher();
  const deleteTeacherMutation = useDeleteTeacher();

  // RBAC: Check permissions for UI controls
  const canManageTeachers = usePermission('teachers:manage');

  const loading = teachersLoading || classesLoading || subjectsLoading;
  const error = teachersError ? (teachersError as Error).message : null;

  // Advanced filter fields
  const advancedFilterFields: AdvancedFilterField[] = [
    {
      key: 'classId',
      label: 'Class',
      type: 'select',
      options: [
        { label: 'All classes', value: 'all' },
        ...classes.map((c) => ({ label: c.name, value: c.id })),
      ],
    },
    {
      key: 'subjectId',
      label: 'Subject',
      type: 'select',
      options: [
        { label: 'All subjects', value: 'all' },
        ...subjects.map((s) => ({ label: s.name, value: s.id })),
      ],
    },
  ];

  const filteredTeachers = useMemo(() => {
    return teachers.filter((teacher) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          teacher.name.toLowerCase().includes(searchLower) ||
          teacher.email.toLowerCase().includes(searchLower) ||
          teacher.subjects.some((s) => s.toLowerCase().includes(searchLower)) ||
          teacher.assigned_classes.some((c) => c.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Class filter
      if (filters.classId !== 'all') {
        if (!teacher.assigned_classes.includes(filters.classId)) return false;
      }

      // Subject filter
      if (filters.subjectId !== 'all') {
        if (!teacher.subjects.includes(filters.subjectId)) return false;
      }

      return true;
    });
  }, [teachers, filters]);

  const handleViewProfile = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setSelectedTeacherId(teacher.id);
    setShowProfileModal(true);
  };

  const handleViewDetails = (teacher: TeacherProfile) => {
    setSelectedTeacherId(teacher.id);
    setShowDetailModal(true);
  };

  const handleAssignClass = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setSelectedClass('');
    setSelectedSubject('');
    setIsClassTeacher(false);
    setShowAssignmentModal(true);
  };

  const getAssignmentMutationVariables = ():
    | { id: string; data: { assignedClasses: string[]; subjects: string[] } }
    | undefined => {
    if (!selectedTeacher || !selectedClass || !selectedSubject) {
      return undefined;
    }

    // Also update teacher's assigned_classes and subjects arrays
    const updatedClasses = selectedTeacher.assigned_classes.includes(selectedClass)
      ? selectedTeacher.assigned_classes
      : [...selectedTeacher.assigned_classes, selectedClass];

    const updatedSubjects = selectedTeacher.subjects.includes(selectedSubject)
      ? selectedTeacher.subjects
      : [...selectedTeacher.subjects, selectedSubject];

    return {
      id: selectedTeacher.id,
      data: {
        assignedClasses: updatedClasses,
        subjects: updatedSubjects,
      },
    };
  };

  const handleAssignmentSuccess = async () => {
    if (!selectedTeacher || !selectedClass || !selectedSubject) {
      return;
    }

    try {
      // Assign teacher to class/subject via admin API
      await api.admin.assignTeacher(selectedTeacher.id, {
        classId: selectedClass,
        subjectId: selectedSubject,
        isClassTeacher,
      });
    } catch {
      // Error already handled by mutation
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      return;
    }

    if (!window.confirm(`Delete ${selectedRows.size} teacher(s)? This action cannot be undone.`)) {
      return;
    }

    // Delete teachers one by one (can be optimized to bulk delete if backend supports it)
    const deletePromises = Array.from(selectedRows).map((id) =>
      deleteTeacherMutation.mutateAsync(id)
    );

    try {
      await Promise.all(deletePromises);
      setSelectedRows(new Set());
    } catch {
      // Error handled by mutation
    }
  };

  // Consolidated export handlers using DRY principle
  const exportHandlers = useMemo(() => {
    const exportData = filteredTeachers.map((t) => ({
      Name: t.name,
      Email: t.email,
      Subjects: t.subjects.join('; '),
      Classes: t.assigned_classes.join('; '),
    }));

    const handlers = createExportHandlers(exportData, 'teachers', [
      'Name',
      'Email',
      'Subjects',
      'Classes',
    ]);

    // For PDF/Excel, use backend endpoint with filters
    const exportPayload = {
      type: 'teachers' as const,
      title: 'Teachers Export',
      filters: {
        search: filters.search || undefined,
      },
    };

    return {
      ...handlers,
      exportPDF: () => handlers.exportPDF('/reports/export', exportPayload),
      exportExcel: () => handlers.exportExcel('/reports/export', exportPayload),
    };
  }, [filteredTeachers, filters]);

  const handleExportCSV = exportHandlers.exportCSV;
  const handleExportPDF = exportHandlers.exportPDF;
  const handleExportExcel = exportHandlers.exportExcel;

  const toggleRowSelection = (teacherId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(teacherId)) {
        next.delete(teacherId);
      } else {
        next.add(teacherId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredTeachers.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredTeachers.map((t) => t.id)));
    }
  };

  const teacherColumns: TableColumn<TeacherProfile>[] = [
    {
      header: (
        <input
          type="checkbox"
          checked={selectedRows.size === filteredTeachers.length && filteredTeachers.length > 0}
          onChange={toggleAllSelection}
          className="rounded border-[var(--brand-border)]"
          aria-label="Select all teachers"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedRows.has(row.id)}
          onChange={() => toggleRowSelection(row.id)}
          className="rounded border-[var(--brand-border)]"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.name}`}
        />
      ),
      align: 'center',
    },
    {
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--brand-surface-contrast)]">{row.name}</p>
          <p className="text-xs text-[var(--brand-muted)]">{row.email}</p>
        </div>
      ),
    },
    {
      header: 'Subjects',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.subjects.length > 0 ? (
            row.subjects.map((subject) => (
              <span
                key={subject}
                className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs text-[var(--brand-primary)]"
              >
                {subject}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--brand-muted)]">No subjects</span>
          )}
        </div>
      ),
    },
    {
      header: 'Classes',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.assigned_classes.length > 0 ? (
            row.assigned_classes.map((className) => (
              <span
                key={className}
                className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
              >
                {className}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--brand-muted)]">No classes</span>
          )}
        </div>
      ),
    },
    {
      header: 'Actions',
      render: (row) => (
        <ActionButtonGroup>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleViewDetails(row)}
            className="gap-1"
          >
            <Eye className="h-3 w-3" />
            Details
          </Button>
          <ViewButton onClick={() => handleViewProfile(row)} />
          {canManageTeachers && <AssignButton onClick={() => handleAssignClass(row)} />}
        </ActionButtonGroup>
      ),
    },
  ];

  if (loading) {
    return (
      <RouteMeta title="Teachers management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Teachers management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Teachers management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage teachers, assign classes and subjects, view qualifications and reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageTeachers && (
              <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create Teacher
              </Button>
            )}
            {canManageTeachers && (
              <Button variant="outline" onClick={() => setShowImportModal(true)} className="gap-2">
                <Upload className="h-4 w-4" />
                Import CSV
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setShowActivityLog(!showActivityLog)}
              className="gap-2"
            >
              Activity Log
            </Button>
            <ExportButtons
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
            />
            {canManageTeachers && selectedRows.size > 0 && (
              <Button variant="outline" onClick={handleBulkDelete}>
                Delete ({selectedRows.size})
              </Button>
            )}
          </div>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        {/* Advanced Filters */}
        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm"
          aria-label="Filters"
        >
          <AdvancedFilters
            fields={advancedFilterFields}
            filters={{
              search: filters.search,
              classId: filters.classId,
              subjectId: filters.subjectId,
            }}
            onFiltersChange={(newFilters) => {
              setFilters({
                search: newFilters.search || '',
                classId: newFilters.classId || 'all',
                subjectId: newFilters.subjectId || 'all',
              });
            }}
            onReset={() => setFilters(defaultFilters)}
            searchPlaceholder="Search by name, email, subject, class..."
          />
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredTeachers.length} of {teachers.length} teachers
            </span>
          </div>
        </section>

        {/* Activity Log */}
        {showActivityLog && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
            <ActivityLog entityType="teacher" limit={10} />
          </section>
        )}

        {filteredTeachers.length === 0 && teachers.length === 0 ? (
          <EmptyState type="teachers" onAction={() => setShowCreateModal(true)} />
        ) : filteredTeachers.length === 0 ? (
          <EmptyState
            type="generic"
            title="No teachers found"
            description="No teachers match your current filters. Try adjusting your search or filter criteria."
            onAction={() => setFilters(defaultFilters)}
            actionLabel="Clear Filters"
          />
        ) : (
          <PaginatedTable
            columns={teacherColumns}
            data={filteredTeachers}
            caption="Teachers"
            emptyMessage="No teachers found matching the current filters."
          />
        )}

        {showProfileModal && selectedTeacher && (
          <Modal
            title={`Teacher profile: ${selectedTeacher.name}`}
            isOpen={showProfileModal}
            onClose={() => {
              setShowProfileModal(false);
              setSelectedTeacher(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedTeacher.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Email</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedTeacher.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTeacher.subjects.length > 0 ? (
                      selectedTeacher.subjects.map((subject) => (
                        <span
                          key={subject}
                          className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs text-[var(--brand-primary)]"
                        >
                          {subject}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--brand-muted)]">
                        No subjects assigned
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Classes</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedTeacher.assigned_classes.length > 0 ? (
                      selectedTeacher.assigned_classes.map((className) => (
                        <span
                          key={className}
                          className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
                        >
                          {className}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-[var(--brand-muted)]">No classes assigned</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowProfileModal(false)}>
                  Close
                </Button>
                <Button
                  onClick={() =>
                    navigate(`/dashboard/teacher/profile?teacherId=${selectedTeacher.id}`)
                  }
                >
                  View full profile
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showAssignmentModal && selectedTeacher && (
          <FormModal
            title={`Assign class/subject: ${selectedTeacher.name}`}
            isOpen={showAssignmentModal}
            onClose={() => {
              setShowAssignmentModal(false);
              setSelectedTeacher(null);
              setSelectedClass('');
              setSelectedSubject('');
              setIsClassTeacher(false);
            }}
            mutation={updateTeacherMutation}
            variables={getAssignmentMutationVariables()}
            invalidateQueries={[queryKeys.admin.teachers()] as unknown as unknown[][]}
            messages={{
              pending: 'Assigning class/subject...',
              success: 'Assignment saved successfully',
              error: 'Failed to save assignment',
            }}
            saveLabel="Assign"
            onSuccess={handleAssignmentSuccess}
          >
            <div className="space-y-4">
              <Select
                label="Class"
                required
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                options={[
                  { label: 'Select a class', value: '' },
                  ...classes.map((c) => ({ label: c.name, value: c.id })),
                ]}
              />
              <Select
                label="Subject"
                required
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                options={[
                  { label: 'Select a subject', value: '' },
                  ...subjects.map((s) => ({ label: s.name, value: s.id })),
                ]}
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isClassTeacher"
                  checked={isClassTeacher}
                  onChange={(e) => setIsClassTeacher(e.target.checked)}
                  className="rounded border-[var(--brand-border)]"
                />
                <label
                  htmlFor="isClassTeacher"
                  className="text-sm text-[var(--brand-surface-contrast)]"
                >
                  Assign as class teacher
                </label>
              </div>
            </div>
          </FormModal>
        )}

        {showCreateModal && (
          <AdminUserRegistrationModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              // Invalidate teachers query to refresh the list
              queryClient.invalidateQueries({ queryKey: queryKeys.admin.teachers() });
            }}
          />
        )}

        {showImportModal && (
          <CSVImportModal
            isOpen={showImportModal}
            onClose={() => setShowImportModal(false)}
            onImport={async (file) => {
              const result = await csvImportMutation.mutateAsync(file);
              return result;
            }}
            entityType="teachers"
            acceptedColumns={[
              'email',
              'fullName',
              'password',
              'phone',
              'qualifications',
              'yearsOfExperience',
              'subjects',
            ]}
          />
        )}

        {showDetailModal && selectedTeacherId && (
          <Modal
            title="Teacher Details"
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedTeacherId(null);
            }}
          >
            <div className="max-h-[80vh] overflow-y-auto">
              <TeacherDetailView
                teacherId={selectedTeacherId}
                onClose={() => {
                  setShowDetailModal(false);
                  setSelectedTeacherId(null);
                }}
              />
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default TeachersManagementPage;
