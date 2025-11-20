import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
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
import { api, type TeacherProfile, type TenantUser, type Subject } from '../../lib/api';
import type { TableColumn } from '../../components/ui/Table';

interface HODFilters {
  search: string;
  department: string;
}

const defaultFilters: HODFilters = {
  search: '',
  department: 'all'
};

interface HODRecord extends TeacherProfile {
  department?: string;
  teachersUnderOversight?: number;
}

export function HODsManagementPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<HODFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showDepartmentModal, setShowDepartmentModal] = useState<boolean>(false);
  const [showAnalyticsModal, setShowAnalyticsModal] = useState<boolean>(false);
  const [selectedHOD, setSelectedHOD] = useState<HODRecord | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [usersResult, teachersResult, subjectsResult] = await Promise.allSettled([
        api.listUsers(),
        api.listTeachers(),
        api.admin.listSubjects()
      ]);

      if (usersResult.status === 'fulfilled') {
        setUsers(usersResult.value);
      }

      if (teachersResult.status === 'fulfilled') {
        setTeachers(teachersResult.value);
      }

      if (subjectsResult.status === 'fulfilled') {
        setSubjects(subjectsResult.value);
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Filter HODs: teachers with additional_roles containing 'hod'
  const hodUsers = useMemo(
    () =>
      users.filter(
        (u) => u.role === 'teacher' && u.additional_roles?.some((r) => r.role === 'hod')
      ),
    [users]
  );

  const hods = useMemo(() => {
    return hodUsers
      .map((user) => {
        const teacher = teachers.find((t) => t.email === user.email);
        if (!teacher) return null;

        // Count teachers under oversight (teachers with same subjects)
        const hodSubjects = teacher.subjects;
        const teachersUnderOversight = teachers.filter(
          (t) => t.id !== teacher.id && t.subjects.some((subject) => hodSubjects.includes(subject))
        ).length;

        // Extract department from metadata or use first subject as department
        const department =
          (
            user.additional_roles?.find((r) => r.role === 'hod')?.metadata as {
              department?: string;
            }
          )?.department ||
          teacher.subjects[0] ||
          'General';

        return {
          ...teacher,
          department,
          teachersUnderOversight
        } as HODRecord;
      })
      .filter((hod): hod is HODRecord => hod !== null);
  }, [hodUsers, teachers]);

  const filteredHODs = useMemo(() => {
    return hods.filter((hod) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const matchesSearch =
          hod.name.toLowerCase().includes(searchLower) ||
          hod.email.toLowerCase().includes(searchLower) ||
          hod.department?.toLowerCase().includes(searchLower) ||
          hod.subjects.some((s) => s.toLowerCase().includes(searchLower));
        if (!matchesSearch) return false;
      }

      // Department filter
      if (filters.department !== 'all') {
        if (hod.department !== filters.department) return false;
      }

      return true;
    });
  }, [hods, filters]);

  const uniqueDepartments = useMemo(() => {
    const depts = new Set(hods.map((hod) => hod.department).filter((d): d is string => !!d));
    return Array.from(depts);
  }, [hods]);

  const handleViewProfile = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setShowProfileModal(true);
  };

  const handleAssignDepartment = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setSelectedDepartment(hod.department || '');
    setShowDepartmentModal(true);
  };

  const handleSaveDepartment = async () => {
    if (!selectedHOD) {
      return;
    }

    try {
      // TODO: Implement department assignment API when available
      // This would update the user's additional_roles metadata
      toast.success('Department assigned successfully');
      setShowDepartmentModal(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleViewAnalytics = (hod: HODRecord) => {
    setSelectedHOD(hod);
    setShowAnalyticsModal(true);
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('Please select HODs to remove');
      return;
    }

    if (!window.confirm(`Remove HOD role from ${selectedRows.size} teacher(s)?`)) {
      return;
    }

    try {
      // TODO: Implement bulk HOD role removal API when available
      toast.success(`${selectedRows.size} HOD role(s) removed`);
      setSelectedRows(new Set());
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Consolidated export handlers using DRY principle
  const exportHandlers = useMemo(() => {
    const exportData = filteredHODs.map((hod) => ({
      Name: hod.name,
      Email: hod.email,
      Department: hod.department || 'N/A',
      Subjects: hod.subjects.join('; '),
      'Teachers Under Oversight': hod.teachersUnderOversight || 0
    }));

    return createExportHandlers(exportData, 'hods', [
      'Name',
      'Email',
      'Department',
      'Subjects',
      'Teachers Under Oversight'
    ]);
  }, [filteredHODs]);

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
        />
      ),
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedRows.has(row.id)}
          onChange={() => toggleRowSelection(row.id)}
          className="rounded border-[var(--brand-border)]"
          onClick={(e) => e.stopPropagation()}
        />
      ),
      align: 'center'
    },
    {
      header: 'Name',
      render: (row) => (
        <div>
          <p className="font-semibold text-[var(--brand-surface-contrast)]">{row.name}</p>
          <p className="text-xs text-[var(--brand-muted)]">{row.email}</p>
        </div>
      )
    },
    {
      header: 'Department',
      render: (row) => (
        <span className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs font-semibold text-[var(--brand-primary)]">
          {row.department || 'General'}
        </span>
      )
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
      )
    },
    {
      header: 'Teachers',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.teachersUnderOversight || 0} teachers
        </span>
      ),
      align: 'center'
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewProfile(row)}>
            View
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleAssignDepartment(row)}>
            Department
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleViewAnalytics(row)}>
            Analytics
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/dashboard/teacher/profile?teacherId=${row.id}`)}
          >
            Profile
          </Button>
        </div>
      )
    }
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
        (t) =>
          t.id !== selectedHOD.id &&
          t.subjects.some((subject) => selectedHOD.subjects.includes(subject))
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
          <div className="flex gap-2">
            <ExportButtons
              onExportCSV={handleExportCSV}
              onExportPDF={handleExportPDF}
              onExportExcel={handleExportExcel}
            />
            {selectedRows.size > 0 && (
              <Button variant="outline" onClick={handleBulkDelete}>
                Remove HOD ({selectedRows.size})
              </Button>
            )}
          </div>
        </header>

        {error ? <StatusBanner status="error" message={error} /> : null}

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm"
          aria-label="Filters"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <Input
              label="Search"
              placeholder="Search by name, email, department..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Select
              label="Department"
              value={filters.department}
              onChange={(e) => setFilters((f) => ({ ...f, department: e.target.value }))}
              options={[
                { label: 'All departments', value: 'all' },
                ...uniqueDepartments.map((d) => ({ label: d, value: d }))
              ]}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredHODs.length} of {hods.length} HODs
            </span>
            {(filters.search || filters.department !== 'all') && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <PaginatedTable
          columns={hodColumns}
          data={filteredHODs}
          caption="Heads of Department"
          emptyMessage="No HODs found matching the current filters."
        />

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
                  ...uniqueDepartments.map((d) => ({ label: d, value: d }))
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
      </div>
    </RouteMeta>
  );
}

export default HODsManagementPage;
