import { Button } from '../ui/Button';
import { UserPlus } from 'lucide-react';

export interface AssignButtonProps {
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
  disabled?: boolean;
}

export function AssignButton({ 
  onClick, 
  label = 'Assign', 
  size = 'sm',
  variant = 'ghost',
  disabled = false
}: AssignButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      disabled={disabled}
      leftIcon={<UserPlus className="h-4 w-4" />}
      aria-label={label}
    >
      {label}
    </Button>
  );
}

