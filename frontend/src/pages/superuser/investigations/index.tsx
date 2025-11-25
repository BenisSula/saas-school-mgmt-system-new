import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RouteMeta } from '../../../components/layout/RouteMeta';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { InvestigationListTable } from '../../../components/superuser/investigations/InvestigationListTable';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { useInvestigationCases } from '../../../hooks/queries/useInvestigationCases';
import { Plus } from 'lucide-react';
import type { InvestigationCase } from '../../../lib/api';

type FilterStatus = InvestigationCase['status'] | 'all';
type FilterPriority = InvestigationCase['priority'] | 'all';
type FilterCaseType = InvestigationCase['caseType'] | 'all';

interface Filters {
  status: FilterStatus;
  priority: FilterPriority;
  caseType: FilterCaseType;
  search: string;
}

const defaultFilters: Filters = {
  status: 'all',
  priority: 'all',
  caseType: 'all',
  search: '',
};

export function InvestigationListPage() {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [page, setPage] = useState(1);
  const limit = 50;

  const apiFilters = useMemo(() => {
    const result: Parameters<typeof useInvestigationCases>[0] = {
      limit,
      offset: (page - 1) * limit,
    };

    if (filters.status !== 'all') result.status = filters.status;
    if (filters.priority !== 'all') result.priority = filters.priority;
    if (filters.caseType !== 'all') result.caseType = filters.caseType;

    return result;
  }, [filters.status, filters.priority, filters.caseType, page]);

  const { data, isLoading, error } = useInvestigationCases(apiFilters);

  const filteredCases = useMemo(() => {
    if (!data?.cases) return [];
    if (!filters.search) return data.cases;

    const searchLower = filters.search.toLowerCase();
    return data.cases.filter(
      (case_) =>
        case_.caseNumber.toLowerCase().includes(searchLower) ||
        case_.title.toLowerCase().includes(searchLower) ||
        case_.description?.toLowerCase().includes(searchLower) ||
        case_.tags.some((tag) => tag.toLowerCase().includes(searchLower))
    );
  }, [data?.cases, filters.search]);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  return (
    <RouteMeta title="Investigation Cases">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[var(--brand-text-primary)]">
              Investigation Cases
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-text-secondary)]">
              Manage and track security investigations across the platform
            </p>
          </div>
          <Button onClick={() => navigate('/dashboard/superuser/investigations/create')}>
            <Plus className="mr-2 h-4 w-4" />
            New Case
          </Button>
        </div>

        {/* Filters */}
        <div className="card-base p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Search cases..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
            />
            <Select
              value={filters.status}
              onChange={(e) => {
                setFilters({ ...filters, status: e.target.value as FilterStatus });
                setPage(1);
              }}
              options={[
                { label: 'All Statuses', value: 'all' },
                { label: 'Open', value: 'open' },
                { label: 'Investigating', value: 'investigating' },
                { label: 'Resolved', value: 'resolved' },
                { label: 'Closed', value: 'closed' },
              ]}
            />
            <Select
              value={filters.priority}
              onChange={(e) => {
                setFilters({ ...filters, priority: e.target.value as FilterPriority });
                setPage(1);
              }}
              options={[
                { label: 'All Priorities', value: 'all' },
                { label: 'Low', value: 'low' },
                { label: 'Medium', value: 'medium' },
                { label: 'High', value: 'high' },
                { label: 'Critical', value: 'critical' },
              ]}
            />
            <Select
              value={filters.caseType}
              onChange={(e) => {
                setFilters({ ...filters, caseType: e.target.value as FilterCaseType });
                setPage(1);
              }}
              options={[
                { label: 'All Types', value: 'all' },
                { label: 'Anomaly', value: 'anomaly' },
                { label: 'Security', value: 'security' },
                { label: 'Compliance', value: 'compliance' },
                { label: 'Abuse', value: 'abuse' },
                { label: 'Other', value: 'other' },
              ]}
            />
          </div>
        </div>

        {/* Results */}
        {error && (
          <div className="card-base p-4 bg-[var(--brand-error-light)] border border-[var(--brand-error)]">
            <p className="text-sm text-[var(--brand-error)]">
              Error loading cases: {(error as Error).message}
            </p>
          </div>
        )}

        {isLoading ? (
          <DashboardSkeleton />
        ) : (
          <>
            <InvestigationListTable cases={filteredCases} loading={isLoading} />
            {totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-[var(--brand-text-secondary)]">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, data?.total || 0)} of{' '}
                  {data?.total || 0} cases
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </RouteMeta>
  );
}

export default InvestigationListPage;
