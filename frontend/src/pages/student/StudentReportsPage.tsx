import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import RouteMeta from '../../components/layout/RouteMeta';
import { StatusBanner } from '../../components/ui/StatusBanner';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { Table, type TableColumn } from '../../components/ui/Table';
import { api, type StudentTermReportRecord, type StudentTermSummary } from '../../lib/api';

export default function StudentReportsPage() {
  const [terms, setTerms] = useState<StudentTermSummary[]>([]);
  const [reports, setReports] = useState<StudentTermReportRecord[]>([]);
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const [termList, reportList] = await Promise.all([
          api.student.listTerms(),
          api.student.listReports(),
        ]);
        if (cancelled) return;
        setTerms(termList);
        setReports(reportList);
        if (termList.length > 0) {
          setSelectedTermId(termList[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const tableColumns: TableColumn<StudentTermReportRecord>[] = [
    {
      header: 'Report ID',
      key: 'id',
    },
    {
      header: 'Term',
      render: (row) => terms.find((term) => term.id === row.termId)?.name ?? 'Archived term',
    },
    {
      header: 'Generated on',
      render: (row) => new Date(row.generatedAt).toLocaleString(),
    },
    {
      header: 'Actions',
      render: (row) => (
        <Button variant="ghost" size="sm" onClick={() => void downloadReport(row.id)}>
          Download PDF
        </Button>
      ),
    },
  ];

  const generateReport = async () => {
    if (!selectedTermId) {
      toast.error('Select a term before generating a report.');
      return;
    }
    setGenerating(true);
    try {
      await api.student.generateTermReport(selectedTermId);
      toast.success('Report generation started. Refresh to see the latest copy.');
      const reportList = await api.student.listReports();
      setReports(reportList);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const downloadReport = async (reportId: string) => {
    try {
      const blob = await api.student.downloadTermReport(reportId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `term-report-${reportId}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  if (error) {
    return (
      <RouteMeta title="Reports">
        <StatusBanner status="error" message={error} />
      </RouteMeta>
    );
  }

  return (
    <RouteMeta title="Reports">
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
            Term performance reports
          </h1>
          <p className="text-sm text-[var(--brand-muted)]">
            Generate downloadable summaries that include attendance, academics, and fee stats for
            each term.
          </p>
        </header>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <header className="mb-4 flex flex-wrap items-center gap-3">
            <Select
              label="Term"
              value={selectedTermId}
              onChange={(event) => setSelectedTermId(event.target.value)}
              options={terms.map((term) => ({
                value: term.id,
                label: term.name,
              }))}
              disabled={terms.length === 0}
            />
            <Button onClick={generateReport} loading={generating} disabled={terms.length === 0}>
              Generate report
            </Button>
            <Button
              variant="outline"
              onClick={async () => {
                setLoading(true);
                try {
                  setReports(await api.student.listReports());
                  toast.success('Reports refreshed.');
                } catch (refreshError) {
                  toast.error((refreshError as Error).message);
                } finally {
                  setLoading(false);
                }
              }}
            >
              Refresh list
            </Button>
          </header>

          {terms.length === 0 ? (
            <StatusBanner status="info" message="No academic terms available yet." />
          ) : null}
        </section>

        <section className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <Table
            columns={tableColumns}
            data={reports}
            caption="Generated reports"
            emptyMessage={loading ? 'Loading reports…' : 'No reports generated yet.'}
          />
        </section>
      </div>
    </RouteMeta>
  );
}
