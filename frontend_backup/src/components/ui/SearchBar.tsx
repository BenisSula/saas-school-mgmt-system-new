/**
 * Search Bar Component
 * Accessible search input with keyboard navigation
 */
import { useState, useRef, useEffect } from 'react';
import type React from 'react';
import { Search, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export interface SearchBarProps {
  placeholder?: string;
  onSearch?: (query: string) => void;
  onClear?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  onClear,
  className = '',
  autoFocus = false
}: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
    onSearch?.(value);
  };

  const handleClear = () => {
    setQuery('');
    onClear?.();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      handleClear();
      inputRef.current?.blur();
    }
  };

  return (
    <div className={`relative flex items-center ${className}`} role="search" aria-label="Search">
      <div
        className={`relative flex w-full items-center rounded-lg border transition-all ${
          isFocused
            ? 'border-[var(--brand-primary)] shadow-[var(--focus-ring)]'
            : 'border-[var(--brand-border)] bg-[var(--brand-surface-secondary)]'
        }`}
      >
        <Search
          className="absolute left-3 h-4 w-4 text-[var(--brand-muted)] pointer-events-none"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="w-full bg-transparent py-2 pl-10 pr-10 text-sm text-[var(--brand-surface-contrast)] placeholder:text-[var(--brand-muted)] focus:outline-none"
          aria-label="Search input"
          aria-describedby="search-description"
        />
        <AnimatePresence>
          {query && (
            <motion.button
              type="button"
              onClick={handleClear}
              className="absolute right-2 flex h-6 w-6 items-center justify-center rounded text-[var(--brand-muted)] hover:text-[var(--brand-surface-contrast)] focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]"
              aria-label="Clear search"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      <span id="search-description" className="sr-only">
        Use Escape key to clear search
      </span>
    </div>
  );
}

export default SearchBar;
