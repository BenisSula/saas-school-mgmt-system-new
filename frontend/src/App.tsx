import React, { useMemo, useState } from 'react';
import HomePage from './pages';
import AdminConfigurationPage from './pages/AdminConfigurationPage';
import AdminReportsPage from './pages/AdminReportsPage';
import AdminRoleManagementPage from './pages/AdminRoleManagementPage';
import StudentFeesPage from './pages/StudentFeesPage';
import TeacherGradeEntryPage from './pages/TeacherGradeEntryPage';
import StudentResultsPage from './pages/StudentResultsPage';
import { Navbar } from './components/ui/Navbar';
import { Sidebar } from './components/ui/Sidebar';
import type { NavLink } from './components/ui/Navbar';

type ViewKey =
  | 'home'
  | 'admin-config'
  | 'admin-reports'
  | 'admin-roles'
  | 'fees'
  | 'teacher-grades'
  | 'student-results';

function App() {
  const [view, setView] = useState<ViewKey>('home');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);

  const activePage = useMemo(() => {
    switch (view) {
      case 'admin-config':
        return <AdminConfigurationPage />;
      case 'admin-reports':
        return <AdminReportsPage />;
      case 'admin-roles':
        return <AdminRoleManagementPage />;
      case 'fees':
        return <StudentFeesPage />;
      case 'teacher-grades':
        return <TeacherGradeEntryPage />;
      case 'student-results':
        return <StudentResultsPage />;
      default:
        return <HomePage />;
    }
  }, [view]);

  const navLinks: NavLink[] = useMemo(
    () => [
      { label: 'Landing', onSelect: () => setView('home'), isActive: view === 'home' },
      {
        label: 'Admin configuration',
        onSelect: () => setView('admin-config'),
        isActive: view === 'admin-config'
      },
      {
        label: 'Reports',
        onSelect: () => setView('admin-reports'),
        isActive: view === 'admin-reports'
      },
      {
        label: 'RBAC manager',
        onSelect: () => setView('admin-roles'),
        isActive: view === 'admin-roles'
      },
      {
        label: 'Teacher grade entry',
        onSelect: () => setView('teacher-grades'),
        isActive: view === 'teacher-grades'
      },
      {
        label: 'Student results',
        onSelect: () => setView('student-results'),
        isActive: view === 'student-results'
      },
      { label: 'Student fees', onSelect: () => setView('fees'), isActive: view === 'fees' }
    ],
    [view]
  );

  const isAdminView = view !== 'home';

  return (
    <div className="min-h-screen bg-[var(--brand-surface, #0f172a)] text-[var(--brand-surface-contrast,#f1f5f9)] transition-colors">
      <Navbar
        brandName="SaaS School Portal"
        links={navLinks}
        onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
        sidebarOpen={sidebarOpen}
      />

      <div className="relative mx-auto flex max-w-6xl">
        <div
          className={`fixed inset-0 z-30 bg-slate-950/70 backdrop-blur-sm transition-opacity sm:hidden ${
            sidebarOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden={!sidebarOpen}
          onClick={() => setSidebarOpen(false)}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-72 transform transition-transform sm:static sm:h-auto sm:w-64 sm:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full sm:translate-x-0'
          }`}
        >
          <Sidebar links={navLinks} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        </aside>
        <main className="relative z-10 flex-1 px-4 py-6 sm:px-8">
          {isAdminView ? <div className="space-y-6">{activePage}</div> : activePage}
        </main>
      </div>

      {!isAdminView ? null : (
        <footer className="border-t border-[var(--brand-border)] bg-[var(--brand-surface)]/90 py-6 text-center text-xs text-slate-400">
          <div className="mx-auto max-w-6xl px-4">
            Built for responsive multi-tenant schools · Keyboard accessible · Powered by schema isolation
          </div>
        </footer>
      )}
    </div>
  );
}

export default App;

