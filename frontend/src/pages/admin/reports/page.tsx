/**
 * Admin Reports Page
 * Activity logs, login reports, and performance summaries
 */

import { useState } from 'react';
import RouteMeta from '../../../components/layout/RouteMeta';
import { DashboardSkeleton } from '../../../components/ui/DashboardSkeleton';
import { StatusBanner } from '../../../components/ui/StatusBanner';
import { Input } from '../../../components/ui/Input';
import { Select } from '../../../components/ui/Select';
import { Table, type TableColumn } from '../../../components/ui/Table';
import { FileText, LogIn, TrendingUp } from 'lucide-react';
import {
  useActivityReport,
  useLoginReport,
  usePerformanceReport,
} from '../../../hooks/queries/admin/useAdminReports';
import { useClasses } from '../../../hooks/queries/useClasses';
import { useSubjects } from '../../../hooks/queries/useAdminQueries';

export default function AdminReportsPage() {
  const [activeTab, setActiveTab] = useState('activity');
  const [activityFilters, setActivityFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    action: '',
    limit: 100,
    offset: 0,
  });
  const [loginFilters, setLoginFilters] = useState({
    startDate: '',
    endDate: '',
    userId: '',
    limit: 100,
    offset: 0,
  });
  const [performanceFilters, setPerformanceFilters] = useState({
    classId: '',
    subjectId: '',
    academicYear: '',
  });

  const {
    data: activityData,
    isLoading: activityLoading,
    error: activityError,
  } = useActivityReport(activityFilters);
  const {
    data: loginData,
    isLoading: loginLoading,
    error: loginError,
  } = useLoginReport(loginFilters);
  const {
    data: performanceData,
    isLoading: performanceLoading,
    error: performanceError,
  } = usePerformanceReport(performanceFilters);
  const { data: classesData } = useClasses();
  const { data: subjectsData } = useSubjects();

  interface ActivityLog {
    action: string;
    resourceType: string;
    userId: string;
    createdAt: string;
  }

  interface LoginLog {
    userId: string;
    ipAddress: string;
    success: boolean;
    loginAt: string;
  }

  interface PerformanceData {
    class_name: string;
    subject: string;
    exam_count: number;
    avg_score: number;
    min_score: number;
    max_score: number;
  }

  const activityColumns: TableColumn<ActivityLog>[] = [
    { key: 'action', header: 'Action' },
    { key: 'resourceType', header: 'Resource Type' },
    { key: 'userId', header: 'User ID' },
    {
      key: 'createdAt',
      header: 'Date',
      render: (log) => new Date(log.createdAt).toLocaleString(),
    },
  ];

  const loginColumns: TableColumn<LoginLog>[] = [
    { key: 'userId', header: 'User ID' },
    { key: 'ipAddress', header: 'IP Address' },
    {
      key: 'success',
      header: 'Status',
      render: (log) => (
        <span className={log.success ? 'text-emerald-500' : 'text-red-500'}>
          {log.success ? 'Success' : 'Failed'}
        </span>
      ),
    },
    {
      key: 'loginAt',
      header: 'Date',
      render: (log) => new Date(log.loginAt).toLocaleString(),
    },
  ];

  const performanceColumns: TableColumn<PerformanceData>[] = [
    { key: 'class_name', header: 'Class' },
    { key: 'subject', header: 'Subject' },
    { key: 'exam_count', header: 'Exams' },
    { key: 'avg_score', header: 'Avg Score' },
    { key: 'min_score', header: 'Min Score' },
    { key: 'max_score', header: 'Max Score' },
  ];

  const isLoading = activityLoading || loginLoading || performanceLoading;
  const error = activityError || loginError || performanceError;

  if (isLoading) {
    return (
      <RouteMeta title="Reports">
        <DashboardSkeleton />
      </RouteMeta>
    );
  }

  if (error) {
    return (
      <RouteMeta title="Reports">
        <StatusBanner status="error" message={(error as Error).message} />
      </RouteMeta>
    );
  }

  interface ActivityResponse {
    logs?: ActivityLog[];
    data?: { logs?: ActivityLog[] };
  }

  interface LoginResponse {
    logins?: LoginLog[];
    data?: { logins?: LoginLog[] };
  }

  interface PerformanceResponse {
    classSubjectPerformance?: PerformanceData[];
    data?: { classSubjectPerformance?: PerformanceData[] };
  }

  const activityResponse = activityData as ActivityResponse | undefined;
  const loginResponse = loginData as LoginResponse | undefined;
  const performanceResponse = performanceData as PerformanceResponse | undefined;

  const activityLogs = (activityResponse?.logs ||
    activityResponse?.data?.logs ||
    []) as ActivityLog[];
  const loginLogs = (loginResponse?.logins || loginResponse?.data?.logins || []) as LoginLog[];
  const performanceDataRows = (performanceResponse?.classSubjectPerformance ||
    performanceResponse?.data?.classSubjectPerformance ||
    []) as PerformanceData[];

  return (
    <RouteMeta title="Reports">
      <div className="space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">Reports</h1>
          <p className="text-sm text-[var(--brand-muted)]">
            View activity logs, login reports, and performance summaries
          </p>
        </header>

        {/* Simple Tabs Implementation */}
        <div className="space-y-4">
          <div className="flex gap-2 border-b border-[var(--brand-border)]">
            <button
              className={`px-4 py-2 border-b-2 ${
                activeTab === 'activity'
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                  : 'border-transparent'
              }`}
              onClick={() => setActiveTab('activity')}
            >
              <FileText className="h-4 w-4 inline mr-2" />
              Activity Logs
            </button>
            <button
              className={`px-4 py-2 border-b-2 ${
                activeTab === 'logins'
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                  : 'border-transparent'
              }`}
              onClick={() => setActiveTab('logins')}
            >
              <LogIn className="h-4 w-4 inline mr-2" />
              Login Reports
            </button>
            <button
              className={`px-4 py-2 border-b-2 ${
                activeTab === 'performance'
                  ? 'border-[var(--brand-primary)] text-[var(--brand-primary)]'
                  : 'border-transparent'
              }`}
              onClick={() => setActiveTab('performance')}
            >
              <TrendingUp className="h-4 w-4 inline mr-2" />
              Performance
            </button>
          </div>

          {activeTab === 'activity' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-4">
                <Input
                  label="Start Date"
                  type="date"
                  value={activityFilters.startDate}
                  onChange={(e) =>
                    setActivityFilters({ ...activityFilters, startDate: e.target.value })
                  }
                />
                <Input
                  label="End Date"
                  type="date"
                  value={activityFilters.endDate}
                  onChange={(e) =>
                    setActivityFilters({ ...activityFilters, endDate: e.target.value })
                  }
                />
                <Input
                  label="User ID"
                  value={activityFilters.userId}
                  onChange={(e) =>
                    setActivityFilters({ ...activityFilters, userId: e.target.value })
                  }
                />
                <Input
                  label="Action"
                  value={activityFilters.action}
                  onChange={(e) =>
                    setActivityFilters({ ...activityFilters, action: e.target.value })
                  }
                />
              </div>
              <Table
                columns={activityColumns}
                data={activityLogs}
                emptyMessage="No activity logs found"
              />
            </div>
          )}

          {activeTab === 'logins' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Input
                  label="Start Date"
                  type="date"
                  value={loginFilters.startDate}
                  onChange={(e) => setLoginFilters({ ...loginFilters, startDate: e.target.value })}
                />
                <Input
                  label="End Date"
                  type="date"
                  value={loginFilters.endDate}
                  onChange={(e) => setLoginFilters({ ...loginFilters, endDate: e.target.value })}
                />
                <Input
                  label="User ID"
                  value={loginFilters.userId}
                  onChange={(e) => setLoginFilters({ ...loginFilters, userId: e.target.value })}
                />
              </div>
              <Table columns={loginColumns} data={loginLogs} emptyMessage="No login logs found" />
            </div>
          )}

          {activeTab === 'performance' && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Select
                  label="Class"
                  value={performanceFilters.classId}
                  onChange={(e) =>
                    setPerformanceFilters({ ...performanceFilters, classId: e.target.value })
                  }
                  options={[
                    { value: '', label: 'All Classes' },
                    ...(classesData || []).map((c) => ({ value: c.id, label: c.name })),
                  ]}
                />
                <Select
                  label="Subject"
                  value={performanceFilters.subjectId}
                  onChange={(e) =>
                    setPerformanceFilters({ ...performanceFilters, subjectId: e.target.value })
                  }
                  options={[
                    { value: '', label: 'All Subjects' },
                    ...(subjectsData || []).map((s) => ({ value: s.id, label: s.name })),
                  ]}
                />
                <Input
                  label="Academic Year"
                  value={performanceFilters.academicYear}
                  onChange={(e) =>
                    setPerformanceFilters({ ...performanceFilters, academicYear: e.target.value })
                  }
                />
              </div>
              <Table
                columns={performanceColumns}
                data={performanceDataRows}
                emptyMessage="No performance data found"
              />
            </div>
          )}
        </div>
      </div>
    </RouteMeta>
  );
}
