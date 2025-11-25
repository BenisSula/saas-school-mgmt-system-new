import { type ReactNode } from 'react';

export interface CardProps {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  padding?: string;
}

export function Card({ children, className = '', onClick, padding }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm transition-shadow ${
        onClick ? 'cursor-pointer hover:shadow-md' : ''
      } ${padding || 'p-6'} ${className}`}
    >
      {children}
    </div>
  );
}

export default Card;
