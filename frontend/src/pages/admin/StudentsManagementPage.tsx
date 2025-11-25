import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RouteMeta } from '../../components/layout/RouteMeta';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { PaginatedTable } from '../../components/admin/PaginatedTable';
import { ExportButtons } from '../../components/admin/ExportButtons';
import { createExportHandlers } from '../../hooks/useExport';
import { useQueryClient } from '@tanstack/react-query';
import {
  useStudents,
  useUpdateStudent,
  useBulkDeleteStudents,
} from '../../hooks/queries/useStudents';
import { useClasses } from '../../hooks/queries/useClasses';
import { useDebounce } from '../../hooks/useDebounce';
import { queryKeys } from '../../hooks/useQuery';
import { type StudentRecord } from '../../lib/api';
import type { TableColumn } from '../../components/ui/Table';
import { ViewButton, AssignButton, ActionButtonGroup } from '../../components/table-actions';
import { FormModal } from '../../components/shared';
import { AdminUserRegistrationModal } from '../../components/admin/AdminUserRegistrationModal';
import { EmptyState } from '../../components/admin/EmptyState';
import { CSVImportModal } from '../../components/admin/CSVImportModal';
import { AdvancedFilters, type AdvancedFilterField } from '../../components/admin/AdvancedFilters';
import { ActivityLog } from '../../components/admin/ActivityLog';
import { StudentDetailView } from '../../components/admin/StudentDetailView';
import { useCSVImport } from '../../hooks/useCSVImport';
import { Plus, Upload, Eye } from 'lucide-react';

interface StudentFilters {
  search: string;
  classId: string;
  enrollmentStatus: string;
}

const defaultFilters: StudentFilters = {
  search: '',
  classId: 'all',
  enrollmentStatus: 'all',
};

export function StudentsManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<StudentFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [showParentModal, setShowParentModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showActivityLog, setShowActivityLog] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [parentName, setParentName] = useState<string>('');
  const [parentContact, setParentContact] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // CSV Import
  const csvImportMutation = useCSVImport({
    entityType: 'students',
    invalidateQueries: [[...queryKeys.admin.students()]] as unknown as unknown[][],
  });

  // Debounce search filter to prevent excessive API calls
  const debouncedSearch = useDebounce(filters.search, 500);

  // Build API filters
  const apiFilters = useMemo(() => {
    const result: { classId?: string; enrollmentStatus?: string; search?: string } = {};
    if (filters.classId !== 'all') {
      result.classId = filters.classId;
    }
    if (filters.enrollmentStatus !== 'all') {
      result.enrollmentStatus = filters.enrollmentStatus;
    }
    if (debouncedSearch) {
      result.search = debouncedSearch;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }, [filters.classId, filters.enrollmentStatus, debouncedSearch]);

  // Fetch data using React Query hooks
  const {
    data: students = [],
    isLoading: studentsLoading,
    error: studentsError,
  } = useStudents(apiFilters);
  const { data: classes = [], isLoading: classesLoading } = useClasses();

  // Advanced filter fields (defined after classes is fetched)
  const advancedFilterFields: AdvancedFilterField[] = useMemo(
    () => [
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
        key: 'enrollmentStatus',
        label: 'Enrollment Status',
        type: 'select',
        options: [
          { label: 'All statuses', value: 'all' },
          { label: 'Active', value: 'active' },
          { label: 'Graduated', value: 'graduated' },
          { label: 'Transferred', value: 'transferred' },
          { label: 'Suspended', value: 'suspended' },
          { label: 'Withdrawn', value: 'withdrawn' },
        ],
      },
    ],
    [classes]
  );

  // Mutations
  const updateStudentMutation = useUpdateStudent();
  const bulkDeleteMutation = useBulkDeleteStudents();

  const loading = studentsLoading || classesLoading;
  const error = studentsError ? (studentsError as Error).message : null;

  // Client-side filtering (for any additional filtering not handled by backend)
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Enrollment status filter (now handled by backend, but keep for client-side fallback)
      if (filters.enrollmentStatus !== 'all') {
        if (student.enrollment_status !== filters.enrollmentStatus) {
          return false;
        }
      }
      return true;
    });
  }, [students, filters.enrollmentStatus]);

  const handleViewProfile = (student: StudentRecord) => {
    setSelectedStudent(student);
    setSelectedStudentId(student.id);
    setShowProfileModal(true);
  };

  const handleViewDetails = (student: StudentRecord) => {
    setSelectedStudentId(student.id);
    setShowDetailModal(true);
  };

  const handleAssignClass = (student: StudentRecord) => {
    setSelectedStudent(student);
    setSelectedClass(student.class_id || '');
    setShowClassModal(true);
  };

  const handleManageParent = (student: StudentRecord) => {
    setSelectedStudent(student);

    // Get parent contacts from current student data
    const rawStudent = students.find((s) => s.id === student.id);
    if (
      rawStudent &&
      Array.isArray(rawStudent.parent_contacts) &&
      rawStudent.parent_contacts.length > 0
    ) {
      const firstParent = rawStudent.parent_contacts[0];
      setParentName(firstParent.name || '');
      setParentContact(firstParent.phone || firstParent.relationship || '');
    } else {
      setParentName('');
      setParentContact('');
    }
    setShowParentModal(true);
  };

  const getParentMutationVariables = ():
    | {
        id: string;
        data: { parentContacts: Array<{ name: string; relationship: string; phone: string }> };
      }
    | undefined => {
    if (!selectedStudent || !parentName || !parentContact) {
      return undefined;
    }

    const existingStudent = students.find((s) => s.id === selectedStudent.id);
    const existingContacts = Array.isArray(existingStudent?.parent_contacts)
      ? existingStudent.parent_contacts
      : [];

    const updatedContacts = [
      ...existingContacts.filter((c) => c.name !== parentName),
      { name: parentName, relationship: 'Parent', phone: parentContact },
    ];

    return {
      id: selectedStudent.id,
      data: { parentContacts: updatedContacts },
    };
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      return;
    }

    if (!window.confirm(`Delete ${selectedRows.size} student(s)? This action cannot be undone.`)) {
      return;
    }

    bulkDeleteMutation.mutate(Array.from(selectedRows), {
      onSuccess: () => {
        setSelectedRows(new Set());
      },
    });
  };

  // Consolidated export handlers using DRY principle
  const exportHandlers = useMemo(() => {
    const exportData = filteredStudents.map((s) => ({
      'First Name': s.first_name,
      'Last Name': s.last_name,
      'Admission Number': s.admission_number || 'N/A',
      Class: s.class_id || 'N/A',
      'Enrollment Status': s.enrollment_status || 'active',
    }));

    const handlers = createExportHandlers(exportData, 'students', [
      'First Name',
      'Last Name',
      'Admission Number',
      'Class',
      'Enrollment Status',
    ]);

    // For PDF/Excel, use backend endpoint with filters
    const exportPayload = {
      type: 'students' as const,
      title: 'Students Export',
      filters: {
        classId: filters.classId !== 'all' ? filters.classId : undefined,
        enrollmentStatus: filters.enrollmentStatus !== 'all' ? filters.enrollmentStatus : undefined,
        search: filters.search || undefined,
      },
    };

    return {
      ...handlers,
      exportPDF: () => handlers.exportPDF('/reports/export', exportPayload),
      exportExcel: () => handlers.exportExcel('/reports/export', exportPayload),
    };
  }, [filteredStudents, filters]);

  const handleExportCSV = exportHandlers.exportCSV;
  const handleExportPDF = exportHandlers.exportPDF;
  const handleExportExcel = exportHandlers.exportExcel;

  const toggleRowSelection = (studentId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) {
        next.delete(studentId);
      } else {
        next.add(studentId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredStudents.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const studentColumns: TableColumn<StudentRecord>[] = [
    {
      header: (
        <input
          type="checkbox"
          checked={selectedRows.size === filteredStudents.length && filteredStudents.length > 0}
          onChange={toggleAllSelection}
          className="rounded border-[var(--brand-border)]"
          aria-label="Select all students"
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedRows.has(row.id)}
          onChange={() => toggleRowSelection(row.id)}
          className="rounded border-[var(--brand-border)]"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Select ${row.first_name} ${row.last_name}`}
        />
      ),
      align: 'center',
    },
    {
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--brand-surface-contrast)]">
            {row.first_name} {row.last_name}
          </p>
          {row.admission_number && (
            <p className="text-xs text-[var(--brand-muted)]">#{row.admission_number}</p>
          )}
        </div>
      ),
    },
    {
      header: 'Class',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.class_id || 'Not assigned'}
        </span>
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
          <AssignButton onClick={() => handleAssignClass(row)} label="Assign Class" />
          <Button size="sm" variant="ghost" onClick={() => handleManageParent(row)}>
            Parent
          </Button>
        </ActionButtonGroup>
      ),
    },
  ];

  if (loading) {
    return (
      <RouteMeta title="Students management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Students management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Students management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage students, assign classes, manage parent/guardian information, and view academic
              history.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCreateModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Student
            </Button>
            <Button variant="outline" onClick={() => setShowImportModal(true)} className="gap-2">
              <Upload className="h-4 w-4" />
              Import CSV
            </Button>
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
            {selectedRows.size > 0 && (
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
              enrollmentStatus: filters.enrollmentStatus,
            }}
            onFiltersChange={(newFilters) => {
              setFilters({
                search: newFilters.search || '',
                classId: newFilters.classId || 'all',
                enrollmentStatus: newFilters.enrollmentStatus || 'all',
              });
            }}
            onReset={() => setFilters(defaultFilters)}
            searchPlaceholder="Search by name, admission number, class..."
          />
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredStudents.length} of {students.length} students
            </span>
          </div>
        </section>

        {/* Activity Log */}
        {showActivityLog && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
            <ActivityLog entityType="student" limit={10} />
          </section>
        )}

        {filteredStudents.length === 0 && students.length === 0 ? (
          <EmptyState type="students" onAction={() => setShowCreateModal(true)} />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            type="generic"
            title="No students found"
            description="No students match your current filters. Try adjusting your search or filter criteria."
            onAction={() => setFilters(defaultFilters)}
            actionLabel="Clear Filters"
          />
        ) : (
          <PaginatedTable
            columns={studentColumns}
            data={filteredStudents}
            caption="Students"
            emptyMessage="No students found matching the current filters."
          />
        )}

        {showProfileModal && selectedStudent && (
          <Modal
            title={`Student profile: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showProfileModal}
            onClose={() => {
              setShowProfileModal(false);
              setSelectedStudent(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedStudent.first_name} {selectedStudent.last_name}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                    Admission Number
                  </p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedStudent.admission_number || 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Class</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedStudent.class_id || 'Not assigned'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                    Parent/Guardian
                  </p>
                  <div className="text-sm text-[var(--brand-surface-contrast)]">
                    {Array.isArray(selectedStudent.parent_contacts) &&
                    selectedStudent.parent_contacts.length > 0 ? (
                      selectedStudent.parent_contacts.map((parent: unknown, idx: number) => {
                        const p = parent as {
                          name?: string;
                          phone?: string;
                          relationship?: string;
                        };
                        return (
                          <div key={idx}>
                            {p.name} {p.relationship ? `(${p.relationship})` : ''} -{' '}
                            {p.phone || 'No contact'}
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-[var(--brand-muted)]">No parent information</span>
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
                    navigate(`/dashboard/student/profile?studentId=${selectedStudent.id}`)
                  }
                >
                  View full profile
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showClassModal && selectedStudent && (
          <FormModal
            title={`Assign class: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showClassModal}
            onClose={() => {
              setShowClassModal(false);
              setSelectedStudent(null);
              setSelectedClass('');
            }}
            mutation={updateStudentMutation}
            variables={
              selectedClass
                ? {
                    id: selectedStudent.id,
                    data: { classId: selectedClass },
                  }
                : undefined
            }
            invalidateQueries={[queryKeys.admin.students()] as unknown as unknown[][]}
            messages={{
              pending: 'Assigning class...',
              success: 'Class assigned successfully',
              error: 'Failed to assign class',
            }}
            saveLabel="Assign"
            onSuccess={() => {
              setSelectedClass('');
            }}
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
            </div>
          </FormModal>
        )}

        {showParentModal && selectedStudent && (
          <FormModal
            title={`Parent/Guardian: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showParentModal}
            onClose={() => {
              setShowParentModal(false);
              setSelectedStudent(null);
              setParentName('');
              setParentContact('');
            }}
            mutation={updateStudentMutation}
            variables={getParentMutationVariables()}
            invalidateQueries={[queryKeys.admin.students()] as unknown as unknown[][]}
            messages={{
              pending: 'Saving parent information...',
              success: 'Parent information saved successfully',
              error: 'Failed to save parent information',
            }}
            onSuccess={() => {
              setParentName('');
              setParentContact('');
            }}
          >
            <div className="space-y-4">
              <Input
                label="Parent/Guardian name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                required
              />
              <Input
                label="Contact information"
                value={parentContact}
                onChange={(e) => setParentContact(e.target.value)}
                placeholder="Phone or email"
                required
              />
            </div>
          </FormModal>
        )}

        {showCreateModal && (
          <AdminUserRegistrationModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              // Invalidate students query to refresh the list
              queryClient.invalidateQueries({ queryKey: queryKeys.admin.students() });
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
            entityType="students"
            acceptedColumns={[
              'email',
              'fullName',
              'password',
              'dateOfBirth',
              'classId',
              'studentId',
              'parentGuardianName',
              'parentGuardianContact',
            ]}
          />
        )}

        {showDetailModal && selectedStudentId && (
          <Modal
            title="Student Details"
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedStudentId(null);
            }}
          >
            <div className="max-h-[80vh] overflow-y-auto">
              <StudentDetailView
                studentId={selectedStudentId}
                onClose={() => {
                  setShowDetailModal(false);
                  setSelectedStudentId(null);
                }}
              />
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default StudentsManagementPage;
