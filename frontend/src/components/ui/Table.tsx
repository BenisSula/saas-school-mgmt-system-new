import { isValidElement, memo, type CSSProperties, type ReactNode } from 'react';
import { useBrand } from './BrandProvider';

export interface TableColumn<T> {
  key?: keyof T | string;
  header: string;
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
  onRowClick
}: TableProps<T>) {
  const { tokens } = useBrand();
  if (data.length === 0) {
    return (
      <div className="rounded-md border border-slate-800 bg-slate-900/70 p-6 text-center text-sm text-slate-400">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="overflow-hidden rounded-md border border-slate-800 shadow-sm"
      style={
        {
          '--brand-secondary': tokens.secondary,
          '--brand-secondary-contrast': tokens.secondaryContrast
        } as CSSProperties
      }
    >
      <table className="min-w-full divide-y divide-slate-800 text-left text-sm text-slate-200">
        {caption ? (
          <caption className="bg-slate-900/80 px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-400">
            {caption}
          </caption>
        ) : null}
        <thead className="bg-[var(--brand-secondary)] text-[var(--brand-secondary-contrast)]">
          <tr>
            {columns.map((column, columnIndex) => (
              <th
                key={column.key ? String(column.key) : `header-${columnIndex}`}
                scope="col"
                className={`px-4 py-3 font-semibold uppercase tracking-wide text-xs ${
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
        <tbody className="divide-y divide-slate-800 bg-slate-950/40">
          {data.map((row, rowIndex) => (
            <tr
              key={rowIndex}
              className={`hover:bg-slate-900/70 ${
                onRowClick ? 'cursor-pointer focus-within:bg-slate-900/70' : ''
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
                    className={`px-4 py-3 ${
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const MemoizedTable = memo(TableComponent) as typeof TableComponent;

export const Table = MemoizedTable;
export default MemoizedTable;
