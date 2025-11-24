import { useState, useId, useRef, useEffect } from 'react';
import type React from 'react';
import { X, ChevronDown } from 'lucide-react';

export interface AuthMultiSelectOption {
  label: string;
  value: string;
}

export interface AuthMultiSelectProps {
  label: string;
  options: AuthMultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  error?: string;
  helperText?: string;
  placeholder?: string;
  required?: boolean;
  containerClassName?: string;
}

export function AuthMultiSelect({
  label,
  options,
  value,
  onChange,
  error,
  helperText,
  placeholder = 'Select options',
  required = false,
  containerClassName = '',
}: AuthMultiSelectProps) {
  const generatedId = useId();
  const selectId = `${generatedId}-multiselect`;
  const helperId = `${selectId}-helper`;
  const errorId = `${selectId}-error`;
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const describedBy: string[] = [];
  if (helperText) describedBy.push(helperId);
  if (error) describedBy.push(errorId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onChange(value.filter((v) => v !== optionValue));
    } else {
      onChange([...value, optionValue]);
    }
  };

  const removeOption = (optionValue: string, event: React.MouseEvent) => {
    event.stopPropagation();
    onChange(value.filter((v) => v !== optionValue));
  };

  const selectedLabels = options.filter((opt) => value.includes(opt.value)).map((opt) => opt.label);

  const baseClasses =
    'block w-full rounded-lg border bg-[var(--brand-surface)] px-4 py-3 text-base text-[var(--brand-surface-contrast)] shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0';

  const stateClasses = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-[var(--brand-border)] focus:border-[var(--brand-primary)] focus:ring-[var(--brand-primary)]/20';

  return (
    <div className={`space-y-2 ${containerClassName}`} ref={containerRef}>
      <label
        htmlFor={selectId}
        className="block text-sm font-semibold text-[var(--brand-surface-contrast)]"
      >
        {label}
        {required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
      </label>

      <div className="relative">
        <button
          type="button"
          id={selectId}
          onClick={() => setIsOpen(!isOpen)}
          aria-describedby={describedBy.join(' ') || undefined}
          aria-invalid={error ? 'true' : 'false'}
          aria-expanded={isOpen ? 'true' : 'false'}
          className={`${baseClasses} ${stateClasses} flex items-center justify-between cursor-pointer`}
        >
          <span className="flex-1 text-left">
            {selectedLabels.length > 0 ? (
              <span className="flex flex-wrap gap-1">
                {selectedLabels.map((label, idx) => {
                  const optionValue = options.find((opt) => opt.label === label)?.value || '';
                  return (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-[var(--brand-primary)]/20 px-2 py-1 text-xs text-[var(--brand-primary)]"
                    >
                      {label}
                      <button
                        type="button"
                        onClick={(e) => removeOption(optionValue, e)}
                        className="hover:text-[var(--brand-primary)] focus:outline-none"
                        aria-label={`Remove ${label}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  );
                })}
              </span>
            ) : (
              <span className="text-[var(--brand-muted)]">{placeholder}</span>
            )}
          </span>
          <ChevronDown
            className={`h-5 w-5 text-[var(--brand-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 mt-1 w-full rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg max-h-60 overflow-auto">
            {options.map((option) => {
              const isSelected = value.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggleOption(option.value)}
                  className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                    isSelected
                      ? 'bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]'
                      : 'text-[var(--brand-surface-contrast)] hover:bg-[var(--brand-surface)]/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="h-4 w-4 rounded border-[var(--brand-border)] text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]/20"
                      readOnly
                    />
                    <span>{option.label}</span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {helperText && !error && (
        <p id={helperId} className="text-xs text-[var(--brand-muted)]">
          {helperText}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          className="text-xs font-medium text-red-600 dark:text-red-400"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export default AuthMultiSelect;
