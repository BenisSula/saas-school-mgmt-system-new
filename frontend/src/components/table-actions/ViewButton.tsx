import { Button } from '../ui/Button';
import { Eye } from 'lucide-react';

export interface ViewButtonProps {
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
}

export function ViewButton({
  onClick,
  label = 'View',
  size = 'sm',
  variant = 'outline',
}: ViewButtonProps) {
  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      leftIcon={<Eye className="h-4 w-4" />}
      aria-label={label}
    >
      {label}
    </Button>
  );
}
