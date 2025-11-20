import { useMemo, useState } from 'react';
import { useMutationWithInvalidation, queryKeys } from '../../hooks/useQuery';
import { useExams } from '../../hooks/queries/useAdminQueries';
import { useQuery } from '../../hooks/useQuery';
import { DataTable, type DataTableColumn } from '../../components/tables/DataTable';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { DatePicker } from '../../components/ui/DatePicker';
import { Modal } from '../../components/ui/Modal';
import { api, type ExamSummary, type GradeScale } from '../../lib/api';
import RouteMeta from '../../components/layout/RouteMeta';
import type { FormEvent } from 'react';
import { formatDate } from '../../lib/utils/date';

export default function AdminExamConfigPage() {
  const [showExamModal, setShowExamModal] = useState(false);
  const [showScaleModal, setShowScaleModal] = useState(false);
  const [examForm, setExamForm] = useState({ name: '', description: '', examDate: '' });

  const { data: examsData, isLoading: examsLoading } = useExams();
  const { data: gradeScalesData, isLoading: scalesLoading } = useQuery(
    queryKeys.admin.gradeScales(),
    () => api.getGradeScales()
  );

  const exams = useMemo(() => examsData || [], [examsData]);
  const gradeScales = useMemo(() => gradeScalesData || [], [gradeScalesData]);

  const createExamMutation = useMutationWithInvalidation(
    async (payload: { name: string; description?: string; examDate?: string }) => {
      await api.createExam(payload);
    },
    [queryKeys.admin.exams()] as unknown as unknown[][],
    { successMessage: 'Exam created successfully' }
  );

  const deleteExamMutation = useMutationWithInvalidation(
    async (examId: string) => {
      await api.deleteExam(examId);
    },
    [queryKeys.admin.exams()] as unknown as unknown[][],
    { successMessage: 'Exam deleted successfully' }
  );

  const examColumns: DataTableColumn<ExamSummary>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Exam Name',
        render: (row) => row.name,
        sortable: true
      },
      {
        key: 'examDate',
        header: 'Date',
        render: (row) => formatDate(row.examDate),
        sortable: true
      },
      {
        key: 'classes',
        header: 'Classes',
        render: (row) => `${row.classes || 0} classes`
      },
      {
        key: 'actions',
        header: 'Actions',
        render: (row) => (
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                if (window.confirm(`Delete exam "${row.name}"? This will also delete all associated exam sessions.`)) {
                  deleteExamMutation.mutate(row.id);
                }
              }}
              loading={deleteExamMutation.isPending}
            >
              Delete
            </Button>
          </div>
        )
      }
    ],
    [deleteExamMutation]
  );

  const handleCreateExam = async (e: FormEvent) => {
    e.preventDefault();
    createExamMutation.mutate({
      name: examForm.name,
      description: examForm.description || undefined,
      examDate: examForm.examDate || undefined
    });
    setShowExamModal(false);
    setExamForm({ name: '', description: '', examDate: '' });
  };

  return (
    <RouteMeta title="Exam Configuration">
      <div className="space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[var(--brand-surface-contrast)]">
              Exam Configuration
            </h1>
            <p className="mt-1 text-sm text-[var(--brand-muted)]">
              Manage exams and grading scales
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowScaleModal(true)}>
              Manage Grade Scales
            </Button>
            <Button onClick={() => setShowExamModal(true)}>Create Exam</Button>
          </div>
        </header>

        {/* Exams Table */}
        <div className="rounded-xl border border-[var(--brand-border)] bg-[var(--brand-surface)]/80 p-6 shadow-sm">
          <DataTable<ExamSummary>
            data={exams}
            columns={examColumns}
            pagination={{ pageSize: 10, showSizeSelector: true }}
            emptyMessage="No exams configured"
            loading={examsLoading}
          />
        </div>

        {/* Create Exam Modal */}
        {showExamModal && (
          <Modal
            title="Create New Exam"
            isOpen={showExamModal}
            onClose={() => {
              setShowExamModal(false);
              setExamForm({ name: '', description: '', examDate: '' });
            }}
          >
            <form onSubmit={handleCreateExam} className="space-y-4">
              <Input
                label="Exam Name"
                value={examForm.name}
                onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                required
              />
              <Input
                label="Description"
                value={examForm.description}
                onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
              />
              <DatePicker
                label="Exam Date"
                value={examForm.examDate}
                onChange={(e) => setExamForm({ ...examForm, examDate: e.target.value })}
              />
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowExamModal(false);
                    setExamForm({ name: '', description: '', examDate: '' });
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={createExamMutation.isPending}>
                  Create
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Grade Scales Modal */}
        {showScaleModal && (
          <Modal
            title="Grade Scales"
            isOpen={showScaleModal}
            onClose={() => setShowScaleModal(false)}
          >
            <div className="space-y-4">
              {scalesLoading ? (
                <p className="text-sm text-[var(--brand-muted)]">Loading grade scales...</p>
              ) : gradeScales.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-[var(--brand-surface-contrast)] mb-3">
                    Current Grade Scales
                  </p>
                  <div className="rounded-lg border border-[var(--brand-border)] overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-[var(--brand-surface-secondary)]">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--brand-surface-contrast)]">
                            Min Score
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--brand-surface-contrast)]">
                            Max Score
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--brand-surface-contrast)]">
                            Grade
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-[var(--brand-surface-contrast)]">
                            Remark
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[var(--brand-border)]">
                        {gradeScales.map((scale: GradeScale, idx: number) => (
                          <tr key={idx} className="hover:bg-[var(--brand-surface-secondary)]/50">
                            <td className="px-4 py-2 text-[var(--brand-surface-contrast)]">
                              {scale.min_score}
                            </td>
                            <td className="px-4 py-2 text-[var(--brand-surface-contrast)]">
                              {scale.max_score}
                            </td>
                            <td className="px-4 py-2 font-semibold text-[var(--brand-primary)]">
                              {scale.grade}
                            </td>
                            <td className="px-4 py-2 text-[var(--brand-muted)]">
                              {scale.remark || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-[var(--brand-muted)] mt-3">
                    Grade scales are configured at the system level. Contact your administrator to
                    modify grade scales.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-[var(--brand-muted)]">
                  No grade scales configured. Grade scales will be set up by the system
                  administrator.
                </p>
              )}
              <div className="flex justify-end">
                <Button variant="outline" onClick={() => setShowScaleModal(false)}>
                  Close
                </Button>
              </div>
            </div>
          </Modal>
        )}
      </div>
    </RouteMeta>
  );
}
