import { Select } from '../../ui/Select';

export interface HODFieldsProps {
  departmentId: string;
  departments: Array<{ id: string; name: string }>;
  loadingDepartments: boolean;
  fieldErrors: Record<string, string>;
  onDepartmentIdChange: (value: string) => void;
  onClearFieldError: (field: string) => void;
}

/**
 * HOD-specific form fields
 * Extracted for modularity and reusability
 */
export function HODFields({
  departmentId,
  departments,
  loadingDepartments,
  fieldErrors,
  onDepartmentIdChange,
  onClearFieldError
}: HODFieldsProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
        Department <span className="text-red-500">*</span>
      </label>
      <Select
        value={departmentId}
        onChange={(e) => {
          onDepartmentIdChange(e.target.value);
          onClearFieldError('departmentId');
        }}
        disabled={loadingDepartments}
        options={[
          {
            label: loadingDepartments ? 'Loading departments...' : 'Select department',
            value: ''
          },
          ...departments.map((dept) => ({ label: dept.name, value: dept.id }))
        ]}
      />
      {fieldErrors.departmentId && (
        <p className="text-xs text-red-500">{fieldErrors.departmentId}</p>
      )}
    </div>
  );
}

export default HODFields;

