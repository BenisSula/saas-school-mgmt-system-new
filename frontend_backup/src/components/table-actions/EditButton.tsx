import { Button } from '../ui/Button';
import { Pencil } from 'lucide-react';

export interface EditButtonProps {
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
  disabled?: boolean;
}

export function EditButton({ 
  onClick, 
  label = 'Edit', 
  size = 'sm',
  variant = 'ghost',
  disabled = false
}: EditButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      leftIcon={<Pencil className="h-4 w-4" />}
      aria-label={label}
    >
      {label}
    </Button>
  );
}

