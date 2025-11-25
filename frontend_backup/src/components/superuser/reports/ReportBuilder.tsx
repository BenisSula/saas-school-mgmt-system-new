import React, { useState } from 'react';
import { api } from '../../../lib/api';

interface ReportBuilderProps {
  onSave?: (reportId: string) => void;
  onCancel?: () => void;
}

interface Column {
  table: string;
  column: string;
  alias?: string;
  aggregate?: 'sum' | 'avg' | 'count' | 'min' | 'max';
}

interface Filter {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'BETWEEN';
  value: unknown;
}

export const ReportBuilder: React.FC<ReportBuilderProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Column[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [visualizationType, setVisualizationType] = useState<'table' | 'bar' | 'line' | 'pie' | 'area'>('table');
  const [isShared, setIsShared] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const availableTables = [
    'students',
    'teachers',
    'classes',
    'attendance_records',
    'grades',
    'exams',
    'fee_invoices',
    'payments'
  ];

  const handleAddColumn = () => {
    setSelectedColumns([
      ...selectedColumns,
      { table: dataSources[0] || '', column: '' }
    ]);
  };

  const handleRemoveColumn = (index: number) => {
    setSelectedColumns(selectedColumns.filter((_, i) => i !== index));
  };

  const handleAddFilter = () => {
    setFilters([
      ...filters,
      { column: '', operator: '=', value: '' }
    ]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!name || selectedColumns.length === 0 || dataSources.length === 0) {
      setError('Name, data sources, and at least one column are required');
      return;
    }

    // Validate columns
    const invalidColumns = selectedColumns.filter(col => !col.table || !col.column);
    if (invalidColumns.length > 0) {
      setError('All columns must have both table and column name selected');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Auto-determine groupBy: if aggregations are used, group by non-aggregated columns
      const hasAggregations = selectedColumns.some(col => col.aggregate);
      let groupBy: string[] = [];
      
      if (hasAggregations) {
        // Group by non-aggregated columns
        groupBy = selectedColumns
          .filter(col => !col.aggregate)
          .map(col => col.column);
      }

      const report = await api.reports.createCustomReport({
        name,
        description,
        dataSources,
        selectedColumns,
        filters,
        groupBy,
        visualizationType,
        isShared
      });

      onSave?.(report.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="report-builder p-6 bg-[var(--brand-surface)] rounded-lg shadow-md border border-[var(--brand-border)]">
      <h2 className="text-2xl font-bold mb-4 text-[var(--brand-text-primary)]">Custom Report Builder</h2>

      {error && (
        <div className="mb-4 p-3 bg-[var(--brand-error)]/10 text-[var(--brand-error)] border border-[var(--brand-error)]/20 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">Report Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
            placeholder="Enter report name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
            rows={3}
            placeholder="Enter report description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">Data Sources *</label>
          <div className="flex flex-wrap gap-2">
            {availableTables.map((table) => (
              <label key={table} className="flex items-center text-[var(--brand-text-primary)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={dataSources.includes(table)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setDataSources([...dataSources, table]);
                    } else {
                      setDataSources(dataSources.filter(t => t !== table));
                    }
                  }}
                  className="mr-2 accent-[var(--brand-primary)]"
                />
                {table}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">Columns *</label>
          {selectedColumns.map((col, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <select
                value={col.table}
                onChange={(e) => {
                  const updated = [...selectedColumns];
                  updated[index].table = e.target.value;
                  setSelectedColumns(updated);
                }}
                aria-label="Select table"
                className="px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              >
                <option value="">Select table</option>
                {dataSources.map(table => (
                  <option key={table} value={table}>{table}</option>
                ))}
              </select>
              <input
                type="text"
                value={col.column}
                onChange={(e) => {
                  const updated = [...selectedColumns];
                  updated[index].column = e.target.value;
                  setSelectedColumns(updated);
                }}
                className="flex-1 px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                placeholder="Column name"
              />
              <select
                value={col.aggregate || ''}
                onChange={(e) => {
                  const updated = [...selectedColumns];
                  updated[index].aggregate = e.target.value as Column['aggregate'] | undefined;
                  setSelectedColumns(updated);
                }}
                aria-label="Select aggregate function"
                className="px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              >
                <option value="">No aggregate</option>
                <option value="sum">SUM</option>
                <option value="avg">AVG</option>
                <option value="count">COUNT</option>
                <option value="min">MIN</option>
                <option value="max">MAX</option>
              </select>
              <button
                onClick={() => handleRemoveColumn(index)}
                className="px-3 py-2 bg-[var(--brand-error)] text-[var(--brand-error-contrast)] rounded hover:opacity-90 transition-opacity"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={handleAddColumn}
            className="mt-2 px-4 py-2 bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)] rounded hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            Add Column
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">Filters</label>
          {filters.map((filter, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={filter.column}
                onChange={(e) => {
                  const updated = [...filters];
                  updated[index].column = e.target.value;
                  setFilters(updated);
                }}
                className="flex-1 px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                placeholder="Column"
              />
              <select
                value={filter.operator}
                onChange={(e) => {
                  const updated = [...filters];
                  updated[index].operator = e.target.value as Filter['operator'];
                  setFilters(updated);
                }}
                aria-label="Select filter operator"
                className="px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
              >
                <option value="=">=</option>
                <option value="!=">!=</option>
                <option value=">">&gt;</option>
                <option value="<">&lt;</option>
                <option value=">=">&gt;=</option>
                <option value="<=">&lt;=</option>
                <option value="LIKE">LIKE</option>
                <option value="IN">IN</option>
                <option value="BETWEEN">BETWEEN</option>
              </select>
              <input
                type="text"
                value={String(filter.value)}
                onChange={(e) => {
                  const updated = [...filters];
                  updated[index].value = e.target.value;
                  setFilters(updated);
                }}
                className="flex-1 px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] placeholder:text-[var(--brand-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
                placeholder="Value"
              />
              <button
                onClick={() => handleRemoveFilter(index)}
                className="px-3 py-2 bg-[var(--brand-error)] text-[var(--brand-error-contrast)] rounded hover:opacity-90 transition-opacity"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={handleAddFilter}
            className="mt-2 px-4 py-2 bg-[var(--brand-primary)] text-[var(--brand-primary-contrast)] rounded hover:bg-[var(--brand-primary-hover)] transition-colors"
          >
            Add Filter
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-[var(--brand-text-primary)]">Visualization Type</label>
          <select
            value={visualizationType}
            onChange={(e) => setVisualizationType(e.target.value as typeof visualizationType)}
            aria-label="Select visualization type"
            className="w-full px-3 py-2 border border-[var(--brand-border)] rounded bg-[var(--brand-surface-secondary)] text-[var(--brand-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:border-transparent"
          >
            <option value="table">Table</option>
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="area">Area Chart</option>
          </select>
        </div>

        <div>
          <label className="flex items-center text-[var(--brand-text-primary)] cursor-pointer">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="mr-2 accent-[var(--brand-primary)]"
            />
            Share with other users
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-[var(--brand-success)] text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {loading ? 'Saving...' : 'Save Report'}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-[var(--brand-surface-tertiary)] text-[var(--brand-surface-contrast)] rounded hover:bg-[var(--brand-border-strong)] transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

