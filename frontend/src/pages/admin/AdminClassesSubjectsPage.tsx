import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { FormEvent } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Table, type TableColumn } from '../../components/ui/Table';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { useAsyncFeedback } from '../../hooks/useAsyncFeedback';
import {
  api,
  type ClassSubject,
  type SchoolClass,
  type StudentRecord,
  type StudentSubject,
  type Subject,
  type SubjectPayload,
  type AdminTeacherAssignment,
  type TeacherProfile
} from '../../lib/api';

interface SubjectFormState {
  id?: string | null;
  name: string;
  code: string;
  description: string;
}

interface TeacherAssignmentForm {
  teacherId: string;
  classId: string;
  subjectId: string;
  isClassTeacher: boolean;
}

export default function AdminClassesSubjectsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [assignments, setAssignments] = useState<AdminTeacherAssignment[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedClassSubjects, setSelectedClassSubjects] = useState<string[]>([]);
  const [subjectForm, setSubjectForm] = useState<SubjectFormState>({
    name: '',
    code: '',
    description: '',
    id: null
  });
  const [teacherForm, setTeacherForm] = useState<TeacherAssignmentForm>({
    teacherId: '',
    classId: '',
    subjectId: '',
    isClassTeacher: false
  });
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [studentSubjects, setStudentSubjects] = useState<string[]>([]);
  const [promotionClassId, setPromotionClassId] = useState<string>('');
  const { status, message, setSuccess, setError: setFeedbackError, clear } = useAsyncFeedback();

  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [classList, subjectList, teacherList, studentList, assignmentList] = await Promise.all([
        api.listClasses(),
        api.admin.listSubjects(),
        api.listTeachers(),
        api.listStudents(),
        api.admin.listTeacherAssignments()
      ]);
      setClasses(classList);
      setSubjects(subjectList);
      setTeachers(
        teacherList.map((teacher) => ({
          ...teacher,
          subjects: Array.isArray(teacher.subjects) ? teacher.subjects : []
        }))
      );
      setStudents(studentList);
      setAssignments(assignmentList);
      if (classList.length > 0) {
        setSelectedClassId((current) => current || classList[0].id);
      }
      if (studentList.length > 0) {
        setSelectedStudentId((current) => current || studentList[0].id);
        setPromotionClassId(studentList[0].class_id ?? classList[0]?.id ?? '');
      }
      if (teacherList.length > 0) {
        setTeacherForm((state) => ({
          ...state,
          teacherId: state.teacherId || teacherList[0].id,
          classId: state.classId || (classList[0]?.id ?? ''),
          subjectId: state.subjectId || (subjectList[0]?.id ?? '')
        }));
      }
    } catch (err) {
      const message = (err as Error).message;
      setError(message);
      setFeedbackError(message);
    } finally {
      setLoading(false);
    }
  }, [setFeedbackError]);

  const loadClassSubjects = useCallback(async (classId: string) => {
    try {
      const existing = await api.admin.getClassSubjects(classId);
      setSelectedClassSubjects(existing.map((item: ClassSubject) => item.subject_id));
    } catch (err) {
      const message = (err as Error).message;
      toast.error(message);
    }
  }, []);

  const loadStudentSubjects = useCallback(
    async (studentId: string) => {
      try {
        const existing = await api.admin.getStudentSubjects(studentId);
        setStudentSubjects(existing.map((item: StudentSubject) => item.subject_id));
        const student = students.find((item) => item.id === studentId);
        if (student?.class_id) {
          setPromotionClassId(student.class_id);
        }
      } catch (err) {
        toast.error((err as Error).message);
      }
    },
    [students]
  );

  useEffect(() => {
    void loadInitialData();
  }, [loadInitialData]);

  useEffect(() => {
    if (selectedClassId) {
      void loadClassSubjects(selectedClassId);
    }
  }, [selectedClassId, loadClassSubjects]);

  useEffect(() => {
    if (selectedStudentId) {
      void loadStudentSubjects(selectedStudentId);
    }
  }, [selectedStudentId, loadStudentSubjects]);

  function handleSubjectFormChange(patch: Partial<SubjectFormState>) {
    setSubjectForm((state) => ({ ...state, ...patch }));
  }

  async function handleSubjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload: SubjectPayload = {
        name: subjectForm.name.trim(),
        code: subjectForm.code.trim() || undefined,
        description: subjectForm.description.trim() || undefined
      };
      let subject: Subject;
      if (subjectForm.id) {
        subject = await api.admin.updateSubject(subjectForm.id, payload);
        toast.success('Subject updated.');
      } else {
        subject = await api.admin.createSubject(payload);
        toast.success('Subject created.');
      }
      setSubjects((list) => {
        const filtered = list.filter((item) => item.id !== subject.id);
        return [...filtered, subject].sort((a, b) => a.name.localeCompare(b.name));
      });
      setSubjectForm({ id: null, name: '', code: '', description: '' });
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleSubjectDelete(id: string) {
    if (!window.confirm('Delete this subject? This will detach it from all classes.')) {
      return;
    }
    try {
      await api.admin.deleteSubject(id);
      toast.success('Subject removed.');
      setSubjects((list) => list.filter((item) => item.id !== id));
      setSelectedClassSubjects((list) => list.filter((subjectId) => subjectId !== id));
      setStudentSubjects((list) => list.filter((subjectId) => subjectId !== id));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleSaveClassSubjects() {
    if (!selectedClassId) return;
    try {
      await api.admin.setClassSubjects(selectedClassId, selectedClassSubjects);
      toast.success('Class subjects updated.');
      setSuccess('Class subject assignments saved.');
    } catch (err) {
      setFeedbackError((err as Error).message);
      toast.error((err as Error).message);
    }
  }

  const subjectTableColumns: TableColumn<Subject>[] = useMemo(
    () => [
      { header: 'Name', key: 'name' },
      { header: 'Code', key: 'code' },
      { header: 'Description', key: 'description' }
    ],
    []
  );

  async function handleTeacherAssignmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!teacherForm.teacherId || !teacherForm.classId || !teacherForm.subjectId) return;
    try {
      await api.admin.assignTeacher(teacherForm.teacherId, {
        classId: teacherForm.classId,
        subjectId: teacherForm.subjectId,
        isClassTeacher: teacherForm.isClassTeacher
      });
      toast.success('Teacher assignment saved.');
      const updated = await api.admin.listTeacherAssignments();
      setAssignments(updated);
      setTeacherForm((state) => ({ ...state, isClassTeacher: false }));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleTeacherAssignmentRemove(id: string) {
    if (!window.confirm('Remove this teacher assignment?')) return;
    try {
      await api.admin.removeTeacherAssignment(id);
      setAssignments((list) => list.filter((item) => item.id !== id));
      toast.success('Assignment removed.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handlePromoteStudent() {
    if (!selectedStudentId || !promotionClassId) return;
    try {
      await api.admin.promoteStudent(selectedStudentId, { toClassId: promotionClassId });
      toast.success('Student promotion recorded.');
      setSuccess('Student class updated.');
    } catch (err) {
      setFeedbackError((err as Error).message);
      toast.error((err as Error).message);
    }
  }

  async function handleSaveStudentSubjects() {
    if (!selectedStudentId) return;
    try {
      await api.admin.setStudentSubjects(selectedStudentId, studentSubjects);
      toast.success('Student subjects updated.');
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  if (loading) {
    return (
      <RouteMeta title="Classes & subjects">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Classes & subjects">
        <StatusBanner status="error" message={error} onDismiss={() => setError(null)} />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Classes & subjects">
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Classes, subjects & assignments
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Create the academic structure for your school, map teachers and students, and keep
            subjects aligned with classes.
          </p>
        </header>

        {message ? <StatusBanner status={status} message={message} onDismiss={clear} /> : null}

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
                Subject catalogue
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Maintain the list of subjects offered and keep codes consistent for reporting.
              </p>
            </div>
            <div className="text-xs text-[var(--brand-muted)]">
              {subjects.length} subject{subjects.length === 1 ? '' : 's'}
            </div>
          </header>
          <form
            onSubmit={handleSubjectSubmit}
            className="grid gap-3 rounded-lg border border-dashed border-[var(--brand-border)] p-4 sm:grid-cols-[1fr,120px] sm:items-end"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                label="Name"
                required
                value={subjectForm.name}
                onChange={(event) => handleSubjectFormChange({ name: event.target.value })}
              />
              <Input
                label="Code"
                value={subjectForm.code}
                placeholder="e.g. MATH"
                onChange={(event) => handleSubjectFormChange({ code: event.target.value })}
              />
              <Input
                label="Description"
                value={subjectForm.description}
                onChange={(event) => handleSubjectFormChange({ description: event.target.value })}
              />
            </div>
            <Button type="submit">{subjectForm.id ? 'Update subject' : 'Add subject'}</Button>
          </form>
          <div className="mt-4">
            <Table columns={subjectTableColumns} data={subjects} caption="Registered subjects" />
            <div className="mt-2 flex flex-wrap gap-2 text-xs text-[var(--brand-muted)]">
              {subjects.map((subject) => (
                <span
                  key={subject.id}
                  className="flex items-center gap-2 rounded bg-white/10 px-2 py-1"
                >
                  <button
                    type="button"
                    className="text-[var(--brand-primary)] underline"
                    onClick={() =>
                      setSubjectForm({
                        id: subject.id,
                        name: subject.name,
                        code: subject.code ?? '',
                        description: subject.description ?? ''
                      })
                    }
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="text-red-300 underline"
                    onClick={() => {
                      void handleSubjectDelete(subject.id);
                    }}
                  >
                    Delete
                  </button>
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4">
            <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
              Class subject mapping
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Choose a class and toggle the subjects it offers. These drive timetable and grading
              flows.
            </p>
          </header>
          <div className="flex flex-col gap-4 lg:flex-row">
            <Select
              label="Class"
              value={selectedClassId}
              onChange={(event) => setSelectedClassId(event.target.value)}
              options={classes.map((clazz) => ({
                value: clazz.id,
                label: clazz.name
              }))}
            />
            <div className="grid flex-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
              {subjects.length === 0 ? (
                <p className="text-sm text-[var(--brand-muted)]">
                  Create subjects to associate them with the selected class.
                </p>
              ) : (
                subjects.map((subject) => (
                  <label
                    key={subject.id}
                    className="flex items-center gap-2 rounded-md border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedClassSubjects.includes(subject.id)}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedClassSubjects((list) => [...list, subject.id]);
                        } else {
                          setSelectedClassSubjects((list) =>
                            list.filter((value) => value !== subject.id)
                          );
                        }
                      }}
                    />
                    <span>{subject.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={handleSaveClassSubjects} disabled={!selectedClassId}>
              Save mapping
            </Button>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
                Teacher assignments
              </h2>
              <p className="text-sm text-[var(--brand-muted)]">
                Align teachers to classes and subjects, and flag the classroom teacher for each
                cohort.
              </p>
            </div>
          </header>
          <form
            onSubmit={handleTeacherAssignmentSubmit}
            className="grid gap-3 rounded-lg border border-dashed border-[var(--brand-border)] p-4 sm:grid-cols-5"
          >
            <Select
              label="Teacher"
              value={teacherForm.teacherId}
              onChange={(event) =>
                setTeacherForm((state) => ({ ...state, teacherId: event.target.value }))
              }
              options={teachers.map((teacher) => ({
                value: teacher.id,
                label: teacher.name
              }))}
            />
            <Select
              label="Class"
              value={teacherForm.classId}
              onChange={(event) =>
                setTeacherForm((state) => ({ ...state, classId: event.target.value }))
              }
              options={classes.map((clazz) => ({
                value: clazz.id,
                label: clazz.name
              }))}
            />
            <Select
              label="Subject"
              value={teacherForm.subjectId}
              onChange={(event) =>
                setTeacherForm((state) => ({ ...state, subjectId: event.target.value }))
              }
              options={subjects.map((subject) => ({
                value: subject.id,
                label: subject.name
              }))}
            />
            <label className="flex items-center gap-2 text-sm text-[var(--brand-surface-contrast)]">
              <input
                type="checkbox"
                checked={teacherForm.isClassTeacher}
                onChange={(event) =>
                  setTeacherForm((state) => ({ ...state, isClassTeacher: event.target.checked }))
                }
              />
              Class teacher
            </label>
            <div className="flex justify-end">
              <Button type="submit">Assign</Button>
            </div>
          </form>
          <div className="mt-4 space-y-2">
            {assignments.length === 0 ? (
              <p className="text-sm text-[var(--brand-muted)]">
                No assignments yet. Map teachers to classes to enable grade submissions and
                attendance.
              </p>
            ) : (
              <ul className="space-y-2">
                {assignments.map((assignment) => (
                  <li
                    key={assignment.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm"
                  >
                    <span>
                      <strong>{assignment.teacher_name}</strong> → {assignment.class_name} ·{' '}
                      {assignment.subject_name}{' '}
                      {assignment.is_class_teacher ? (
                        <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-100">
                          Class teacher
                        </span>
                      ) : null}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void handleTeacherAssignmentRemove(assignment.id);
                      }}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4">
            <h2 className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
              Student subjects & promotion
            </h2>
            <p className="text-sm text-[var(--brand-muted)]">
              Move learners between classes and align their subject enrolments after promotions or
              transfers.
            </p>
          </header>
          <div className="grid gap-4 md:grid-cols-[minmax(220px,280px)_1fr]">
            <Select
              label="Student"
              value={selectedStudentId}
              onChange={(event) => setSelectedStudentId(event.target.value)}
              options={students.map((student) => ({
                value: student.id,
                label: `${student.first_name} ${student.last_name}`
              }))}
            />
            <div className="grid gap-3 md:grid-cols-2">
              <Select
                label="Promote / transfer to class"
                value={promotionClassId}
                onChange={(event) => setPromotionClassId(event.target.value)}
                options={classes.map((clazz) => ({
                  value: clazz.id,
                  label: clazz.name
                }))}
              />
              <Button
                className="self-end"
                onClick={() => {
                  void handlePromoteStudent();
                }}
              >
                Save class change
              </Button>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm font-medium text-[var(--brand-surface-contrast)]">
              Subjects
            </p>
            <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3">
              {subjects.map((subject) => (
                <label
                  key={subject.id}
                  className="flex items-center gap-2 rounded-md border border-[var(--brand-border)] bg-black/20 px-3 py-2 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={studentSubjects.includes(subject.id)}
                    onChange={(event) => {
                      if (event.target.checked) {
                        setStudentSubjects((list) => [...list, subject.id]);
                      } else {
                        setStudentSubjects((list) => list.filter((value) => value !== subject.id));
                      }
                    }}
                  />
                  <span>{subject.name}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => {
                  void handleSaveStudentSubjects();
                }}
              >
                Save student subjects
              </Button>
            </div>
          </div>
        </section>
      </div>
    </RouteMeta>
  );
}
