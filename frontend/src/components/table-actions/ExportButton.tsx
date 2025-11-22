import { Button } from '../ui/Button';
import { Download } from 'lucide-react';

export interface ExportButtonProps {
  onClick: () => void;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'solid' | 'outline' | 'ghost';
  format?: 'CSV' | 'PDF' | 'Excel';
}

export function ExportButton({ 
  onClick, 
  label, 
  size = 'sm',
  variant = 'outline',
  format
}: ExportButtonProps) {
  const displayLabel = label || (format ? `Export ${format}` : 'Export');
  
  return (
    <Button
      size={size}
      variant={variant}
      onClick={onClick}
      leftIcon={<Download className="h-4 w-4" />}
      aria-label={displayLabel}
    >
      {displayLabel}
    </Button>
  );
}

