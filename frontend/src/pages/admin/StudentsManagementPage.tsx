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
import {
  api,
  type StudentRecord,
  type SchoolClass,
  type StudentProfileDetail
} from '../../lib/api';
import type { TableColumn } from '../../components/ui/Table';

interface StudentFilters {
  search: string;
  classId: string;
  enrollmentStatus: string;
}

const defaultFilters: StudentFilters = {
  search: '',
  classId: 'all',
  enrollmentStatus: 'all'
};

export function StudentsManagementPage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [studentDetails, setStudentDetails] = useState<Map<string, StudentProfileDetail>>(
    new Map()
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StudentFilters>(defaultFilters);
  const [showProfileModal, setShowProfileModal] = useState<boolean>(false);
  const [showClassModal, setShowClassModal] = useState<boolean>(false);
  const [showParentModal, setShowParentModal] = useState<boolean>(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [selectedClass, setSelectedClass] = useState<string>('');
  const [parentName, setParentName] = useState<string>('');
  const [parentContact, setParentContact] = useState<string>('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [studentsResult, classesResult] = await Promise.allSettled([
        api.listStudents(),
        api.listClasses()
      ]);

      if (studentsResult.status === 'fulfilled') {
        setStudents(studentsResult.value);
        // Load details for students (lazy load on demand to avoid too many requests)
        setStudentDetails(new Map());
      } else {
        throw new Error((studentsResult.reason as Error).message || 'Failed to load students');
      }

      if (classesResult.status === 'fulfilled') {
        setClasses(classesResult.value);
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

  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      // Search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        const matchesSearch =
          fullName.includes(searchLower) ||
          student.admission_number?.toLowerCase().includes(searchLower) ||
          student.class_id?.toLowerCase().includes(searchLower);
        if (!matchesSearch) return false;
      }

      // Class filter
      if (filters.classId !== 'all') {
        if (student.class_id !== filters.classId && student.class_uuid !== filters.classId) {
          return false;
        }
      }

      // Enrollment status filter (placeholder - would need backend support)
      if (filters.enrollmentStatus !== 'all') {
        // TODO: Implement enrollment status filtering when backend supports it
      }

      return true;
    });
  }, [students, filters]);

  const handleViewProfile = async (student: StudentRecord) => {
    setSelectedStudent(student);
    // Load full profile if not already loaded
    if (!studentDetails.has(student.id)) {
      try {
        const fullStudent = await api.getStudent(student.id);
        const detail: StudentProfileDetail = {
          id: fullStudent.id,
          firstName: fullStudent.first_name,
          lastName: fullStudent.last_name,
          classId: fullStudent.class_id,
          className: fullStudent.class_id,
          admissionNumber: fullStudent.admission_number,
          parentContacts: Array.isArray(fullStudent.parent_contacts)
            ? fullStudent.parent_contacts.map((p) => ({
                name: p.name,
                contact: p.phone || p.relationship || ''
              }))
            : [],
          subjects: [] // Will be loaded separately if needed
        };
        setStudentDetails((prev) => new Map(prev).set(student.id, detail));
      } catch (err) {
        toast.error((err as Error).message);
      }
    }
    setShowProfileModal(true);
  };

  const handleAssignClass = (student: StudentRecord) => {
    setSelectedStudent(student);
    setSelectedClass(student.class_id || '');
    setShowClassModal(true);
  };

  const handleSaveClassAssignment = async () => {
    if (!selectedStudent || !selectedClass) {
      toast.error('Please select a class');
      return;
    }

    try {
      await api.updateStudent(selectedStudent.id, { classId: selectedClass });
      toast.success('Class assigned successfully');
      setShowClassModal(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleManageParent = async (student: StudentRecord) => {
    setSelectedStudent(student);
    // Load student data if not already loaded
    if (!studentDetails.has(student.id)) {
      try {
        const fullStudent = await api.getStudent(student.id);
        const detail: StudentProfileDetail = {
          id: fullStudent.id,
          firstName: fullStudent.first_name,
          lastName: fullStudent.last_name,
          classId: fullStudent.class_id,
          className: fullStudent.class_id,
          admissionNumber: fullStudent.admission_number,
          parentContacts: Array.isArray(fullStudent.parent_contacts)
            ? fullStudent.parent_contacts.map((p) => ({
                name: p.name,
                contact: p.phone || p.relationship || ''
              }))
            : [],
          subjects: []
        };
        setStudentDetails((prev) => new Map(prev).set(student.id, detail));
      } catch (err) {
        toast.error((err as Error).message);
      }
    }

    const detail = studentDetails.get(student.id);
    const parentContacts = detail?.parentContacts || [];
    if (Array.isArray(parentContacts) && parentContacts.length > 0) {
      const firstParent = parentContacts[0] as { name?: string; contact?: string };
      setParentName(firstParent.name || '');
      setParentContact(firstParent.contact || '');
    } else {
      // Check if student has parent_contacts in the raw data
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
    }
    setShowParentModal(true);
  };

  const handleSaveParent = async () => {
    if (!selectedStudent || !parentName || !parentContact) {
      toast.error('Please provide parent/guardian name and contact');
      return;
    }

    try {
      const existingStudent = students.find((s) => s.id === selectedStudent.id);
      const existingContacts = Array.isArray(existingStudent?.parent_contacts)
        ? existingStudent.parent_contacts
        : [];

      const updatedContacts = [
        ...existingContacts.filter((c) => c.name !== parentName),
        { name: parentName, relationship: 'Parent', phone: parentContact }
      ];

      await api.updateStudent(selectedStudent.id, {
        parentContacts: updatedContacts
      });
      toast.success('Parent/guardian information updated');
      setShowParentModal(false);
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRows.size === 0) {
      toast.error('Please select students to delete');
      return;
    }

    if (!window.confirm(`Delete ${selectedRows.size} student(s)?`)) {
      return;
    }

    try {
      const deletePromises = Array.from(selectedRows).map((id) => api.deleteStudent(id));
      await Promise.all(deletePromises);
      toast.success(`${selectedRows.size} student(s) deleted`);
      setSelectedRows(new Set());
      await loadData();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Consolidated export handlers using DRY principle
  const exportHandlers = useMemo(() => {
    const exportData = filteredStudents.map((s) => ({
      'First Name': s.first_name,
      'Last Name': s.last_name,
      'Admission Number': s.admission_number || 'N/A',
      Class: s.class_id || 'N/A'
    }));

    return createExportHandlers(exportData, 'students', [
      'First Name',
      'Last Name',
      'Admission Number',
      'Class'
    ]);
  }, [filteredStudents]);

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
          <p className="font-semibold text-[var(--brand-surface-contrast)]">
            {row.first_name} {row.last_name}
          </p>
          {row.admission_number && (
            <p className="text-xs text-[var(--brand-muted)]">#{row.admission_number}</p>
          )}
        </div>
      )
    },
    {
      header: 'Class',
      render: (row) => (
        <span className="text-sm text-[var(--brand-surface-contrast)]">
          {row.class_id || 'Not assigned'}
        </span>
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
            Assign Class
          </Button>
          <Button size="sm" variant="ghost" onClick={() => handleManageParent(row)}>
            Parent
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => navigate(`/dashboard/student/profile?studentId=${row.id}`)}
          >
            Profile
          </Button>
        </div>
      )
    }
  ];

  if (loading) {
    return (
      <RouteMeta title="Students management">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  const selectedStudentDetail = selectedStudent ? studentDetails.get(selectedStudent.id) : null;

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
              placeholder="Search by name, admission number, class..."
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
              label="Enrollment status"
              value={filters.enrollmentStatus}
              onChange={(e) => setFilters((f) => ({ ...f, enrollmentStatus: e.target.value }))}
              options={[
                { label: 'All statuses', value: 'all' },
                { label: 'Active', value: 'active' },
                { label: 'Graduated', value: 'graduated' },
                { label: 'Transferred', value: 'transferred' }
              ]}
            />
          </div>
          <div className="mt-4 flex items-center justify-between text-sm text-[var(--brand-muted)]">
            <span>
              Showing {filteredStudents.length} of {students.length} students
            </span>
            {(filters.search ||
              filters.classId !== 'all' ||
              filters.enrollmentStatus !== 'all') && (
              <Button size="sm" variant="ghost" onClick={() => setFilters(defaultFilters)}>
                Clear filters
              </Button>
            )}
          </div>
        </section>

        <PaginatedTable
          columns={studentColumns}
          data={filteredStudents}
          caption="Students"
          emptyMessage="No students found matching the current filters."
        />

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
                    {selectedStudentDetail?.className || selectedStudent.class_id || 'Not assigned'}
                  </p>
                </div>
                {selectedStudentDetail && (
                  <>
                    <div>
                      <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">Subjects</p>
                      <div className="flex flex-wrap gap-1">
                        {selectedStudentDetail.subjects.length > 0 ? (
                          selectedStudentDetail.subjects.map((subject) => (
                            <span
                              key={subject.subjectId}
                              className="rounded-full bg-[var(--brand-primary)]/20 px-2 py-1 text-xs text-[var(--brand-primary)]"
                            >
                              {subject.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-[var(--brand-muted)]">No subjects</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-[var(--brand-muted)] mb-1">
                        Parent/Guardian
                      </p>
                      <div className="text-sm text-[var(--brand-surface-contrast)]">
                        {Array.isArray(selectedStudentDetail.parentContacts) &&
                        selectedStudentDetail.parentContacts.length > 0 ? (
                          selectedStudentDetail.parentContacts.map(
                            (parent: unknown, idx: number) => {
                              const p = parent as { name?: string; contact?: string };
                              return (
                                <div key={idx}>
                                  {p.name} - {p.contact}
                                </div>
                              );
                            }
                          )
                        ) : (
                          <span className="text-[var(--brand-muted)]">No parent information</span>
                        )}
                      </div>
                    </div>
                  </>
                )}
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
          <Modal
            title={`Assign class: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showClassModal}
            onClose={() => {
              setShowClassModal(false);
              setSelectedStudent(null);
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
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowClassModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveClassAssignment}>Assign</Button>
              </div>
            </div>
          </Modal>
        )}

        {showParentModal && selectedStudent && (
          <Modal
            title={`Parent/Guardian: ${selectedStudent.first_name} ${selectedStudent.last_name}`}
            isOpen={showParentModal}
            onClose={() => {
              setShowParentModal(false);
              setSelectedStudent(null);
            }}
          >
            <div className="space-y-4">
              <Input
                label="Parent/Guardian name"
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
              />
              <Input
                label="Contact information"
                value={parentContact}
                onChange={(e) => setParentContact(e.target.value)}
                placeholder="Phone or email"
              />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="ghost" onClick={() => setShowParentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveParent}>Save</Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}

export default StudentsManagementPage;
