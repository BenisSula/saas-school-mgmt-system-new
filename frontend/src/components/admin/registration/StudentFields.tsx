import { TextInput } from '../../shared';
import { AuthDatePicker } from '../../auth/fields/AuthDatePicker';

export interface StudentFieldsProps {
  dateOfBirth: string;
  studentId: string;
  classId: string;
  parentGuardianName: string;
  parentGuardianContact: string;
  fieldErrors: Record<string, string>;
  onDateOfBirthChange: (value: string) => void;
  onStudentIdChange: (value: string) => void;
  onClassIdChange: (value: string) => void;
  onParentGuardianNameChange: (value: string) => void;
  onParentGuardianContactChange: (value: string) => void;
  onClearFieldError: (field: string) => void;
}

/**
 * Student-specific form fields
 * Extracted for modularity and reusability
 */
export function StudentFields({
  dateOfBirth,
  studentId,
  classId,
  parentGuardianName,
  parentGuardianContact,
  fieldErrors,
  onDateOfBirthChange,
  onStudentIdChange,
  onClassIdChange,
  onParentGuardianNameChange,
  onParentGuardianContactChange,
  onClearFieldError
}: StudentFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <AuthDatePicker
          label="Date of Birth"
          value={dateOfBirth}
          onChange={(e) => {
            onDateOfBirthChange(e.target.value);
            onClearFieldError('dateOfBirth');
          }}
          error={fieldErrors.dateOfBirth}
        />
        <TextInput
          label="Student ID"
          name="studentId"
          type="text"
          value={studentId}
          onChange={(e) => {
            onStudentIdChange(e.target.value);
            onClearFieldError('studentId');
          }}
          placeholder="STU-2025-001"
          error={fieldErrors.studentId}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Class/Grade"
          name="classId"
          type="text"
          value={classId}
          onChange={(e) => {
            onClassIdChange(e.target.value);
            onClearFieldError('classId');
          }}
          placeholder="Grade 10"
          error={fieldErrors.classId}
        />
        <TextInput
          label="Parent/Guardian Name"
          name="parentGuardianName"
          type="text"
          value={parentGuardianName}
          onChange={(e) => {
            onParentGuardianNameChange(e.target.value);
            onClearFieldError('parentGuardianName');
          }}
          placeholder="Parent Name"
          error={fieldErrors.parentGuardianName}
        />
      </div>

      <TextInput
        label="Parent/Guardian Contact"
        name="parentGuardianContact"
        type="tel"
        value={parentGuardianContact}
        onChange={(e) => {
          onParentGuardianContactChange(e.target.value);
          onClearFieldError('parentGuardianContact');
        }}
        placeholder="+1234567890"
        error={fieldErrors.parentGuardianContact}
      />
    </>
  );
}

export default StudentFields;

