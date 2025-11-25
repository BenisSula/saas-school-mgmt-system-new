import { useQuery } from '@tanstack/react-query';
import { Select } from '../ui/Select';
import { api } from '../../lib/api';
import { Building2 } from 'lucide-react';

export interface TenantSwitcherProps {
  selectedTenantId: string | null;
  onTenantChange: (tenantId: string | null) => void;
  showAllOption?: boolean;
  className?: string;
}

export function TenantSwitcher({
  selectedTenantId,
  onTenantChange,
  showAllOption = true,
  className = '',
}: TenantSwitcherProps) {
  const { data: schools, isLoading } = useQuery({
    queryKey: ['superuser', 'schools'],
    queryFn: async () => {
      return await api.superuser.listSchools();
    },
  });

  const options = [
    ...(showAllOption ? [{ label: 'All Tenants', value: 'all' }] : []),
    ...(schools || []).map((school) => ({
      label: school.name,
      value: school.id,
    })),
  ];

  const handleChange = (value: string) => {
    if (value === 'all') {
      onTenantChange(null);
    } else {
      onTenantChange(value);
    }
  };

  const displayValue = selectedTenantId === null ? 'all' : selectedTenantId;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <Building2 className="h-4 w-4 text-[var(--brand-muted)]" />
      <Select
        label="Filter by Tenant"
        value={displayValue}
        onChange={(e) => handleChange(e.target.value)}
        options={options}
        disabled={isLoading}
        className="min-w-[200px]"
      />
    </div>
  );
}
