import React from 'react';
import { useBrand } from './BrandProvider';

export interface TableColumn<T> {
  key?: keyof T;
  header: string;
  align?: 'left' | 'center' | 'right';
  render?: (row: T) => React.ReactNode;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  caption?: string;
  emptyMessage?: string;
  onRowClick?: (row: T) => void;
}

export function Table<T>({
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
        } as React.CSSProperties
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
                      ? column.render(row)
                      : React.isValidElement(value) || typeof value === 'object'
                        ? value ?? ''
                        : String(value ?? '')}
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

export default Table;


