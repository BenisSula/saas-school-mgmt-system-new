import React, { useMemo, useState } from 'react';
import { useMutationWithInvalidation, queryKeys } from '../../hooks/useQuery';
import {
  useClasses,
  useStudents,
  useTeachers,
  useSubjects,
} from '../../hooks/queries/useAdminQueries';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import {
  api,
  type StudentRecord,
  type SchoolClass,
  type TeacherProfile,
  type Subject,
} from '../../lib/api';
import RouteMeta from '../../components/layout/RouteMeta';
import { toast } from 'sonner';

interface AssignmentForm {
  studentId?: string;
  teacherId?: string;
  classId: string;
  subjectId?: string;
  isClassTeacher?: boolean;
}

export default function AdminClassAssignmentPage() {
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [showTeacherModal, setShowTeacherModal] = useState(false);
  const [assignmentForm, setAssignmentForm] = useState<AssignmentForm>({
    classId: '',
    isClassTeacher: false,
  });

  const { data: classesData, isLoading: classesLoading } = useClasses();
  const { data: studentsData, isLoading: studentsLoading } = useStudents();
  const { data: teachersData } = useTeachers();
  const { data: subjectsData } = useSubjects();

  const classes = useMemo(() => classesData || [], [classesData]);
  const students = useMemo(() => studentsData || [], [studentsData]);
  const teachers = useMemo(() => teachersData || [], [teachersData]);
  const subjects = useMemo(() => subjectsData || [], [subjectsData]);

  const selectedClass = useMemo(
    () => classes.find((c: SchoolClass) => c.id === selectedClassId),
    [classes, selectedClassId]
  );

  const classStudents = useMemo(
    () =>
      students.filter(
        (s: StudentRecord) => s.class_uuid === selectedClassId || s.class_id === selectedClassId
      ),
    [students, selectedClassId]
  );

  const assignStudentMutation = useMutationWithInvalidation(
    async (payload: { studentId: string; classId: string }) => {
      await api.updateStudent(payload.studentId, { classId: payload.classId });
    },
    [queryKeys.admin.students(), queryKeys.admin.classes()] as unknown as unknown[][],
    { successMessage: 'Student assigned to class successfully' }
  );

  const assignTeacherMutation = useMutationWithInvalidation(
    async (payload: {
      teacherId: string;
      classId: string;
      subjectId: string;
      isClassTeacher: boolean;
    }) => {
      await api.admin.assignTeacher(payload.teacherId, {
        classId: payload.classId,
        subjectId: payload.subjectId,
        isClassTeacher: payload.isClassTeacher,
      });
    },
    [queryKeys.admin.teachers(), queryKeys.admin.classes()] as unknown as unknown[][],
    { successMessage: 'Teacher assigned successfully' }
  );

  const handleAssignStudent = () => {
    if (!assignmentForm.studentId || !assignmentForm.classId) {
      toast.error('Please select both student and class');
      return;
    }
    assignStudentMutation.mutate({
      studentId: assignmentForm.studentId,
      classId: assignmentForm.classId,
    });
    setShowStudentModal(false);
    setAssignmentForm({ classId: '', isClassTeacher: false });
  };

  const handleAssignTeacher = () => {
    if (!assignmentForm.teacherId || !assignmentForm.classId || !assignmentForm.subjectId) {
      toast.error('Please fill all required fields');
      return;
    }
    assignTeacherMutation.mutate({
      teacherId: assignmentForm.teacherId,
      classId: assignmentForm.classId,
      subjectId: assignmentForm.subjectId,
      isClassTeacher: assignmentForm.isClassTeacher || false,
    });
    setShowTeacherModal(false);
    setAssignmentForm({ classId: '', isClassTeacher: false });
  };

  const studentColumns: DataTableColumn<StudentRecord>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Student Name',
        render: (row: StudentRecord) => `${row.first_name} ${row.last_name}`,
      },
      {
        key: 'admissionNumber',
        header: 'Admission Number',
        render: (row: StudentRecord) => row.admission_number || '—',
      },
      {
        key: 'class',
        header: 'Current Class',
        render: (row: StudentRecord) => row.class_id || 'Not assigned',
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row: StudentRecord) => (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setAssignmentForm({ ...assignmentForm, studentId: row.id, classId: selectedClassId });
              setShowStudentModal(true);
            }}
          >
            Reassign
          </Button>
        ),
      },
    ],
    [assignmentForm, selectedClassId]
  );

  return (
    <RouteMeta title="Class Assignment">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Class Assignment
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Assign students and teachers to classes
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowStudentModal(true)}>
              Assign Student
            </Button>
            <Button variant="outline" onClick={() => setShowTeacherModal(true)}>
              Assign Teacher
            </Button>
          </div>
        </header>

        {/* Class Selector */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <Select
            label="Select Class"
            value={selectedClassId}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setSelectedClassId(e.target.value)
            }
            options={classes.map((c: SchoolClass) => ({ label: c.name, value: c.id }))}
            disabled={classesLoading || classes.length === 0}
          />
        </div>

        {/* Class Students Table */}
        {selectedClassId && (
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Students in {selectedClass?.name}
            </h2>
            <DataTable<StudentRecord>
              data={classStudents}
              columns={studentColumns}
              pagination={{ pageSize: 10, showSizeSelector: true }}
              emptyMessage="No students assigned to this class"
              loading={studentsLoading}
            />
          </div>
        )}

        {/* Assign Student Modal */}
        {showStudentModal && (
          <Modal
            title="Assign Student to Class"
            isOpen={showStudentModal}
            onClose={() => {
              setShowStudentModal(false);
              setAssignmentForm({ classId: '', isClassTeacher: false });
            }}
          >
            <div className="space-y-4">
              <Select
                label="Student"
                value={assignmentForm.studentId || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setAssignmentForm({ ...assignmentForm, studentId: e.target.value })
                }
                options={students.map((s: StudentRecord) => ({
                  label: `${s.first_name} ${s.last_name}`,
                  value: s.id,
                }))}
              />
              <Select
                label="Class"
                value={assignmentForm.classId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setAssignmentForm({ ...assignmentForm, classId: e.target.value })
                }
                options={classes.map((c: SchoolClass) => ({ label: c.name, value: c.id }))}
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowStudentModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignStudent} loading={assignStudentMutation.isPending}>
                  Assign
                </Button>
              </div>
            </div>
          </Modal>
        )}

        {/* Assign Teacher Modal */}
        {showTeacherModal && (
          <Modal
            title="Assign Teacher to Class"
            isOpen={showTeacherModal}
            onClose={() => {
              setShowTeacherModal(false);
              setAssignmentForm({ classId: '', isClassTeacher: false });
            }}
          >
            <div className="space-y-4">
              <Select
                label="Teacher"
                value={assignmentForm.teacherId || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setAssignmentForm({ ...assignmentForm, teacherId: e.target.value })
                }
                options={teachers.map((t: TeacherProfile) => ({ label: t.name, value: t.id }))}
              />
              <Select
                label="Class"
                value={assignmentForm.classId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setAssignmentForm({ ...assignmentForm, classId: e.target.value })
                }
                options={classes.map((c: SchoolClass) => ({ label: c.name, value: c.id }))}
              />
              <Select
                label="Subject"
                value={assignmentForm.subjectId || ''}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  setAssignmentForm({ ...assignmentForm, subjectId: e.target.value })
                }
                options={subjects.map((s: Subject) => ({ label: s.name, value: s.id }))}
              />
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={assignmentForm.isClassTeacher || false}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setAssignmentForm({ ...assignmentForm, isClassTeacher: e.target.checked })
                  }
                  className="rounded border-[var(--brand-border)]"
                />
                <span className="text-sm text-[var(--brand-surface-contrast)]">Class Teacher</span>
              </label>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowTeacherModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleAssignTeacher} loading={assignTeacherMutation.isPending}>
                  Assign
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}
