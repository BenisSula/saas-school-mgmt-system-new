import { type ReactNode } from 'react';
import { ProfileSection } from '../ProfileSection';
import { Input } from '../../ui/Input';
import { Button } from '../../ui/Button';

export interface PersonalInfoField {
  label: string;
  value: string | null | undefined;
  editable?: boolean;
  onChange?: (value: string) => void;
  type?: 'text' | 'email' | 'tel' | 'date';
}

interface PersonalInfoSectionProps {
  fields: PersonalInfoField[];
  isEditing?: boolean;
  onEdit?: () => void;
  onCancel?: () => void;
  onSave?: () => void;
  saving?: boolean;
  customContent?: ReactNode;
  emptyMessage?: string;
}

export function PersonalInfoSection({
  fields,
  isEditing = false,
  onEdit,
  onCancel,
  onSave,
  saving = false,
  customContent,
  emptyMessage = 'No personal information available'
}: PersonalInfoSectionProps) {
  if (customContent) {
    return (
      <ProfileSection isEmpty={fields.length === 0} emptyMessage={emptyMessage}>
        {customContent}
      </ProfileSection>
    );
  }

  return (
    <ProfileSection isEmpty={fields.length === 0} emptyMessage={emptyMessage}>
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field, index) => (
            <Input
              key={index}
              label={field.label}
              value={field.value ?? ''}
              onChange={(e) => field.onChange?.(e.target.value)}
              disabled={!isEditing || !field.editable}
              readOnly={!field.editable}
              type={field.type || 'text'}
            />
          ))}
        </div>
        {isEditing && (onCancel || onSave) && (
          <div className="flex justify-end gap-2">
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {onSave && (
              <Button type="button" onClick={onSave} loading={saving}>
                Save changes
              </Button>
            )}
          </div>
        )}
        {!isEditing && onEdit && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onEdit}>
              Edit Profile
            </Button>
          </div>
        )}
      </div>
    </ProfileSection>
  );
}

