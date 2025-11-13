import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { BrandProvider } from '../components/ui/BrandProvider';
import { AuthProvider } from '../context/AuthContext';
import * as AuthContextModule from '../context/AuthContext';
import { api, type PlatformOverview } from '../lib/api';

type MockAuthModule = {
  __mockAuthState: {
    user: { role: string };
  };
};

const mockAuthState = (AuthContextModule as unknown as MockAuthModule).__mockAuthState;

const renderApp = (initialEntries: string[]) =>
  render(
    <MemoryRouter initialEntries={initialEntries}>
      <BrandProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrandProvider>
    </MemoryRouter>
  );

describe('Dashboard routing', () => {
  beforeEach(() => {
    window.localStorage.clear();
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query === '(min-width: 1024px)',
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn()
      }))
    });
    vi.spyOn(api, 'listClasses').mockResolvedValue([
      { id: 'class-1', name: 'Grade 7', description: null }
    ]);
    vi.spyOn(api.admin, 'listSubjects').mockResolvedValue([
      { id: 'subject-1', name: 'Mathematics', code: 'MATH', description: null }
    ]);
    vi.spyOn(api, 'listTeachers').mockResolvedValue([
      {
        id: 'teacher-1',
        name: 'Ms. Jane',
        email: 'teacher@example.com',
        subjects: [],
        assigned_classes: []
      }
    ]);
    vi.spyOn(api, 'listStudents').mockResolvedValue([
      {
        id: 'student-1',
        first_name: 'Alex',
        last_name: 'Johnson',
        class_id: 'class-1',
        admission_number: 'ADM-1'
      }
    ]);
    vi.spyOn(api.admin, 'listTeacherAssignments').mockResolvedValue([]);
    vi.spyOn(api.admin, 'getClassSubjects').mockResolvedValue([]);
    vi.spyOn(api.admin, 'getStudentSubjects').mockResolvedValue([]);
    vi.spyOn(api, 'listTerms').mockResolvedValue([
      { id: 'term-1', name: 'Term 1', starts_on: '2025-01-01', ends_on: '2025-03-31' }
    ]);
    vi.spyOn(api.admin, 'setClassSubjects').mockResolvedValue([]);
    vi.spyOn(api.admin, 'setStudentSubjects').mockResolvedValue([]);
    vi.spyOn(api.admin, 'promoteStudent').mockResolvedValue(undefined);
    vi.spyOn(api.admin, 'assignTeacher').mockResolvedValue({
      id: 'assign-1',
      teacher_id: 'teacher-1',
      teacher_name: 'Ms. Jane',
      class_id: 'class-1',
      class_name: 'Grade 7',
      subject_id: 'subject-1',
      subject_name: 'Mathematics',
      is_class_teacher: false
    });
    vi.spyOn(api.admin, 'removeTeacherAssignment').mockResolvedValue(undefined);
    vi.spyOn(api.admin, 'exportTermReport').mockResolvedValue(new Blob());
    vi.spyOn(api.teacher, 'getOverview').mockResolvedValue({
      teacher: { id: 'teacher-1', name: 'Ms Teacher', email: 'teacher@example.com' },
      summary: {
        totalClasses: 1,
        totalSubjects: 1,
        classTeacherRoles: 1,
        pendingDropRequests: 0
      },
      assignments: [
        {
          assignmentId: 'assign-1',
          classId: 'class-1',
          className: 'Grade 7',
          subjectId: 'subject-1',
          subjectName: 'Mathematics',
          subjectCode: 'MATH',
          isClassTeacher: true,
          metadata: {}
        }
      ]
    });
    vi.spyOn(api.teacher, 'listClasses').mockResolvedValue([
      {
        id: 'class-1',
        name: 'Grade 7',
        isClassTeacher: true,
        subjects: [{ id: 'subject-1', name: 'Mathematics', code: 'MATH', assignmentId: 'assign-1' }]
      }
    ]);
    vi.spyOn(api.teacher, 'getClassRoster').mockResolvedValue([
      {
        id: 'student-1',
        first_name: 'Alex',
        last_name: 'Johnson',
        admission_number: 'ADM-1',
        parent_contacts: [],
        class_id: 'class-1'
      }
    ]);
    vi.spyOn(api.teacher, 'getClassReport').mockResolvedValue({
      class: { id: 'class-1', name: 'Grade 7' },
      studentCount: 1,
      attendance: { present: 1, absent: 0, late: 0, total: 1, percentage: 100 },
      grades: [{ subject: 'Mathematics', entries: 1, average: 90 }],
      fees: { billed: 500, paid: 250, outstanding: 250 },
      generatedAt: new Date().toISOString()
    });
    vi.spyOn(api.teacher, 'downloadClassReportPdf').mockResolvedValue(new Blob());
    vi.spyOn(api.teacher, 'getMessages').mockResolvedValue([]);
    vi.spyOn(api.teacher, 'getProfile').mockResolvedValue({
      id: 'teacher-1',
      name: 'Ms Teacher',
      email: 'teacher@example.com',
      subjects: ['Mathematics'],
      classes: [
        {
          id: 'class-1',
          name: 'Grade 7',
          subjects: ['Mathematics'],
          isClassTeacher: true
        }
      ]
    });
    vi.spyOn(api.teacher, 'dropSubject').mockResolvedValue({
      assignmentId: 'assign-1',
      classId: 'class-1',
      className: 'Grade 7',
      subjectId: 'subject-1',
      subjectName: 'Mathematics',
      subjectCode: 'MATH',
      isClassTeacher: false,
      metadata: { dropRequested: true }
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('updates header title and content when navigating via sidebar', async () => {
    const user = userEvent.setup();
    renderApp(['/dashboard/classes']);

    const headerHeading = await screen.findByRole('heading', {
      level: 1,
      name: /Classes & subjects/i
    });
    expect(headerHeading).toBeInTheDocument();

    const main = screen.getByRole('main');
    expect(main).toBeInTheDocument();
    expect(main).toHaveAttribute('tabindex', '-1');

    const reportsLink = screen.getByRole('button', { name: /Reports \(printable\)/i });
    await user.click(reportsLink);

    await waitFor(() => {
      const mainHeading = within(screen.getByRole('main')).getByRole('heading', {
        level: 1,
        name: /Reports & exports/i
      });
      expect(mainHeading).toBeInTheDocument();
    });

    // Ensure only sidebar navigation remains and header does not duplicate links
    expect(screen.getAllByRole('navigation')).toHaveLength(1);
    expect(screen.getByRole('navigation', { name: /Sidebar navigation/i })).toBeInTheDocument();
  });

  it('renders superuser overview title by default', async () => {
    const previousRole = mockAuthState.user.role;
    mockAuthState.user.role = 'superadmin';
    const overviewSpy = vi.spyOn(api.superuser, 'getOverview').mockResolvedValue({
      totals: {
        schools: 5,
        activeSchools: 4,
        suspendedSchools: 1,
        users: 250,
        pendingUsers: 6
      },
      roleDistribution: {
        admins: 20,
        teachers: 80,
        students: 150
      },
      subscriptionBreakdown: {
        free: 1,
        trial: 2,
        paid: 2
      },
      revenue: {
        total: 125000,
        byTenant: [
          { tenantId: 'tenant_a', amount: 50000 },
          { tenantId: 'tenant_b', amount: 75000 }
        ]
      },
      recentSchools: [
        {
          id: 'tenant_a',
          name: 'North Ridge Academy',
          status: 'active',
          subscriptionType: 'paid',
          createdAt: new Date().toISOString()
        }
      ]
    } as PlatformOverview);
    try {
      renderApp(['/dashboard/superuser/overview']);

      await waitFor(() =>
        expect(
          screen.getByRole('heading', { level: 1, name: /Dashboard overview/i })
        ).toBeInTheDocument()
      );
      expect(await screen.findByText(/Total schools/i)).toBeInTheDocument();
      expect(await screen.findByText(/Subscription mix/i)).toBeInTheDocument();
    } finally {
      overviewSpy.mockRestore();
      mockAuthState.user.role = previousRole;
    }
  });
});
