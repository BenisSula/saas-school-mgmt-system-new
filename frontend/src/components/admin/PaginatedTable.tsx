import { useState, useMemo } from 'react';
import { Table, type TableColumn } from '../ui/Table';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';

interface PaginatedTableProps<T> {
  columns: TableColumn<T>[];
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
  onRowClick,
}: PaginatedTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(pageSize);

  const totalPages = Math.ceil(data.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = useMemo(
    () => data.slice(startIndex, endIndex),
    [data, startIndex, endIndex]
  );

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      <Table
        columns={columns}
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
                { label: '100', value: '100' },
              ]}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--brand-muted)]">
              Showing {startIndex + 1} to {Math.min(endIndex, data.length)} of {data.length}
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
