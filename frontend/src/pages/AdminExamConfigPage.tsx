import Table from '../components/Table';
import type { TableColumn } from '../components/Table';
import { Button } from '../components/Button';
import { DatePicker } from '../components/DatePicker';

type ExamRow = {
  id: string;
  name: string;
  examDate: string;
  classes: number;
};

type ScaleRow = {
  grade: string;
  min: number;
  max: number;
  remark: string;
};

const upcomingExams: ExamRow[] = [
  { id: 'exam-1', name: 'Term 1 Assessment', examDate: '2025-02-15', classes: 6 },
  { id: 'exam-2', name: 'Mock Finals', examDate: '2025-05-12', classes: 4 }
];

const defaultScale: ScaleRow[] = [
  { grade: 'A+', min: 90, max: 100, remark: 'Outstanding' },
  { grade: 'A', min: 80, max: 89.99, remark: 'Excellent' },
  { grade: 'B', min: 70, max: 79.99, remark: 'Very Good' },
  { grade: 'C', min: 60, max: 69.99, remark: 'Good' },
  { grade: 'D', min: 50, max: 59.99, remark: 'Satisfactory' },
  { grade: 'F', min: 0, max: 49.99, remark: 'Needs Support' }
];

export function AdminExamConfigPage() {
  const examColumns: TableColumn<ExamRow>[] = [
    { header: 'Exam', key: 'name' },
    { header: 'Exam Date', render: (row) => new Date(row.examDate).toLocaleDateString() },
    { header: 'Classes', render: (row) => row.classes.toString() }
  ];

  const scaleColumns: TableColumn<ScaleRow>[] = [
    { header: 'Grade', key: 'grade' },
    { header: 'Min', render: (row) => row.min.toFixed(2) },
    { header: 'Max', render: (row) => row.max.toFixed(2) },
    { header: 'Remarks', key: 'remark' }
  ];

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-800 bg-slate-900/80 p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-white">Examination Configuration</h1>
            <p className="text-sm text-slate-400">
              Schedule exams, manage sessions, and maintain grade boundaries for each tenant.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <DatePicker label="New Exam Date" />
            <Button>Create Exam</Button>
          </div>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Upcoming Exams</h2>
          <Button variant="outline">Import Schedule</Button>
        </div>
        <Table columns={examColumns} data={upcomingExams} emptyMessage="No exams scheduled yet." />
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Grade Scale</h2>
          <Button variant="outline">Edit Scale</Button>
        </div>
        <Table
          columns={scaleColumns}
          data={defaultScale}
          emptyMessage="No grade scales configured."
        />
      </section>
    </div>
  );
}

export default AdminExamConfigPage;
