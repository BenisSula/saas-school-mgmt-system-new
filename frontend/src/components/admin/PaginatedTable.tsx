import { useState, useMemo } from 'react';
import { Table, type TableColumn } from '../ui/Table';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { ChevronUp, ChevronDown } from 'lucide-react';

export interface SortableTableColumn<T> extends TableColumn<T> {
  sortable?: boolean;
  sortKey?: keyof T | string;
}

interface PaginatedTableProps<T> {
  columns: SortableTableColumn<T>[];
  data: T[];
  pageSize?: number;
  caption?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function PaginatedTable<T>({
  columns,
  data,
  pageSize = 10,
  caption,
  emptyMessage = 'No records found.',
  onRowClick
}: PaginatedTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(pageSize);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Sort data
  const sortedData = useMemo(() => {
    if (!sortColumn) return data;

    const column = columns.find((col) => {
      const key = col.sortKey || col.key;
      return String(key) === sortColumn;
    });

    if (!column?.sortable) return data;

    const sortKey = column.sortKey || column.key;
    if (!sortKey) return data;

    return [...data].sort((a, b) => {
      const aVal = (a as Record<string, unknown>)[String(sortKey)];
      const bVal = (b as Record<string, unknown>)[String(sortKey)];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Handle arrays (e.g., subjects, classes)
      if (Array.isArray(aVal) && Array.isArray(bVal)) {
        const aStr = aVal.join(', ').toLowerCase();
        const bStr = bVal.join(', ').toLowerCase();
        const comparison = aStr.localeCompare(bStr);
        return sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle strings
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const comparison = aStr.localeCompare(bStr);
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [data, sortColumn, sortDirection, columns]);

  const totalPages = Math.ceil(sortedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = useMemo(
    () => sortedData.slice(startIndex, endIndex),
    [sortedData, startIndex, endIndex]
  );

  const handleSort = (column: SortableTableColumn<T>) => {
    if (!column.sortable) return;
    const key = String(column.sortKey || column.key);
    if (sortColumn === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(key);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  // Enhance columns with sortable headers
  const enhancedColumns = useMemo(() => {
    return columns.map((column) => {
      const key = String(column.sortKey || column.key || '');
      const isSorted = sortColumn === key;
      const isAsc = sortDirection === 'asc';

      if (column.sortable) {
        return {
          ...column,
          header: (
            <button
              type="button"
              onClick={() => handleSort(column)}
              className="flex items-center gap-2 hover:text-[var(--brand-primary)] transition-colors"
              aria-label={`Sort by ${String(column.header)}`}
            >
              {column.header}
              {isSorted ? (
                isAsc ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )
              ) : (
                <span className="h-4 w-4" />
              )}
            </button>
          )
        };
      }
      return column;
    });
  }, [columns, sortColumn, sortDirection]);

  return (
    <div className="space-y-4">
      <Table
        columns={enhancedColumns}
        data={paginatedData}
        caption={caption}
        emptyMessage={emptyMessage}
        onRowClick={onRowClick}
      />
      {data.length > 0 && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--brand-muted)]">Items per page:</span>
            <Select
              value={String(itemsPerPage)}
              onChange={(e) => handleItemsPerPageChange(e.target.value)}
              options={[
                { label: '10', value: '10' },
                { label: '25', value: '25' },
                { label: '50', value: '50' },
                { label: '100', value: '100' }
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--brand-muted)]">
              Showing {startIndex + 1} to {Math.min(endIndex, sortedData.length)} of {sortedData.length}
            </span>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePageChange(1)}
                disabled={currentPage === 1}
              >
                First
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="flex items-center px-3 text-sm text-[var(--brand-surface-contrast)]">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Next
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handlePageChange(totalPages)}
                disabled={currentPage === totalPages}
              >
                Last
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
