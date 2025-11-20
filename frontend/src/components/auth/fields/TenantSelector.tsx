import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Building2, Check } from 'lucide-react';
import type { TenantLookupResult, TenantLookupResponse } from '../../../lib/api';
import { api } from '../../../lib/api';

export interface TenantSelectorProps {
  value: string | null;
  onChange: (tenantId: string | null, tenant: TenantLookupResult | null) => void;
  error?: string;
  helperText?: string;
  required?: boolean;
  containerClassName?: string;
}

export function TenantSelector({
  value,
  onChange,
  error,
  helperText,
  required = true,
  containerClassName = ''
}: TenantSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMode, setSearchMode] = useState<'code' | 'name' | 'dropdown'>('dropdown');
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingInitial, setIsLoadingInitial] = useState(true);
  const [searchResults, setSearchResults] = useState<TenantLookupResult[]>([]);
  const [initialSchools, setInitialSchools] = useState<TenantLookupResult[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<TenantLookupResult | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial list of recent schools on mount
  useEffect(() => {
    let mounted = true;

    const loadInitialSchools = async () => {
      setIsLoadingInitial(true);
      try {
        const data = await api.listSchools({ recent: true, limit: 20 });
        if (mounted) {
          setInitialSchools(data.schools || []);
        }
      } catch (err) {
        console.error('[TenantSelector] Failed to load initial schools:', err);
        // Don't show error - just continue without initial list
        if (mounted) {
          setInitialSchools([]);
        }
      } finally {
        if (mounted) {
          setIsLoadingInitial(false);
        }
      }
    };

    loadInitialSchools();

    return () => {
      mounted = false;
    };
  }, []);

  // Sync with external value changes (if value is cleared externally)
  useEffect(() => {
    if (!value && selectedTenant) {
      setSelectedTenant(null);
      setSearchQuery('');
    }
  }, [value, selectedTenant]);

  const performSearch = async (query: string) => {
    if (!query.trim()) {
      // If empty query, show initial schools in dropdown mode
      if (searchMode === 'dropdown') {
        setSearchResults(initialSchools);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
      setSearchError(null);
      return;
    }

    if (query.length < 2) {
      setSearchResults([]);
      setSearchError(null);
      setShowDropdown(false);
      return;
    }

    setIsSearching(true);
    setSearchError(null);

    try {
      let result: TenantLookupResult | TenantLookupResponse | null = null;

      if (searchMode === 'code') {
        result = await api.lookupTenant({ code: query });
      } else {
        result = await api.lookupTenant({ name: query });
      }

      if (result) {
        // Handle single result (direct TenantLookupResult)
        if ('id' in result && 'name' in result && !('results' in result)) {
          setSearchResults([result as TenantLookupResult]);
          setShowDropdown(true);
          setSearchError(null);
        }
        // Handle multiple results (TenantLookupResponse with results array)
        else if ('results' in result && Array.isArray(result.results)) {
          setSearchResults(result.results);
          setShowDropdown(result.results.length > 0);
          setSearchError(
            result.results.length === 0
              ? 'No school found. Please check your registration code or school name.'
              : null
          );
        }
        // Handle single result in response format (has id but might be wrapped)
        else if ('id' in result) {
          setSearchResults([result as TenantLookupResult]);
          setShowDropdown(true);
          setSearchError(null);
        } else {
          setSearchResults([]);
          setShowDropdown(false);
          setSearchError('No school found. Please check your registration code or school name.');
        }
      } else {
        setSearchResults([]);
        setShowDropdown(false);
        setSearchError('No school found. Please check your registration code or school name.');
      }
    } catch (err) {
      console.error('[TenantSelector] Search error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      // Check if it's a network/connectivity error
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('Network')) {
        setSearchError('Cannot connect to server. Please check your connection and try again.');
      } else {
        setSearchError('Failed to search for school. Please try again.');
      }
      setSearchResults([]);
      setShowDropdown(false);
    } finally {
      setIsSearching(false);
    }
  };

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (newQuery: string) => {
    setSearchQuery(newQuery);

    // If dropdown mode and query is empty, show initial schools
    if (searchMode === 'dropdown' && !newQuery.trim()) {
      setSearchResults(initialSchools);
      setShowDropdown(true);
      setSelectedTenant(null);
      onChange(null, null);
      return;
    }

    // If query cleared, reset selection
    if (!newQuery.trim()) {
      setSelectedTenant(null);
      onChange(null, null);
      if (searchMode === 'dropdown') {
        setSearchResults(initialSchools);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
      return;
    }

    setSelectedTenant(null);
    onChange(null, null);

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Debounce search
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(newQuery);
    }, 300);
  };

  const handleInputFocus = () => {
    if (searchMode === 'dropdown') {
      if (searchQuery.trim()) {
        setShowDropdown(searchResults.length > 0);
      } else {
        setSearchResults(initialSchools);
        setShowDropdown(true);
      }
    }
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown]);

  // Handle Escape key to close dropdown
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDropdown) {
        setShowDropdown(false);
        inputRef.current?.blur();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showDropdown]);

  const handleSelectTenant = (tenant: TenantLookupResult) => {
    setSelectedTenant(tenant);
    setSearchQuery(tenant.name);
    setSearchResults([]);
    setShowDropdown(false);
    onChange(tenant.id, tenant);
  };

  const baseInputClasses =
    'block w-full rounded-lg border bg-[var(--brand-surface)] px-4 py-3 pl-10 pr-10 text-base text-[var(--brand-surface-contrast)] placeholder:text-[var(--brand-muted)] shadow-sm transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-0';

  const inputStateClasses = error
    ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20'
    : 'border-[var(--brand-border)] focus:border-[var(--brand-primary)] focus:ring-[var(--brand-primary)]/20';

  const inputClasses = `${baseInputClasses} ${inputStateClasses}`;

  return (
    <div ref={containerRef} className={`space-y-2 ${containerClassName}`}>
      <label className="block text-sm font-semibold text-[var(--brand-surface-contrast)]">
        School/Institution
        {required && <span className="ml-1 text-red-600 dark:text-red-400">*</span>}
      </label>

      {/* Search Mode Toggle */}
      <div className="flex gap-2 rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)]/50 p-1">
        <button
          type="button"
          onClick={() => {
            setSearchMode('dropdown');
            setSearchQuery('');
            setSearchResults(initialSchools);
            setShowDropdown(true);
            setSelectedTenant(null);
            onChange(null, null);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === 'dropdown'
              ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)]'
              : 'text-[var(--brand-muted)] hover:bg-[var(--brand-surface)]/50'
          }`}
        >
          Browse Schools
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchMode('code');
            setSearchQuery('');
            setSearchResults([]);
            setShowDropdown(false);
            setSelectedTenant(null);
            onChange(null, null);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === 'code'
              ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)]'
              : 'text-[var(--brand-muted)] hover:bg-[var(--brand-surface)]/50'
          }`}
        >
          Registration Code
        </button>
        <button
          type="button"
          onClick={() => {
            setSearchMode('name');
            setSearchQuery('');
            setSearchResults([]);
            setShowDropdown(false);
            setSelectedTenant(null);
            onChange(null, null);
          }}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
            searchMode === 'name'
              ? 'bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)]'
              : 'text-[var(--brand-muted)] hover:bg-[var(--brand-surface)]/50'
          }`}
        >
          Search Name
        </button>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--brand-muted)]"
          aria-hidden="true"
        />
        <input
          ref={inputRef}
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onFocus={handleInputFocus}
          placeholder={
            searchMode === 'dropdown'
              ? 'Start typing to search or browse schools below...'
              : searchMode === 'code'
                ? 'Enter your school registration code (e.g., NHS-BJL-2025)'
                : 'Enter your school name'
          }
          className={inputClasses}
          aria-describedby={helperText || error ? 'tenant-selector-helper' : undefined}
          aria-invalid={error ? 'true' : 'false'}
        />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-[var(--brand-muted)]" />
        )}
        {selectedTenant && !isSearching && (
          <Check className="absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--brand-accent)]" />
        )}
      </div>

      {/* Loading State */}
      {isLoadingInitial && searchMode === 'dropdown' && (
        <div className="rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] p-4 text-center">
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-[var(--brand-muted)]" />
          <p className="mt-2 text-xs text-[var(--brand-muted)]">Loading schools...</p>
        </div>
      )}

      {/* Search Results / Dropdown */}
      {!isLoadingInitial && searchResults.length > 0 && !selectedTenant && showDropdown && (
        <div className="max-h-60 overflow-auto rounded-lg border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-lg">
          {searchMode === 'dropdown' && !searchQuery.trim() && (
            <div className="border-b border-[var(--brand-border)] bg-[var(--brand-surface)]/50 px-4 py-2">
              <p className="text-xs font-medium text-[var(--brand-muted)]">
                Recently Added Schools
              </p>
            </div>
          )}
          {searchResults.map((tenant) => (
            <button
              key={tenant.id}
              type="button"
              onClick={() => handleSelectTenant(tenant)}
              className="w-full px-4 py-3 text-left transition-colors hover:bg-[var(--brand-surface)]/50 focus:bg-[var(--brand-primary)]/10 focus:outline-none"
            >
              <div className="flex items-center gap-3">
                <Building2 className="h-5 w-5 flex-shrink-0 text-[var(--brand-primary)]" />
                <div className="flex-1">
                  <p className="font-medium text-[var(--brand-surface-contrast)]">{tenant.name}</p>
                  {tenant.registrationCode && (
                    <p className="text-xs text-[var(--brand-muted)]">
                      Code: {tenant.registrationCode}
                    </p>
                  )}
                  {tenant.domain && (
                    <p className="text-xs text-[var(--brand-muted)]">Domain: {tenant.domain}</p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Selected Tenant Display */}
      {selectedTenant && (
        <div className="rounded-lg border border-[var(--brand-accent)]/50 bg-[var(--brand-accent)]/10 p-3">
          <div className="flex items-center gap-2">
            <Check className="h-5 w-5 text-[var(--brand-accent)]" />
            <div className="flex-1">
              <p className="font-medium text-[var(--brand-surface-contrast)]">
                {selectedTenant.name}
              </p>
              {selectedTenant.registrationCode && (
                <p className="text-xs text-[var(--brand-muted)]">
                  Registration Code: {selectedTenant.registrationCode}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedTenant(null);
                setSearchQuery('');
                onChange(null, null);
              }}
              className="text-xs text-[var(--brand-muted)] hover:text-[var(--brand-surface-contrast)]"
            >
              Change
            </button>
          </div>
        </div>
      )}

      {/* Helper Text */}
      {helperText && !error && !searchError && (
        <p id="tenant-selector-helper" className="text-xs text-[var(--brand-muted)]">
          {helperText}
        </p>
      )}

      {/* Error Messages */}
      {error && (
        <p
          className="text-xs font-medium text-red-600 dark:text-red-400"
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}

      {searchError && !error && (
        <p className="text-xs font-medium text-amber-500" role="alert" aria-live="polite">
          {searchError}
        </p>
      )}
    </div>
  );
}

export default TenantSelector;
