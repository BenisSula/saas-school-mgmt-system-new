import { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { useTeachers } from '../../hooks/queries/useTeachers';
import { useAssignHODToDepartment } from '../../hooks/queries/admin/useDepartments';
import { toast } from 'sonner';

/**
 * Props:
 * - open boolean
 * - department object { id, name, ... }
 * - onClose callback
 */
export interface AssignHODModalProps {
  open: boolean;
  department: { id: string; name: string } | null;
  onClose: () => void;
}

/**
 * AssignHODModal
 * - Displays a searchable list of teachers and assigns selected teacher as HOD
 */
export function AssignHODModal({ open, department, onClose }: AssignHODModalProps) {
  const [search, setSearch] = useState('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');

  // Fetch teachers (uses existing hook)
  // The hook supports filters with search parameter
  const { data: teachersData, isLoading: teachersLoading } = useTeachers(
    search ? { search } : undefined
  );

  // assign mutation from useDepartments hook
  const assignMutation = useAssignHODToDepartment();

  const teacherOptions = useMemo(() => {
    const teachers = teachersData ?? [];
    const arr = teachers.map((t) => ({
      label: `${t.name || ''} (${t.email || ''})`.trim(),
      value: t.id,
    }));
    return [{ label: 'Select a teacher', value: '' }, ...arr];
  }, [teachersData]);

  const handleAssign = async () => {
    if (!department) return;
    if (!selectedTeacherId) {
      toast.error('Please select a teacher to assign as HOD');
      return;
    }
    try {
      await assignMutation.mutateAsync({
        departmentId: department.id,
        userId: selectedTeacherId,
      });
      // onSuccess handled by hook which invalidates queries & toasts - but close modal here
      onClose();
      setSelectedTeacherId('');
      setSearch('');
    } catch (err) {
      // Error already handled by mutation hook
      console.error('Failed to assign HOD:', err);
    }
  };

  const handleClose = () => {
    setSelectedTeacherId('');
    setSearch('');
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={handleClose} title={department ? `Assign HOD — ${department.name}` : 'Assign HOD'}>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-[var(--brand-muted)]">Search teachers</label>
          <div className="mt-2">
            <Input
              placeholder="Search by name or email"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--brand-muted)]">Choose teacher</label>
          <div className="mt-2">
            <Select
              options={teacherOptions}
              value={selectedTeacherId}
              onChange={(e) => setSelectedTeacherId(e.target.value)}
              disabled={teachersLoading}
            />
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={assignMutation.isPending || !selectedTeacherId}>
            {assignMutation.isPending ? 'Assigning...' : 'Assign HOD'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export default AssignHODModal;

