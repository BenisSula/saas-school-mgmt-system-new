/**
 * Shared pagination hook for consistent pagination patterns
 */

import { useState, useMemo, useCallback } from 'react';

export interface PaginationOptions {
  initialPage?: number;
  initialPageSize?: number;
  totalItems?: number;
}

export interface PaginationState {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  offset: number;
  limit: number;
}

export interface PaginationControls {
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;
  reset: () => void;
}

const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_PAGE = 1;

export function usePagination(options: PaginationOptions = {}) {
  const {
    initialPage = DEFAULT_PAGE,
    initialPageSize = DEFAULT_PAGE_SIZE,
    totalItems = 0
  } = options;

  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(totalItems / pageSize));
  }, [totalItems, pageSize]);

  const offset = useMemo(() => {
    return (page - 1) * pageSize;
  }, [page, pageSize]);

  const limit = pageSize;

  const goToPage = useCallback((newPage: number) => {
    const validPage = Math.max(1, Math.min(newPage, totalPages));
    setPage(validPage);
  }, [totalPages]);

  const nextPage = useCallback(() => {
    if (page < totalPages) {
      setPage(page + 1);
    }
  }, [page, totalPages]);

  const previousPage = useCallback(() => {
    if (page > 1) {
      setPage(page - 1);
    }
  }, [page]);

  const handleSetPageSize = useCallback((newSize: number) => {
    setPageSize(newSize);
    // Reset to first page when page size changes
    setPage(1);
  }, []);

  const reset = useCallback(() => {
    setPage(initialPage);
    setPageSize(initialPageSize);
  }, [initialPage, initialPageSize]);

  const state: PaginationState = {
    page,
    pageSize,
    totalItems,
    totalPages,
    offset,
    limit
  };

  const controls: PaginationControls = {
    goToPage,
    nextPage,
    previousPage,
    setPageSize: handleSetPageSize,
    reset
  };

  return {
    ...state,
    ...controls
  };
}

