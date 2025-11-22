import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import { LandingShell } from './layouts/LandingShell';
import { AdminShell } from './layouts/AdminShell';
import { getDefaultDashboardPath } from './lib/roleLinks';
import RouteMeta from './components/layout/RouteMeta';
import { useProfileSync } from './hooks/useProfileSync';
import { PasswordChangeModal } from './components/profile/PasswordChangeModal';

const HomePage = lazy(() => import('./pages'));
const TestLoginPage = lazy(() => import('./pages/TestLoginPage'));
// Legacy pages retained via redirects; not directly imported
const AuthUnifiedPage = lazy(() => import('./pages/auth/Auth'));
const AdminConfigurationPage = lazy(() => import('./pages/admin/ConfigurationPage'));
const AdminReportsPage = lazy(() => import('./pages/admin/ReportsPage'));
const AdminRoleManagementPage = lazy(() => import('./pages/admin/RoleManagementPage'));
const TeacherAttendancePage = lazy(() => import('./pages/teacher/AttendancePage'));
const StudentFeesPage = lazy(() => import('./pages/student/StudentFeesPage'));
const TeacherGradeEntryPage = lazy(() => import('./pages/teacher/GradeEntryPage'));
const StudentAttendancePage = lazy(() => import('./pages/student/StudentAttendancePage'));
const StudentResultsPage = lazy(() => import('./pages/student/StudentResultsPage'));
const StudentMessagesPage = lazy(() => import('./pages/student/StudentMessagesPage'));
const StudentProfilePage = lazy(() => import('./pages/student/StudentProfilePage'));
const StudentReportsPage = lazy(() => import('./pages/student/StudentReportsPage'));
const AdminExamConfigPage = lazy(() => import('./pages/admin/AdminExamConfigPage'));
const TeacherDashboardPage = lazy(() => import('./pages/teacher/TeacherDashboardPage'));
const TeacherClassesPage = lazy(() => import('./pages/teacher/TeacherClassesPage'));
const TeacherStudentsPage = lazy(() => import('./pages/teacher/TeacherStudentsPage'));
const TeacherReportsPage = lazy(() => import('./pages/teacher/TeacherReportsPage'));
const TeacherMessagesPage = lazy(() => import('./pages/teacher/TeacherMessagesPage'));
const TeacherProfilePage = lazy(() => import('./pages/teacher/TeacherProfilePage'));
const SuperuserDashboardPage = lazy(() => import('./pages/superuser/dashboard'));
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
const SuperuserTenantAnalyticsPage = lazy(
  () => import('./pages/superuser/SuperuserTenantAnalyticsPage')
);
const SuperuserUsageMonitoringPage = lazy(
  () => import('./pages/superuser/SuperuserUsageMonitoringPage')
);
const SuperuserActivityPage = lazy(() => import('./pages/superuser/activity'));
const UserActivityPage = lazy(() => import('./pages/superuser/users/[userId]/activity'));
const InvestigationListPage = lazy(() => import('./pages/superuser/investigations'));
const InvestigationDetailPage = lazy(() => import('./pages/superuser/investigations/[caseId]'));
const InvestigationCreatePage = lazy(() => import('./pages/superuser/investigations/create'));
const AdminClassesSubjectsPage = lazy(() => import('./pages/admin/AdminClassesSubjectsPage'));
const AdminAttendancePage = lazy(() => import('./pages/admin/AdminAttendancePage'));
const AdminOverviewPage = lazy(() => import('./pages/admin/AdminOverviewPage'));
const TeachersManagementPage = lazy(() => import('./pages/admin/TeachersManagementPage'));
const StudentsManagementPage = lazy(() => import('./pages/admin/StudentsManagementPage'));
const HODsManagementPage = lazy(() => import('./pages/admin/HODsManagementPage'));
const AdminClassAssignmentPage = lazy(() => import('./pages/admin/AdminClassAssignmentPage'));
const AdminDepartmentAnalyticsPage = lazy(
  () => import('./pages/admin/AdminDepartmentAnalyticsPage')
);
const HODProfilePage = lazy(() => import('./pages/hod/HODProfilePage'));
const HODDashboardPage = lazy(() => import('./pages/hod/HODDashboardPage'));
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'));
const NotAuthorizedPage = lazy(() => import('./pages/NotAuthorizedPage'));

function App() {
  const { user, logout, isAuthenticated, mustChangePassword, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Sync profile data after login/registration
  useProfileSync();

  useEffect(() => {
    if (!isAuthenticated && location.pathname.startsWith('/dashboard')) {
      navigate('/', { replace: true });
      return;
    }
    // Don't redirect from test-login page
    if (location.pathname === '/test-login') {
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
    <>
      {/* Password Change Modal - shows when user must change password */}
      {isAuthenticated && (
        <PasswordChangeModal
          isOpen={mustChangePassword}
          onClose={clearMustChangePassword}
          isRequired={mustChangePassword}
          onSuccess={clearMustChangePassword}
        />
      )}
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
            <Route index element={<AuthUnifiedPage />} />
            <Route path="login" element={<Navigate to="/auth?mode=login" replace />} />
            <Route path="register" element={<Navigate to="/auth?mode=register" replace />} />
          </Route>
        </Route>
        <Route path="/test-login" element={<TestLoginPage />} />
        <Route path="/not-authorized" element={<NotAuthorizedPage />} />
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
                  <AdminOverviewPage />
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
            path="teachers"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="Teachers management">
                  <TeachersManagementPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="students"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="Students management">
                  <StudentsManagementPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="hods"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <RouteMeta title="HODs management">
                  <HODsManagementPage />
                </RouteMeta>
              </ProtectedRoute>
            }
          />
          <Route
            path="class-assignment"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <AdminClassAssignmentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="department-analytics"
            element={
              <ProtectedRoute
                allowedRoles={['admin', 'superadmin']}
                fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
              >
                <AdminDepartmentAnalyticsPage />
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
              path="dashboard"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserDashboardPage />
                </ProtectedRoute>
              }
            />
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
              path="tenant-analytics"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserTenantAnalyticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="usage"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserUsageMonitoringPage />
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
              path="investigations"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <InvestigationListPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="investigations/create"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <InvestigationCreatePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="investigations/:caseId"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <InvestigationDetailPage />
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
            <Route
              path="activity"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <SuperuserActivityPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="users/:userId/activity"
              element={
                <ProtectedRoute
                  allowedRoles={['superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <UserActivityPage />
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
                  allowedPermissions={['attendance:mark']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <RouteMeta title="Mark Attendance">
                    <TeacherAttendancePage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="grades"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  allowedPermissions={['grades:enter']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <RouteMeta title="Enter Grades">
                    <TeacherGradeEntryPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="students"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  allowedPermissions={['students:view_own_class']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <RouteMeta title="My Students">
                    <TeacherStudentsPage />
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
          <Route path="hod">
            <Route
              path="dashboard"
              element={
                <ProtectedRoute
                  allowedRoles={['teacher', 'admin', 'superadmin']}
                  fallback={<Navigate to={getDefaultDashboardPath(user?.role)} replace />}
                >
                  <HODDashboardPage />
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
                  <HODProfilePage />
                </ProtectedRoute>
              }
            />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
    </>
  );
}

export default App;
