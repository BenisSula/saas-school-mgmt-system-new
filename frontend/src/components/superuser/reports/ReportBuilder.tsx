import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
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
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [dataSources, setDataSources] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<Column[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [groupBy, setGroupBy] = useState<string[]>([]);
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

    setLoading(true);
    setError(null);

    try {
      const report = await api.createCustomReport({
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
    <div className="report-builder p-6 bg-white rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-4">Custom Report Builder</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Report Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            placeholder="Enter report name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded"
            rows={3}
            placeholder="Enter report description"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Data Sources *</label>
          <div className="flex flex-wrap gap-2">
            {availableTables.map((table) => (
              <label key={table} className="flex items-center">
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
                  className="mr-2"
                />
                {table}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Columns *</label>
          {selectedColumns.map((col, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <select
                value={col.table}
                onChange={(e) => {
                  const updated = [...selectedColumns];
                  updated[index].table = e.target.value;
                  setSelectedColumns(updated);
                }}
                className="px-3 py-2 border rounded"
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
                className="flex-1 px-3 py-2 border rounded"
                placeholder="Column name"
              />
              <select
                value={col.aggregate || ''}
                onChange={(e) => {
                  const updated = [...selectedColumns];
                  updated[index].aggregate = e.target.value as Column['aggregate'] | undefined;
                  setSelectedColumns(updated);
                }}
                className="px-3 py-2 border rounded"
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
                className="px-3 py-2 bg-red-500 text-white rounded"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={handleAddColumn}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Add Column
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Filters</label>
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
                className="flex-1 px-3 py-2 border rounded"
                placeholder="Column"
              />
              <select
                value={filter.operator}
                onChange={(e) => {
                  const updated = [...filters];
                  updated[index].operator = e.target.value as Filter['operator'];
                  setFilters(updated);
                }}
                className="px-3 py-2 border rounded"
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
                className="flex-1 px-3 py-2 border rounded"
                placeholder="Value"
              />
              <button
                onClick={() => handleRemoveFilter(index)}
                className="px-3 py-2 bg-red-500 text-white rounded"
              >
                Remove
              </button>
            </div>
          ))}
          <button
            onClick={handleAddFilter}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded"
          >
            Add Filter
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Visualization Type</label>
          <select
            value={visualizationType}
            onChange={(e) => setVisualizationType(e.target.value as typeof visualizationType)}
            className="w-full px-3 py-2 border rounded"
          >
            <option value="table">Table</option>
            <option value="bar">Bar Chart</option>
            <option value="line">Line Chart</option>
            <option value="pie">Pie Chart</option>
            <option value="area">Area Chart</option>
          </select>
        </div>

        <div>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={isShared}
              onChange={(e) => setIsShared(e.target.checked)}
              className="mr-2"
            />
            Share with other users
          </label>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-6 py-2 bg-green-500 text-white rounded disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save Report'}
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-gray-500 text-white rounded"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

