import React from 'react';

export interface ActionButtonGroupProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Groups action buttons together with consistent spacing
 */
export function ActionButtonGroup({ children, className = '' }: ActionButtonGroupProps) {
  return (
    <div className={`flex gap-2 ${className}`}>
      {children}
    </div>
  );
}

