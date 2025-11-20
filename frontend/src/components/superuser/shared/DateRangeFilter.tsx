import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

export interface DateRangeFilterProps {
  startDate: string;
  endDate: string;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  quickRange?: '7' | '30' | '90' | 'all';
  onQuickRangeChange?: (range: '7' | '30' | '90' | 'all') => void;
  className?: string;
}

export function DateRangeFilter({
  startDate,
  endDate,
  onStartDateChange,
  onEndDateChange,
  quickRange,
  onQuickRangeChange,
  className = ''
}: DateRangeFilterProps) {
  const handleQuickRangeChange = (value: string) => {
    if (!onQuickRangeChange) return;
    const range = value as '7' | '30' | '90' | 'all';
    onQuickRangeChange(range);
    
    if (range === 'all') {
      onStartDateChange('');
      onEndDateChange('');
    } else {
      const days = Number(range);
      const to = new Date();
      const from = new Date();
      from.setDate(to.getDate() - days + 1);
      onStartDateChange(from.toISOString().slice(0, 10));
      onEndDateChange(to.toISOString().slice(0, 10));
    }
  };

  return (
    <div className={`grid gap-4 sm:grid-cols-3 ${className}`}>
      {quickRange !== undefined && onQuickRangeChange && (
        <Select
          label="Quick Range"
          value={quickRange}
          onChange={(e) => handleQuickRangeChange(e.target.value)}
          options={[
            { label: 'Last 7 days', value: '7' },
            { label: 'Last 30 days', value: '30' },
            { label: 'Last 90 days', value: '90' },
            { label: 'All time', value: 'all' }
          ]}
        />
      )}
      <Input
        label="Start Date"
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
      />
      <Input
        label="End Date"
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
      />
    </div>
  );
}

