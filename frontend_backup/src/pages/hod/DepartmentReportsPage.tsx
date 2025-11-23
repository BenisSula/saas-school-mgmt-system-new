/**
 * HOD Department Reports Page
 * Displays department-level analytics and performance reports
 */

import { useState, useMemo } from 'react';
import RouteMeta from '../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { StatCard } from '../../components/charts/StatCard';
import { BarChart, type BarChartData } from '../../components/charts/BarChart';
import { LineChart, type LineChartDataPoint } from '../../components/charts/LineChart';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { useHodDepartmentReport } from '../../hooks/queries/hod';
import { Users, GraduationCap, BookOpen, TrendingUp, Activity, Download, RefreshCw } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { createExportHandlers } from '../../hooks/useExport';

export default function DepartmentReportsPage() {
  const [filters, setFilters] = useState<{ term?: string; classId?: string; subjectId?: string }>({});
  const queryClient = useQueryClient();

  const { data: report, isLoading, error } = useHodDepartmentReport(filters);

  const refreshReport = () => {
    queryClient.invalidateQueries({ queryKey: ['hod', 'department-report'] });
  };

  const exportHandlers = createExportHandlers();

  // Performance chart data
  const performanceData: BarChartData[] = useMemo(() => {
    if (!report) return [];
    return [
      {
        label: 'Average Score',
        value: report.performance.avgScore,
        color: 'var(--brand-primary)'
      }
    ];
  }, [report]);

  // Activity trend data
  const activityTrendData: LineChartDataPoint[] = useMemo(() => {
    if (!report) return [];
    return [
      { label: 'Last 7 Days', value: report.activity.last7Days },
      { label: 'Last 30 Days', value: report.activity.last30Days }
    ];
  }, [report]);

  if (isLoading) {
    return (
      <RouteMeta title="Department Reports">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Department Reports">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  if (!report) {
    return (
      <RouteMeta title="Department Reports">
        <StatusBanner status="info" message="No report data available yet." />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Department Reports">
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              {report.department.name} Reports
            </h1>
            <p className="text-sm text-[var(--brand-muted)]">
              Department analytics and performance metrics
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => exportHandlers.exportToCSV(report, `department-report-${Date.now()}.csv`)}
              leftIcon={<Download className="h-4 w-4" />}
              variant="outline"
            >
              Export CSV
            </Button>
            <Button onClick={refreshReport} leftIcon={<RefreshCw className="h-4 w-4" />}>
              Refresh
            </Button>
          </div>
        </header>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="w-full sm:w-48">
            <Select
              value={filters.term || ''}
              onChange={(e) => setFilters({ ...filters, term: e.target.value || undefined })}
              placeholder="Select term"
            >
              <option value="">All Terms</option>
              <option value="term1">Term 1</option>
              <option value="term2">Term 2</option>
              <option value="term3">Term 3</option>
            </Select>
          </div>
          <div className="w-full sm:w-48">
            <Input
              type="text"
              placeholder="Class ID (optional)"
              value={filters.classId || ''}
              onChange={(e) => setFilters({ ...filters, classId: e.target.value || undefined })}
            />
          </div>
          <div className="w-full sm:w-48">
            <Input
              type="text"
              placeholder="Subject ID (optional)"
              value={filters.subjectId || ''}
              onChange={(e) => setFilters({ ...filters, subjectId: e.target.value || undefined })}
            />
          </div>
        </div>

        {/* Summary Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Teachers"
            value={report.summary.teachers}
            icon={<Users className="h-5 w-5" />}
            description="In department"
          />
          <StatCard
            title="Classes"
            value={report.summary.classes}
            icon={<BookOpen className="h-5 w-5" />}
            description="Active classes"
          />
          <StatCard
            title="Students"
            value={report.summary.students}
            icon={<GraduationCap className="h-5 w-5" />}
            description="Total students"
          />
          <StatCard
            title="Avg Performance"
            value={report.performance.avgScore.toFixed(1)}
            icon={<TrendingUp className="h-5 w-5" />}
            description={report.performance.topPerformingClass || 'No data'}
          />
        </section>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <BarChart data={performanceData} title="Average Performance Score" height={250} />
          </div>
          <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
            <LineChart data={activityTrendData} title="Activity Trend" height={250} />
          </div>
        </div>

        {/* Activity Summary */}
        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--brand-surface-contrast)]">
              Activity Summary
            </h2>
          </header>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-border)] bg-black/15 p-4">
              <Activity className="h-5 w-5 text-[var(--brand-primary)]" />
              <div>
                <div className="text-sm text-[var(--brand-muted)]">Last 7 Days</div>
                <div className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
                  {report.activity.last7Days}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border border-[var(--brand-border)] bg-black/15 p-4">
              <Activity className="h-5 w-5 text-[var(--brand-primary)]" />
              <div>
                <div className="text-sm text-[var(--brand-muted)]">Last 30 Days</div>
                <div className="text-xl font-semibold text-[var(--brand-surface-contrast)]">
                  {report.activity.last30Days}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </RouteMeta>
  );
}

