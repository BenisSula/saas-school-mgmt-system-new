import { isValidElement, memo, type CSSProperties, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { useBrand } from './BrandProvider';
import { fadeIn, staggerContainer, staggerItem } from '../../lib/utils/animations';

export interface TableColumn<T> {
  key?: keyof T | string;
  header: string | ReactNode;
  align?: 'left' | 'center' | 'right';
  render?: (row: T, rowIndex?: number, columnIndex?: number) => ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  caption?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

function TableComponent<T>({
  columns,
  data,
  caption,
  emptyMessage = 'No records found.',
  onRowClick,
}: TableProps<T>) {
  const { tokens } = useBrand();
  if (data.length === 0) {
    return (
      <motion.div
        className="card-base p-6 sm:p-8 text-center"
        variants={fadeIn}
        initial="hidden"
        animate="visible"
      >
        <p className="text-sm text-[var(--brand-muted)]">{emptyMessage}</p>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="overflow-hidden rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)] shadow-sm"
      style={
        {
          '--brand-secondary': tokens.secondary,
          '--brand-secondary-contrast': tokens.secondaryContrast,
        } as CSSProperties
      }
      variants={fadeIn}
      initial="hidden"
      animate="visible"
    >
      <div className="overflow-x-auto scrollbar-thin">
        <table className="min-w-full divide-y divide-[var(--brand-border)] text-left text-sm">
          {caption ? (
            <caption className="bg-[var(--brand-surface-secondary)] px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--brand-muted)]">
              {caption}
            </caption>
          ) : null}
          <thead className="bg-[var(--brand-surface-secondary)]">
            <tr>
              {columns.map((column, columnIndex) => (
                <th
                  key={column.key ? String(column.key) : `header-${columnIndex}`}
                  scope="col"
                  className={`table-header-cell ${
                    column.align === 'center'
                      ? 'text-center'
                      : column.align === 'right'
                        ? 'text-right'
                        : 'text-left'
                  }`}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <motion.tbody
            className="divide-y divide-[var(--brand-border)] bg-[var(--brand-surface)]"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {data.map((row, rowIndex) => (
              <motion.tr
                key={rowIndex}
                variants={staggerItem}
                className={`transition-colors duration-150 ${
                  onRowClick
                    ? 'cursor-pointer hover:bg-[var(--brand-surface-secondary)] focus-within:bg-[var(--brand-surface-secondary)] touch-target'
                    : 'hover:bg-[var(--brand-surface-secondary)]/50'
                }`}
                onClick={() => {
                  if (onRowClick) {
                    onRowClick(row);
                  }
                }}
                tabIndex={onRowClick ? 0 : undefined}
                onKeyDown={(event) => {
                  if (onRowClick && (event.key === 'Enter' || event.key === ' ')) {
                    event.preventDefault();
                    onRowClick(row);
                  }
                }}
              >
                {columns.map((column, columnIndex) => {
                  const key = column.key ? String(column.key) : `${rowIndex}-${columnIndex}`;
                  const value = column.key
                    ? (row as Record<string, unknown>)[column.key as string]
                    : undefined;
                  return (
                    <td
                      key={key}
                      className={`table-cell ${
                        column.align === 'center'
                          ? 'text-center'
                          : column.align === 'right'
                            ? 'text-right'
                            : 'text-left'
                      }`}
                    >
                      {column.render
                        ? column.render(row, rowIndex, columnIndex)
                        : isValidElement(value)
                          ? value
                          : value === null || value === undefined
                            ? ''
                            : typeof value === 'object'
                              ? JSON.stringify(value)
                              : String(value)}
                    </td>
                  );
                })}
              </motion.tr>
            ))}
          </motion.tbody>
        </table>
      </div>
    </motion.div>
  );
}

const MemoizedTable = memo(TableComponent) as typeof TableComponent;

export const Table = MemoizedTable;
export default MemoizedTable;
