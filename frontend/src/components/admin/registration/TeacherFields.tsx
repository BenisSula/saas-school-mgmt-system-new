import { TextInput } from '../../shared';
import { AuthMultiSelect } from '../../auth/fields/AuthMultiSelect';

export interface TeacherFieldsProps {
  phone: string;
  teacherId: string;
  qualifications: string;
  yearsOfExperience: string;
  subjects: string[];
  fieldErrors: Record<string, string>;
  onPhoneChange: (value: string) => void;
  onTeacherIdChange: (value: string) => void;
  onQualificationsChange: (value: string) => void;
  onYearsOfExperienceChange: (value: string) => void;
  onSubjectsChange: (value: string[]) => void;
  onClearFieldError: (field: string) => void;
  subjectOptions?: Array<{ label: string; value: string }>;
}

const DEFAULT_SUBJECT_OPTIONS = [
  { label: 'Mathematics', value: 'mathematics' },
  { label: 'English', value: 'english' },
  { label: 'Science', value: 'science' },
  { label: 'Social Studies', value: 'social_studies' },
  { label: 'Physical Education', value: 'physical_education' },
  { label: 'Arts', value: 'arts' },
  { label: 'Music', value: 'music' },
  { label: 'Computer Science', value: 'computer_science' }
];

/**
 * Teacher-specific form fields (shared with HOD)
 * Extracted for modularity and reusability
 */
export function TeacherFields({
  phone,
  teacherId,
  qualifications,
  yearsOfExperience,
  subjects,
  fieldErrors,
  onPhoneChange,
  onTeacherIdChange,
  onQualificationsChange,
  onYearsOfExperienceChange,
  onSubjectsChange,
  onClearFieldError,
  subjectOptions = DEFAULT_SUBJECT_OPTIONS
}: TeacherFieldsProps) {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Phone Number"
          name="phone"
          type="tel"
          value={phone}
          onChange={(e) => {
            onPhoneChange(e.target.value);
            onClearFieldError('phone');
          }}
          placeholder="+1234567890"
          error={fieldErrors.phone}
        />
        <TextInput
          label="Teacher ID"
          name="teacherId"
          type="text"
          value={teacherId}
          onChange={(e) => {
            onTeacherIdChange(e.target.value);
            onClearFieldError('teacherId');
          }}
          placeholder="TCH-2025-001"
          error={fieldErrors.teacherId}
        />
      </div>

      <TextInput
        label="Qualifications"
        name="qualifications"
        type="text"
        value={qualifications}
        onChange={(e) => {
          onQualificationsChange(e.target.value);
          onClearFieldError('qualifications');
        }}
        placeholder="B.Ed, M.Sc Mathematics"
        error={fieldErrors.qualifications}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput
          label="Years of Experience"
          name="yearsOfExperience"
          type="number"
          value={yearsOfExperience}
          onChange={(e) => {
            onYearsOfExperienceChange(e.target.value);
            onClearFieldError('yearsOfExperience');
          }}
          placeholder="5"
          min="0"
          max="50"
          error={fieldErrors.yearsOfExperience}
        />
        <AuthMultiSelect
          label="Subjects Taught"
          options={subjectOptions}
          value={subjects}
          onChange={(value) => {
            onSubjectsChange(value);
            onClearFieldError('subjects');
          }}
          placeholder="Select subjects"
          error={fieldErrors.subjects}
        />
      </div>
    </>
  );
}

export default TeacherFields;

