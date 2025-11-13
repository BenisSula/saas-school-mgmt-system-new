import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { LandingShell } from './layouts/LandingShell';
import { AdminShell } from './layouts/AdminShell';
import { getDefaultDashboardPath } from './lib/roleLinks';
import PlaceholderPage from './pages/PlaceholderPage';
import RouteMeta from './components/layout/RouteMeta';

const HomePage = lazy(() => import('./pages'));
const LoginPage = lazy(() => import('./pages/auth/Login'));
const RegisterPage = lazy(() => import('./pages/auth/Register'));
const AdminConfigurationPage = lazy(() => import('./pages/AdminConfigurationPage'));
const AdminReportsPage = lazy(() => import('./pages/AdminReportsPage'));
const AdminRoleManagementPage = lazy(() => import('./pages/AdminRoleManagementPage'));
const TeacherAttendancePage = lazy(() => import('./pages/TeacherAttendancePage'));
const StudentFeesPage = lazy(() => import('./pages/student/StudentFeesPage'));
const TeacherGradeEntryPage = lazy(() => import('./pages/TeacherGradeEntryPage'));
const StudentAttendancePage = lazy(() => import('./pages/student/StudentAttendancePage'));
const StudentResultsPage = lazy(() => import('./pages/student/StudentResultsPage'));
const StudentMessagesPage = lazy(() => import('./pages/student/StudentMessagesPage'));
const StudentProfilePage = lazy(() => import('./pages/student/StudentProfilePage'));
const StudentReportsPage = lazy(() => import('./pages/student/StudentReportsPage'));
const AdminExamConfigPage = lazy(() => import('./pages/AdminExamConfigPage'));
const TeacherDashboardPage = lazy(() => import('./pages/teacher/TeacherDashboardPage'));
const TeacherClassesPage = lazy(() => import('./pages/teacher/TeacherClassesPage'));
const TeacherReportsPage = lazy(() => import('./pages/teacher/TeacherReportsPage'));
const TeacherMessagesPage = lazy(() => import('./pages/teacher/TeacherMessagesPage'));
const TeacherProfilePage = lazy(() => import('./pages/teacher/TeacherProfilePage'));
const SuperuserOverviewPage = lazy(() => import('./pages/superuser/SuperuserOverviewPage'));
const SuperuserManageSchoolsPage = lazy(
  () => import('./pages/superuser/SuperuserManageSchoolsPage')
);
const SuperuserSubscriptionsPage = lazy(
  () => import('./pages/superuser/SuperuserSubscriptionsPage')
);
const SuperuserUsersPage = lazy(() => import('./pages/superuser/SuperuserUsersPage'));
const SuperuserReportsPage = lazy(() => import('./pages/superuser/SuperuserReportsPage'));
const SuperuserSettingsPage = lazy(() => import('./pages/superuser/SuperuserSettingsPage'));
const AdminClassesSubjectsPage = lazy(() => import('./pages/admin/AdminClassesSubjectsPage'));
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage'));
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'));

function App() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!isAuthenticated && location.pathname.startsWith('/dashboard')) {
      navigate('/', { replace: true });
      return;
    }
    if (
      isAuthenticated &&
      (location.pathname === '/' ||
        location.pathname === '/dashboard' ||
        location.pathname.startsWith('/auth'))
    ) {
      navigate(getDefaultDashboardPath(user?.role), { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate, user?.role]);

  return (
    <Suspense
      fallback={
        <div
          className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-300"
          role="status"
        >
          Loading application…
        </div>
      }
    >
      <Routes>
        <Route path="/" element={<LandingShell />}>
          <Route index element={<HomePage />} />
          <Route path="auth">
            <Route path="login" element={<LoginPage />} />
            <Route path="register" element={<RegisterPage />} />
          </Route>
        </Route>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute
              fallback={<Navigate to="/" replace />}
              loadingFallback={
                <div className="flex min-h-screen items-center justify-center text-sm text-[var(--brand-muted)]">
                  Checking session…
                </div>
              }
            >
              <AdminShell user={user ?? null} onLogout={logout}>
                <Outlet />
              </AdminShell>
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to={getDefaultDashboardPath(user?.role)} replace />} />
          <Route
            path="overview"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="Executive dashboard">
                  <PlaceholderPage
                    title="Executive dashboard"
                    description="High-level metrics across tenants, uptime, and operational health."
                  />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="users"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="User management">
                  <AdminRoleManagementPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="classes"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <AdminClassesSubjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="attendance"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <AdminAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="reports"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="Reports & exports">
                  <AdminReportsPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="fees"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="Fees">
                  <StudentFeesPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="examinations"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="Examinations">
                  <AdminExamConfigPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="settings"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="School settings">
                  <AdminConfigurationPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route path="superuser">
            <Route
              path="overview"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserOverviewPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="schools"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserManageSchoolsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="subscriptions"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserSubscriptionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="settings"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserSettingsPage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="teacher">
            <Route
              path="dashboard"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <TeacherDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="classes"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <TeacherClassesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <TeacherAttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="grades"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <RouteMeta title="Exams & grades">
                    <TeacherGradeEntryPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <TeacherReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <TeacherMessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <TeacherProfilePage />
                </ProtectedRoute>
              }
            />
          </Route>
          <Route path="student">
            <Route
              path="overview"
              element={
                <ProtectedRoute
                  allowedRoles={['student', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <StudentDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="attendance"
              element={
                <ProtectedRoute
                  allowedRoles={['student', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <StudentAttendancePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="results"
              element={
                <ProtectedRoute
                  allowedRoles={['student', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <StudentResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="fees"
              element={
                <ProtectedRoute
                  allowedRoles={['student', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <StudentFeesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="messages"
              element={
                <ProtectedRoute
                  allowedRoles={['student', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <StudentMessagesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="profile"
              element={
                <ProtectedRoute
                  allowedRoles={['student', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <StudentProfilePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="reports"
              element={
                <ProtectedRoute
                  allowedRoles={['student', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <StudentReportsPage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
