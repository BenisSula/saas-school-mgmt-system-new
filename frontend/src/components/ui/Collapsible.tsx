import { type ReactNode } from 'react';

export interface CollapsibleProps {
  isOpen: boolean;
  onToggle: () => void;
  trigger: ReactNode;
  children: ReactNode;
}

export function Collapsible({ isOpen, onToggle, trigger, children }: CollapsibleProps) {
  return (
    <div className="space-y-2">
      <div onClick={onToggle} className="cursor-pointer">
        {trigger}
      </div>
      {isOpen && <div>{children}</div>}
    </div>
  );
}

export default Collapsible;
