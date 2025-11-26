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
import {
  useHODs,
  useAssignHODDepartment,
  useBulkRemoveHODRoles,
} from '../../hooks/queries/useHODs';
import { useTeachers } from '../../hooks/queries/useTeachers';
import { useDebounce } from '../../hooks/useDebounce';
import { useQuery } from '../../hooks/useQuery';
import { queryKeys } from '../../hooks/useQuery';
import { api, type TeacherProfile } from '../../lib/api';
import type { TableColumn } from '../../components/ui/Table';
import { AdminUserRegistrationModal } from '../../components/admin/AdminUserRegistrationModal';
import { EmptyState } from '../../components/admin/EmptyState';
import { CSVImportModal } from '../../components/admin/CSVImportModal';
import { AdvancedFilters, type AdvancedFilterField } from '../../components/admin/AdvancedFilters';
import { ActivityLog } from '../../components/admin/ActivityLog';
import { HODDetailView } from '../../components/admin/HODDetailView';
import { useCSVImport } from '../../hooks/useCSVImport';
import { usePermission } from '../../hooks/usePermission';
import { ViewButton, ActionButtonGroup } from '../../components/table-actions';
import { Plus, Upload, Eye } from 'lucide-react';

interface HODFilters {
  search: string;
  department: string;
}

const defaultFilters: HODFilters = {
  search: '',
  department: 'all',
};

interface HODRecord extends TeacherProfile {
  department?: string;
  teachersUnderOversight?: number;
}

export function HODsManagementPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<HODFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState<boolean>(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showImportModal, setShowImportModal] = useState<boolean>(false);
  const [showActivityLog, setShowActivityLog] = useState<boolean>(false);
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [selectedHOD, setSelectedHOD] = useState<HODRecord | null>(null);
  const [selectedHODId, setSelectedHODId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  // CSV Import
  const csvImportMutation = useCSVImport({
    entityType: 'hods',
    invalidateQueries: [
      [...queryKeys.admin.hods()],
      [...queryKeys.admin.teachers()],
    ] as unknown as unknown[][],
  });

  // Debounce search filter to prevent excessive API calls
  const debouncedSearch = useDebounce(filters.search, 500);

  // Build API filters
  const apiFilters = useMemo(() => {
    const result: { search?: string; department?: string } = {};
    if (debouncedSearch) {
      result.search = debouncedSearch;
    }
    if (filters.department && filters.department !== 'all') {
      result.department = filters.department;
    }
    return Object.keys(result).length > 0 ? result : undefined;
  }, [debouncedSearch, filters.department]);

  // Fetch data using React Query hooks
  const { data: filteredHODs = [], isLoading: hodsLoading, error: hodsError } = useHODs(apiFilters);
  const { data: subjects = [], isLoading: subjectsLoading } = useQuery(
    queryKeys.admin.subjects(),
    () => api.admin.listSubjects(),
    { staleTime: 60000 }
  );
  const { data: teachersData = [] } = useTeachers();
  const teachers = useMemo(() => teachersData || [], [teachersData]);

  // Mutations
  const assignDepartmentMutation = useAssignHODDepartment();
  const bulkRemoveMutation = useBulkRemoveHODRoles();

  // RBAC: Check permissions for UI controls
  const canManageUsers = usePermission('users:manage');
  const canManageTeachers = usePermission('teachers:manage');

  const loading = hodsLoading || subjectsLoading;
  const error = hodsError ? (hodsError as Error).message : null;

  // Optimize: Use reduce instead of map().filter() for better performance
  const uniqueDepartments = useMemo(() => {
    const depts = new Set<string>();
    for (const hod of filteredHODs) {
      if (hod.department) {
        depts.add(hod.department);
      }
    }
    return Array.from(depts);
  }, [filteredHODs]);

  // Advanced filter fields (defined after uniqueDepartments)
  const advancedFilterFields: AdvancedFilterField[] = useMemo(
    () => [
      {
        key: 'department',
        label: 'Department',
        type: 'select',
        options: [
          { label: 'All departments', value: 'all' },
          ...uniqueDepartments.map((d) => ({ label: d, value: d })),
        ],
      },
    ],
    [uniqueDepartments]
  );

  const handleViewProfile = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setSelectedHODId(hod.id);
    setShowProfileModal(true);
  };

  const handleViewDetails = (hod: HODRecord) => {
    setSelectedHODId(hod.id);
    setShowDetailModal(true);
  };

  const handleAssignDepartment = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setSelectedDepartment(hod.department || '');
    setShowDepartmentModal(true);
  };

  const handleSaveDepartment = async () => {
    if (!selectedHOD || !selectedDepartment) {
      return;
    }

    assignDepartmentMutation.mutate(
      {
        userId: selectedHOD.id,
        department: selectedDepartment,
      },
      {
        onSuccess: () => {
          setShowDepartmentModal(false);
          setSelectedHOD(null);
          setSelectedDepartment('');
        },
      }
    );
  };

  const handleViewAnalytics = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setShowAnalyticsModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      return;
    }

    if (
      !window.confirm(
        `Remove HOD role from ${selectedRows.size} teacher(s)? This action cannot be undone.`
      )
    ) {
      return;
    }

    bulkRemoveMutation.mutate(Array.from(selectedRows), {
      onSuccess: () => {
        setSelectedRows(new Set());
      },
    });
  };

  // Consolidated export handlers using DRY principle
  const exportHandlers = useMemo(() => {
    const exportData = filteredHODs.map((hod) => ({
      Name: hod.name,
      Email: hod.email,
      Department: hod.department || 'N/A',
      Subjects: hod.subjects.join('; '),
      'Teachers Under Oversight': hod.teachersUnderOversight || 0,
    }));

    const handlers = createExportHandlers(exportData, 'hods', [
      'Name',
      'Email',
      'Department',
      'Subjects',
      'Teachers Under Oversight',
    ]);

    // For PDF/Excel, use backend endpoint with filters
    const exportPayload = {
      type: 'hods' as const,
      title: 'HODs Export',
      filters: {
        search: filters.search || undefined,
      },
    };

    return {
      ...handlers,
      exportPDF: () => handlers.exportPDF('/reports/export', exportPayload),
      exportExcel: () => handlers.exportExcel('/reports/export', exportPayload),
    };
  }, [filteredHODs, filters]);

  const handleExportCSV = exportHandlers.exportCSV;
  const handleExportPDF = exportHandlers.exportPDF;
  const handleExportExcel = exportHandlers.exportExcel;

  const toggleRowSelection = (hodId: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(hodId)) {
        next.delete(hodId);
      } else {
        next.add(hodId);
      }
      return next;
    });
  };

  const toggleAllSelection = () => {
    if (selectedRows.size === filteredHODs.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filteredHODs.map((h) => h.id)));
    }
  };

  const hodColumns: TableColumn<HODRecord>[] = [
    {
      header: (
        <input
          type="checkbox"
          checked={selectedRows.size === filteredHODs.length && filteredHODs.length > 0}
          onChange={toggleAllSelection}
          className="rounded border-[var(--brand-border)]"
          aria-label="Select all HODs"
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
      header: 'Department',
      render: (row) => (
        <span className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs font-semibold text-[var(--brand-primary)]">
          {row.department || 'General'}
        </span>
      ),
    },
    {
      header: 'Subjects',
      render: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.subjects.length > 0 ? (
            row.subjects.slice(0, 3).map((subject) => (
              <span
                key={subject}
                className="rounded-full bg-[var(--brand-accent)]/20 px-2 py-1 text-xs text-[var(--brand-accent)]"
              >
                {subject}
              </span>
            ))
          ) : (
            <span className="text-xs text-[var(--brand-muted)]">No subjects</span>
          )}
          {row.subjects.length > 3 && (
            <span className="text-xs text-[var(--brand-muted)]">
              +{row.subjects.length - 3} more
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Teachers',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.teachersUnderOversight || 0} teachers
        </span>
      ),
      align: 'center',
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
          <Button size="sm" variant="ghost" onClick={() => handleAssignDepartment(row)}>
            Department
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleViewAnalytics(row)}>
            Analytics
          </Button>
        </ActionButtonGroup>
      ),
    },
  ];

  if (loading) {
    return (
      <RouteMeta title="HODs management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  // Get teachers under oversight for selected HOD
  const teachersUnderOversight = selectedHOD
    ? teachers.filter(
        (t: TeacherProfile) =>
          t.id !== selectedHOD.id &&
          t.subjects.some((subject: string) => selectedHOD.subjects.includes(subject))
      )
    : [];

  return (
    <RouteMeta title="HODs management">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              HODs management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage Heads of Department, assign departments, oversee teachers, and view
              department-level analytics.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canManageUsers && canManageTeachers && (
              <Button onClick={() => setShowCreateModal(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Create HOD
              </Button>
            )}
            {canManageUsers && canManageTeachers && (
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
            {canManageUsers && canManageTeachers && selectedRows.size > 0 && (
              <Button variant="outline" onClick={handleBulkDelete}>
                Remove HOD ({selectedRows.size})
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
              department: filters.department,
            }}
            onFiltersChange={(newFilters) => {
              setFilters({
                search: newFilters.search || '',
                department: newFilters.department || 'all',
              });
            }}
            onReset={() => setFilters(defaultFilters)}
            searchPlaceholder="Search by name, email, department..."
          />
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>Showing {filteredHODs.length} HODs</span>
          </div>
        </section>

        {/* Activity Log */}
        {showActivityLog && (
          <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm">
            <ActivityLog entityType="hod" limit={10} />
          </section>
        )}

        {filteredHODs.length === 0 && !hodsLoading ? (
          <EmptyState type="hods" onAction={() => setShowCreateModal(true)} />
        ) : filteredHODs.length === 0 ? (
          <EmptyState
            type="generic"
            title="No HODs found"
            description="No HODs match your current filters. Try adjusting your search or filter criteria."
            onAction={() => setFilters(defaultFilters)}
            actionLabel="Clear Filters"
          />
        ) : (
          <PaginatedTable
            columns={hodColumns}
            data={filteredHODs}
            caption="Heads of Department"
            emptyMessage="No HODs found matching the current filters."
          />
        )}

        {showProfileModal && selectedHOD && (
          <Modal
            title={`HOD profile: ${selectedHOD.name}`}
            isOpen={showProfileModal}
            onClose={() => {
              setShowProfileModal(false);
              setSelectedHOD(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Name</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">{selectedHOD.name}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Email</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedHOD.email}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Department</p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedHOD.department || 'General'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                    Teachers Under Oversight
                  </p>
                  <p className="text-sm text-[var(--brand-surface-contrast)]">
                    {selectedHOD.teachersUnderOversight || 0}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Subjects</p>
                  <div className="flex flex-wrap gap-1">
                    {selectedHOD.subjects.length > 0 ? (
                      selectedHOD.subjects.map((subject) => (
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
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowProfileModal(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => navigate(`/dashboard/teacher/profile?teacherId=${selectedHOD.id}`)}
                >
                  View full profile
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showDepartmentModal && selectedHOD && (
          <Modal
            title={`Assign department: ${selectedHOD.name}`}
            isOpen={showDepartmentModal}
            onClose={() => {
              setShowDepartmentModal(false);
              setSelectedHOD(null);
            }}
          >
            <div className="space-y-4">
              <Select
                label="Department"
                required
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                options={[
                  { label: 'Select a department', value: '' },
                  ...subjects.map((s) => ({ label: s.name, value: s.name })),
                  ...uniqueDepartments.map((d) => ({ label: d, value: d })),
                ]}
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowDepartmentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDepartment}>Assign</Button>
              </div>
            </div>
          </Modal>
        )}

        {showAnalyticsModal && selectedHOD && (
          <Modal
            title={`Department analytics: ${selectedHOD.department || 'General'}`}
            isOpen={showAnalyticsModal}
            onClose={() => {
              setShowAnalyticsModal(false);
              setSelectedHOD(null);
            }}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    Total Teachers
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                    {teachersUnderOversight.length}
                  </p>
                </div>
                <div className="rounded-lg border border-[var(--brand-border)]/60 bg-slate-950/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-[var(--brand-muted)]">
                    Subjects Covered
                  </p>
                  <p className="mt-1 text-2xl font-semibold text-[var(--brand-surface-contrast)]">
                    {selectedHOD.subjects.length}
                  </p>
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-[var(--brand-muted)]">
                  Teachers Under Oversight
                </p>
                <div className="max-h-60 space-y-2 overflow-y-auto">
                  {teachersUnderOversight.length > 0 ? (
                    teachersUnderOversight.map((teacher) => (
                      <div
                        key={teacher.id}
                        className="rounded-md border border-[var(--brand-border)]/60 bg-slate-900/60 px-3 py-2"
                      >
                        <p className="text-sm font-medium text-[var(--brand-surface-contrast)]">
                          {teacher.name}
                        </p>
                        <p className="text-xs text-[var(--brand-muted)]">{teacher.email}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-[var(--brand-muted)]">No teachers under oversight</p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowAnalyticsModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {showCreateModal && (
          <CreateHODModal
            onClose={() => setShowCreateModal(false)}
            onSuccess={() => {
              setShowCreateModal(false);
              // Invalidate HODs, teachers, and users queries to refresh the lists
              queryClient.invalidateQueries({ queryKey: queryKeys.admin.hods() });
              queryClient.invalidateQueries({ queryKey: queryKeys.admin.teachers() });
              // Also invalidate users list to refresh role information
              queryClient.invalidateQueries({ queryKey: ['admin', 'users'] });
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
            entityType="hods"
            acceptedColumns={[
              'email',
              'fullName',
              'password',
              'phone',
              'qualifications',
              'subjects',
              'department',
            ]}
          />
        )}

        {showDetailModal && selectedHODId && (
          <Modal
            title="HOD Details"
            isOpen={showDetailModal}
            onClose={() => {
              setShowDetailModal(false);
              setSelectedHODId(null);
            }}
          >
            <div className="max-h-[80vh] overflow-y-auto">
              <HODDetailView
                hodId={selectedHODId}
                onClose={() => {
                  setShowDetailModal(false);
                  setSelectedHODId(null);
                }}
              />
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default HODsManagementPage;
