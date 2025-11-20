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
import { api, type TeacherProfile, type SchoolClass, type Subject } from '../../lib/api';
import type { TableColumn } from '../../components/ui/Table';

interface TeacherFilters {
  search: string;
  classId: string;
  subjectId: string;
}

const defaultFilters: TeacherFilters = {
  search: '',
  classId: 'all',
  subjectId: 'all'
};

export function TeachersManagementPage() {
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TeacherFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showAssignmentModal, setShowAssignmentModal] = useState<boolean>(false);
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherProfile | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [isClassTeacher, setIsClassTeacher] = useState<boolean>(false);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [teachersResult, classesResult, subjectsResult] = await Promise.allSettled([
        api.listTeachers(),
        api.listClasses(),
        api.admin.listSubjects()
      ]);

      if (teachersResult.status === 'fulfilled') {
        setTeachers(teachersResult.value);
      } else {
        throw new Error((teachersResult.reason as Error).message || 'Failed to load teachers');
      }

      if (classesResult.status === 'fulfilled') {
        setClasses(classesResult.value);
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
    setShowProfileModal(true);
  };

  const handleAssignClass = (teacher: TeacherProfile) => {
    setSelectedTeacher(teacher);
    setSelectedClass('');
    setSelectedSubject('');
    setIsClassTeacher(false);
    setShowAssignmentModal(true);
  };

  const handleSaveAssignment = async () => {
    if (!selectedTeacher || !selectedClass || !selectedSubject) {
      toast.error('Please select class and subject');
      return;
    }

    try {
      // Assign teacher to class/subject via admin API
      await api.admin.assignTeacher(selectedTeacher.id, {
        classId: selectedClass,
        subjectId: selectedSubject,
        isClassTeacher
      });

      // Also update teacher's assigned_classes and subjects arrays
      const updatedClasses = selectedTeacher.assigned_classes.includes(selectedClass)
        ? selectedTeacher.assigned_classes
        : [...selectedTeacher.assigned_classes, selectedClass];

      const updatedSubjects = selectedTeacher.subjects.includes(selectedSubject)
        ? selectedTeacher.subjects
        : [...selectedTeacher.subjects, selectedSubject];

      await api.updateTeacher(selectedTeacher.id, {
        assignedClasses: updatedClasses,
        subjects: updatedSubjects
      });

      toast.success('Teacher assigned successfully');
      setShowAssignmentModal(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('Please select teachers to delete');
      return;
    }

    if (!window.confirm(`Delete ${selectedRows.size} teacher(s)?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedRows).map((id) => api.deleteTeacher(id));
      await Promise.all(deletePromises);
      toast.success(`${selectedRows.size} teacher(s) deleted`);
      setSelectedRows(new Set());
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Consolidated export handlers using DRY principle
  const exportHandlers = useMemo(() => {
    const exportData = filteredTeachers.map((t) => ({
      Name: t.name,
      Email: t.email,
      Subjects: t.subjects.join('; '),
      Classes: t.assigned_classes.join('; ')
    }));

    return createExportHandlers(exportData, 'teachers', ['Name', 'Email', 'Subjects', 'Classes']);
  }, [filteredTeachers]);

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
      )
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
      )
    },
    {
      header: 'Actions',
      render: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => handleViewProfile(row)}>
            View
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleAssignClass(row)}>
            Assign
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
          <div className="flex gap-2">
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

        <section
          className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-4 shadow-sm"
          aria-label="Filters"
        >
          <div className="grid gap-4 md:grid-cols-3">
            <Input
              label="Search"
              placeholder="Search by name, email, subject, class..."
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />
            <Select
              label="Class"
              value={filters.classId}
              onChange={(e) => setFilters((f) => ({ ...f, classId: e.target.value }))}
              options={[
                { label: 'All classes', value: 'all' },
                ...classes.map((c) => ({ label: c.name, value: c.id }))
              ]}
            />
            <Select
              label="Subject"
              value={filters.subjectId}
              onChange={(e) => setFilters((f) => ({ ...f, subjectId: e.target.value }))}
              options={[
                { label: 'All subjects', value: 'all' },
                ...subjects.map((s) => ({ label: s.name, value: s.id }))
              ]}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredTeachers.length} of {teachers.length} teachers
            </span>
            {(filters.search || filters.classId !== 'all' || filters.subjectId !== 'all') && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <PaginatedTable
          columns={teacherColumns}
          data={filteredTeachers}
          caption="Teachers"
          emptyMessage="No teachers found matching the current filters."
        />

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
          <Modal
            title={`Assign class/subject: ${selectedTeacher.name}`}
            isOpen={showAssignmentModal}
            onClose={() => {
              setShowAssignmentModal(false);
              setSelectedTeacher(null);
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
                  ...classes.map((c) => ({ label: c.name, value: c.id }))
                ]}
              />
              <Select
                label="Subject"
                required
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                options={[
                  { label: 'Select a subject', value: '' },
                  ...subjects.map((s) => ({ label: s.name, value: s.id }))
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
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowAssignmentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAssignment}>Assign</Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default TeachersManagementPage;
