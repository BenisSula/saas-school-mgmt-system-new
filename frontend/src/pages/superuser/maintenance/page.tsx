import { useState } from 'react';
import { RouteMeta } from '../../../components/layout/RouteMeta';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { api } from '../../../lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Database,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Trash2,
  Activity,
} from 'lucide-react';

export default function SuperuserMaintenancePage() {
  const queryClient = useQueryClient();
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);

  // Fetch schools for selection
  const { data: schools, isLoading: schoolsLoading } = useQuery({
    queryKey: ['superuser', 'schools'],
    queryFn: () => api.superuser.listSchools(),
  });

  // Fetch schema health
  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ['superuser', 'maintenance', 'schema-health', selectedTenantId],
    queryFn: () => api.superuser.checkSchemaHealth(selectedTenantId || undefined),
    enabled: true,
  });

  // Run migrations mutation
  const runMigrationsMutation = useMutation({
    mutationFn: (tenantId: string | null) => api.superuser.runMigrations(tenantId),
    onSuccess: (data) => {
      if (data.data.success) {
        toast.success(`Successfully ran migrations for ${data.data.migrationsRun} tenant(s)`);
      } else {
        toast.warning(`Migrations completed with errors: ${data.data.errors.join(', ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['superuser', 'maintenance'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to run migrations: ${error.message}`);
    },
  });

  // Clear cache mutation
  const clearCacheMutation = useMutation({
    mutationFn: (schoolId: string) => api.superuser.clearCache(schoolId),
    onSuccess: (data) => {
      if (data.data.success) {
        toast.success(`Successfully cleared ${data.data.clearedKeys} cache key(s)`);
      } else {
        toast.error(`Failed to clear cache: ${data.data.errors.join(', ')}`);
      }
      queryClient.invalidateQueries({ queryKey: ['superuser', 'maintenance'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to clear cache: ${error.message}`);
    },
  });

  const handleRunMigrations = () => {
    if (
      selectedTenantId &&
      !confirm(
        `Are you sure you want to run migrations for this tenant? This may take several minutes.`
      )
    ) {
      return;
    }
    if (
      !selectedTenantId &&
      !confirm(
        `Are you sure you want to run migrations for ALL tenants? This may take a very long time.`
      )
    ) {
      return;
    }
    runMigrationsMutation.mutate(selectedTenantId);
  };

  const handleClearCache = () => {
    if (!selectedSchoolId) {
      toast.error('Please select a school first');
      return;
    }
    if (
      !confirm(
        `Are you sure you want to clear the cache for this school? This may temporarily slow down requests.`
      )
    ) {
      return;
    }
    clearCacheMutation.mutate(selectedSchoolId);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'degraded':
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'unhealthy':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'unhealthy':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (schoolsLoading || healthLoading) {
    return (
      <RouteMeta title="Maintenance">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Maintenance">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Platform Maintenance
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Run migrations, clear cache, and check schema health across all tenants.
            </p>
          </div>
        </header>

        {/* Run Migrations Section */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Database className="h-6 w-6 text-[var(--brand-primary)]" />
              <h2 className="text-xl font-semibold">Run Migrations</h2>
            </div>
            <p className="text-sm text-[var(--brand-muted)] mb-4">
              Run database migrations for a specific tenant or all tenants. This will apply any
              pending schema changes.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select Tenant (Optional)</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={selectedTenantId || ''}
                  onChange={(e) => setSelectedTenantId(e.target.value || null)}
                >
                  <option value="">All Tenants</option>
                  {schools?.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[var(--brand-muted)] mt-1">
                  Leave empty to run for all tenants
                </p>
              </div>

              <Button
                onClick={handleRunMigrations}
                disabled={runMigrationsMutation.isPending}
                leftIcon={
                  runMigrationsMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )
                }
              >
                {runMigrationsMutation.isPending ? 'Running Migrations...' : 'Run Migrations'}
              </Button>

              {runMigrationsMutation.data && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <p className="font-medium mb-2">Migration Results:</p>
                  <ul className="text-sm space-y-1">
                    <li>Migrations Run: {runMigrationsMutation.data.data.migrationsRun}</li>
                    <li>Duration: {runMigrationsMutation.data.data.duration}ms</li>
                    {runMigrationsMutation.data.data.errors.length > 0 && (
                      <li className="text-red-600">
                        Errors: {runMigrationsMutation.data.data.errors.join(', ')}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Clear Cache Section */}
        <Card>
          <div className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <Trash2 className="h-6 w-6 text-[var(--brand-primary)]" />
              <h2 className="text-xl font-semibold">Clear Cache</h2>
            </div>
            <p className="text-sm text-[var(--brand-muted)] mb-4">
              Clear cached data for a specific school. This will force fresh data to be loaded on
              the next request.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Select School</label>
                <select
                  className="w-full px-3 py-2 border rounded-md"
                  value={selectedSchoolId || ''}
                  onChange={(e) => setSelectedSchoolId(e.target.value || null)}
                >
                  <option value="">Select a school</option>
                  {schools?.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              </div>

              <Button
                onClick={handleClearCache}
                disabled={clearCacheMutation.isPending || !selectedSchoolId}
                variant="outline"
                leftIcon={
                  clearCacheMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )
                }
              >
                {clearCacheMutation.isPending ? 'Clearing Cache...' : 'Clear Cache'}
              </Button>

              {clearCacheMutation.data && (
                <div className="mt-4 p-4 bg-gray-50 rounded-md">
                  <p className="font-medium mb-2">Cache Clear Results:</p>
                  <ul className="text-sm space-y-1">
                    <li>Cleared Keys: {clearCacheMutation.data.data.clearedKeys}</li>
                    {clearCacheMutation.data.data.errors.length > 0 && (
                      <li className="text-red-600">
                        Errors: {clearCacheMutation.data.data.errors.join(', ')}
                      </li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Schema Health Section */}
        <Card>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-[var(--brand-primary)]" />
                <h2 className="text-xl font-semibold">Schema Health</h2>
              </div>
              <Button
                onClick={() => refetchHealth()}
                variant="outline"
                size="sm"
                leftIcon={<RefreshCw className="h-4 w-4" />}
              >
                Refresh
              </Button>
            </div>
            <p className="text-sm text-[var(--brand-muted)] mb-4">
              Check the health status of tenant database schemas. Identifies missing tables, schema
              issues, and migration status.
            </p>

            {healthData?.summary && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="text-center p-3 bg-gray-50 rounded-md">
                  <p className="text-2xl font-bold">{healthData.summary.total}</p>
                  <p className="text-xs text-gray-600">Total</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-md">
                  <p className="text-2xl font-bold text-green-600">{healthData.summary.healthy}</p>
                  <p className="text-xs text-gray-600">Healthy</p>
                </div>
                <div className="text-center p-3 bg-yellow-50 rounded-md">
                  <p className="text-2xl font-bold text-yellow-600">
                    {healthData.summary.degraded}
                  </p>
                  <p className="text-xs text-gray-600">Degraded</p>
                </div>
                <div className="text-center p-3 bg-red-50 rounded-md">
                  <p className="text-2xl font-bold text-red-600">{healthData.summary.unhealthy}</p>
                  <p className="text-xs text-gray-600">Unhealthy</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {healthData?.data.map((health) => (
                <div
                  key={health.tenantId}
                  className={`p-4 border rounded-md ${getStatusColor(health.status)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {getStatusIcon(health.status)}
                        <h3 className="font-semibold">
                          {schools?.find((s) => s.id === health.tenantId)?.name ||
                            health.schemaName}
                        </h3>
                        <span className="text-xs px-2 py-1 bg-white rounded">
                          {health.status.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-sm mb-2">
                        Schema: <code className="text-xs">{health.schemaName}</code>
                      </p>
                      <p className="text-sm mb-2">Tables: {health.tableCount}</p>
                      {health.lastMigration && (
                        <p className="text-xs text-gray-600">
                          Last Migration: {health.lastMigration}
                        </p>
                      )}
                      {health.issues.length > 0 && (
                        <div className="mt-2">
                          <p className="text-sm font-medium mb-1">Issues:</p>
                          <ul className="text-sm list-disc list-inside space-y-1">
                            {health.issues.map((issue, idx) => (
                              <li key={idx}>{issue}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    </RouteMeta>
  );
}
