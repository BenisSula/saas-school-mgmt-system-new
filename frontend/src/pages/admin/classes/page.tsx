/**
 * Admin Classes Management Page
 * CRUD operations for classes, teacher assignment, student enrollment
 */

import { useState } from 'react';
import RouteMeta from '../../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Modal } from '../../../components/ui/Modal';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { Plus, UserPlus, Users } from 'lucide-react';
import { EditButton, DeleteButton, ActionButtonGroup } from '../../../components/table-actions';
import {
  useAdminClasses,
  useCreateAdminClass,
  useUpdateAdminClass,
  useDeleteAdminClass,
  useAssignClassTeacher,
  useAssignStudentsToClass,
  type AdminClass
} from '../../../hooks/queries/admin/useAdminClasses';
import { useTeachers } from '../../../hooks/queries/useTeachers';
import { useStudents } from '../../../hooks/queries/useStudents';

export default function AdminClassesPage() {
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAssignTeacherModalOpen, setIsAssignTeacherModalOpen] = useState(false);
  const [isAssignStudentsModalOpen, setIsAssignStudentsModalOpen] = useState(false);
  const [selectedClass, setSelectedClass] = useState<AdminClass | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    gradeLevel: '',
    section: '',
    departmentId: '',
    capacity: '',
    academicYear: ''
  });
  const [selectedTeacherId, setSelectedTeacherId] = useState('');
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);

  const { data: classesData, isLoading, error } = useAdminClasses(true);
  const { data: teachersData } = useTeachers();
  const { data: studentsData } = useStudents();
  const createMutation = useCreateAdminClass();
  const updateMutation = useUpdateAdminClass();
  const deleteMutation = useDeleteAdminClass();
  const assignTeacherMutation = useAssignClassTeacher();
  const assignStudentsMutation = useAssignStudentsToClass();

  const handleCreate = () => {
    createMutation.mutate(
      {
        ...formData,
        capacity: formData.capacity ? Number(formData.capacity) : undefined,
        departmentId: formData.departmentId || undefined
      },
      {
        onSuccess: () => {
          setIsCreateModalOpen(false);
          setFormData({
            name: '',
            description: '',
            gradeLevel: '',
            section: '',
            departmentId: '',
            capacity: '',
            academicYear: ''
          });
        }
      }
    );
  };

  const handleEdit = (classItem: AdminClass) => {
    setSelectedClass(classItem);
    setFormData({
      name: classItem.name,
      description: classItem.description || '',
      gradeLevel: classItem.gradeLevel || '',
      section: classItem.section || '',
      departmentId: classItem.departmentId || '',
      capacity: classItem.capacity?.toString() || '',
      academicYear: classItem.academicYear || ''
    });
    setIsEditModalOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedClass) return;
    updateMutation.mutate(
      {
        id: selectedClass.id,
        payload: {
          ...formData,
          capacity: formData.capacity ? Number(formData.capacity) : undefined,
          departmentId: formData.departmentId || undefined
        }
      },
      {
        onSuccess: () => {
          setIsEditModalOpen(false);
          setSelectedClass(null);
        }
      }
    );
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this class?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleAssignTeacher = (classItem: AdminClass) => {
    setSelectedClass(classItem);
    setSelectedTeacherId(classItem.classTeacherId || '');
    setIsAssignTeacherModalOpen(true);
  };

  const handleSubmitAssignTeacher = () => {
    if (!selectedClass || !selectedTeacherId) return;
    assignTeacherMutation.mutate(
      { classId: selectedClass.id, teacherUserId: selectedTeacherId },
      {
        onSuccess: () => {
          setIsAssignTeacherModalOpen(false);
          setSelectedClass(null);
        }
      }
    );
  };

  const handleAssignStudents = (classItem: AdminClass) => {
    setSelectedClass(classItem);
    setIsAssignStudentsModalOpen(true);
  };

  const handleSubmitAssignStudents = () => {
    if (!selectedClass || selectedStudentIds.length === 0) return;
    assignStudentsMutation.mutate(
      { classId: selectedClass.id, studentIds: selectedStudentIds },
      {
        onSuccess: () => {
          setIsAssignStudentsModalOpen(false);
          setSelectedClass(null);
          setSelectedStudentIds([]);
        }
      }
    );
  };

  const columns: TableColumn<AdminClass>[] = [
    { key: 'name', label: 'Name' },
    { key: 'gradeLevel', label: 'Grade Level' },
    { key: 'section', label: 'Section' },
    {
      key: 'studentCount',
      label: 'Students',
      render: (classItem) => classItem.studentCount ?? 0
    },
    {
      key: 'teacherName',
      label: 'Class Teacher',
      render: (classItem) => classItem.teacherName || 'Not assigned'
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (classItem) => (
        <ActionButtonGroup>
          <EditButton onClick={() => handleEdit(classItem)} />
          <DeleteButton onClick={() => handleDelete(classItem.id)} />
          <Button
            size="sm"
            variant="outline"
            leftIcon={<UserPlus className="h-4 w-4" />}
            onClick={() => handleAssignTeacher(classItem)}
          >
            Assign Teacher
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Users className="h-4 w-4" />}
            onClick={() => handleAssignStudents(classItem)}
          >
            Assign Students
          </Button>
        </ActionButtonGroup>
      )
    }
  ];

  if (isLoading) {
    return (
      <RouteMeta title="Classes">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Classes">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  const classes = (Array.isArray(classesData) ? classesData : (classesData as any)?.data || []) as AdminClass[];
  const teachers = teachersData || [];
  const students = studentsData || [];

  return (
    <RouteMeta title="Classes">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Classes Management
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Manage classes, assign teachers, and enroll students
            </p>
          </div>
          <Button
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            Create Class
          </Button>
        </header>

        <Table columns={columns} data={classes} emptyMessage="No classes found" />

        {/* Create Modal */}
        <Modal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          title="Create Class"
        >
          <div className="space-y-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Input
              label="Grade Level"
              value={formData.gradeLevel}
              onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
            />
            <Input
              label="Section"
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
            />
            <Input
              label="Capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            />
            <Input
              label="Academic Year"
              value={formData.academicYear}
              onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} loading={createMutation.isPending}>
                Create
              </Button>
            </div>
          </div>
        </Modal>

        {/* Edit Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={() => setIsEditModalOpen(false)}
          title="Edit Class"
        >
          <div className="space-y-4">
            <Input
              label="Name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
            <Input
              label="Description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
            <Input
              label="Grade Level"
              value={formData.gradeLevel}
              onChange={(e) => setFormData({ ...formData, gradeLevel: e.target.value })}
            />
            <Input
              label="Section"
              value={formData.section}
              onChange={(e) => setFormData({ ...formData, section: e.target.value })}
            />
            <Input
              label="Capacity"
              type="number"
              value={formData.capacity}
              onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
            />
            <Input
              label="Academic Year"
              value={formData.academicYear}
              onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdate} loading={updateMutation.isPending}>
                Update
              </Button>
            </div>
          </div>
        </Modal>

        {/* Assign Teacher Modal */}
        <Modal
          isOpen={isAssignTeacherModalOpen}
          onClose={() => setIsAssignTeacherModalOpen(false)}
          title={`Assign Class Teacher to ${selectedClass?.name}`}
        >
          <div className="space-y-4">
            <Select
              label="Teacher"
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              options={[
                { value: '', label: 'Select a teacher' },
                ...teachers.map((t) => ({
                  value: t.id || '',
                  label: t.name || t.email || ''
                }))
              ]}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAssignTeacherModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAssignTeacher}
                loading={assignTeacherMutation.isPending}
                disabled={!selectedTeacherId}
              >
                Assign
              </Button>
            </div>
          </div>
        </Modal>

        {/* Assign Students Modal */}
        <Modal
          isOpen={isAssignStudentsModalOpen}
          onClose={() => setIsAssignStudentsModalOpen(false)}
          title={`Assign Students to ${selectedClass?.name}`}
        >
          <div className="space-y-4">
            <div className="max-h-60 overflow-y-auto space-y-2">
              {students.map((student) => (
                <label key={student.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedStudentIds.includes(student.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedStudentIds([...selectedStudentIds, student.id]);
                      } else {
                        setSelectedStudentIds(selectedStudentIds.filter((id) => id !== student.id));
                      }
                    }}
                  />
                  <span>
                    {student.full_name || student.first_name} {student.last_name}
                  </span>
                </label>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsAssignStudentsModalOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmitAssignStudents}
                loading={assignStudentsMutation.isPending}
                disabled={selectedStudentIds.length === 0}
              >
                Assign {selectedStudentIds.length} Student(s)
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </RouteMeta>
  );
}

