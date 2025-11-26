import { Suspense, lazy, useEffect, useMemo } from 'react';
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
const AdminReportsPageLegacy = lazy(() => import('./pages/admin/ReportsPage'));
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
const TeacherClassResourcesPage = lazy(() => import('./pages/teacher/TeacherClassResourcesPage'));
const TeacherAnnouncementsPage = lazy(() => import('./pages/teacher/TeacherAnnouncementsPage'));
const AdminBillingPage = lazy(() => import('./pages/admin/AdminBillingPage'));
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
const SuperuserMaintenancePage = lazy(() => import('./pages/superuser/maintenance/page'));
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
const AdminDepartmentsPage = lazy(() => import('./pages/admin/departments/page'));
const AdminClassesPage = lazy(() => import('./pages/admin/classes/page'));
const AdminUsersPage = lazy(() => import('./pages/admin/users/page'));
const AdminReportsPageNew = lazy(() => import('./pages/admin/reports/page'));
const AdminAnnouncementsPage = lazy(() => import('./pages/admin/announcements/page'));
const HODProfilePage = lazy(() => import('./pages/hod/HODProfilePage'));
const HODDashboardPage = lazy(() => import('./pages/hod/HODDashboardPage'));
const TeachersUnderHodPage = lazy(() => import('./pages/hod/TeachersUnderHodPage'));
const DepartmentReportsPage = lazy(() => import('./pages/hod/DepartmentReportsPage'));
const StudentDashboardPage = lazy(() => import('./pages/student/StudentDashboardPage'));
const StudentResourcesPage = lazy(() => import('./pages/student/StudentResourcesPage'));
const StudentAnnouncementsPage = lazy(() => import('./pages/student/StudentAnnouncementsPage'));
const NotAuthorizedPage = lazy(() => import('./pages/NotAuthorizedPage'));

function App() {
  const { user, logout, isAuthenticated, mustChangePassword, clearMustChangePassword } = useAuth();
  const navigate = useNavigate();

  // Get additional roles for user
  const additionalRoles = useMemo(() => {
    if (!user?.additional_roles) return [];
    return user.additional_roles.map((r) => r.role);
  }, [user?.additional_roles]);
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
      navigate(getDefaultDashboardPath(user?.role, additionalRoles), { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate, user?.role, additionalRoles]);

  return (
    <>
      {/* Skip to main content link for accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--brand-primary)] focus:text-[var(--brand-primary-contrast)] focus:rounded-md focus:font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--brand-primary)]"
      >
        Skip to main content
      </a>

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
            <Route
              index
              element={
                <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
              }
            />
            <Route
              path="overview"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['dashboard:view']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Executive dashboard">
                    <AdminOverviewPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            {/* Redirect old /dashboard/dashboard route to /dashboard/overview */}
            <Route path="dashboard" element={<Navigate to="/dashboard/overview" replace />} />
            <Route
              path="users"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="User management">
                    <AdminRoleManagementPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="departments"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['school:manage']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Departments">
                    <AdminDepartmentsPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="classes-management"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['settings:classes']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Classes Management">
                    <AdminClassesPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="users-management"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['users:manage']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Users Management">
                    <AdminUsersPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="reports-admin"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['reports:view']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Reports">
                    <AdminReportsPageNew />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="announcements"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['announcements:manage']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Announcements">
                    <AdminAnnouncementsPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="billing"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['billing:view']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Billing">
                    <AdminBillingPage />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="classes"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  allowedPermissions={['settings:classes']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  allowedPermissions={['teachers:manage']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  allowedPermissions={['students:manage']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  allowedPermissions={['users:manage', 'teachers:manage']}
                  requireAllPermissions={false}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
                >
                  <RouteMeta title="Reports & exports">
                    <AdminReportsPageLegacy />
                  </RouteMeta>
                </ProtectedRoute>
              }
            />
            <Route
              path="fees"
              element={
                <ProtectedRoute
                  allowedRoles={['admin', 'superadmin']}
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                  fallback={
                    <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                  }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <SuperuserActivityPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="maintenance"
                element={
                  <ProtectedRoute
                    allowedRoles={['superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <SuperuserMaintenancePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="users/:userId/activity"
                element={
                  <ProtectedRoute
                    allowedRoles={['superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <TeacherProfilePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources"
                element={
                  <ProtectedRoute
                    allowedRoles={['teacher', 'admin', 'superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <RouteMeta title="Class Resources">
                      <TeacherClassResourcesPage />
                    </RouteMeta>
                  </ProtectedRoute>
                }
              />
              <Route
                path="announcements"
                element={
                  <ProtectedRoute
                    allowedRoles={['teacher', 'admin', 'superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <RouteMeta title="Announcements">
                      <TeacherAnnouncementsPage />
                    </RouteMeta>
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <StudentFeesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="resources"
                element={
                  <ProtectedRoute
                    allowedRoles={['student', 'admin', 'superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <RouteMeta title="Class Resources">
                      <StudentResourcesPage />
                    </RouteMeta>
                  </ProtectedRoute>
                }
              />
              <Route
                path="announcements"
                element={
                  <ProtectedRoute
                    allowedRoles={['student', 'admin', 'superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <RouteMeta title="Announcements">
                      <StudentAnnouncementsPage />
                    </RouteMeta>
                  </ProtectedRoute>
                }
              />
              <Route
                path="messages"
                element={
                  <ProtectedRoute
                    allowedRoles={['student', 'admin', 'superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
                    allowedPermissions={['department-analytics', 'grades:manage']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <HODDashboardPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="teachers"
                element={
                  <ProtectedRoute
                    allowedRoles={['teacher', 'admin', 'superadmin']}
                    allowedPermissions={['department-analytics', 'grades:manage']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <TeachersUnderHodPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="reports"
                element={
                  <ProtectedRoute
                    allowedRoles={['teacher', 'admin', 'superadmin']}
                    allowedPermissions={['department-analytics', 'reports:view']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
                  >
                    <DepartmentReportsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="profile"
                element={
                  <ProtectedRoute
                    allowedRoles={['teacher', 'admin', 'superadmin']}
                    fallback={
                      <Navigate to={getDefaultDashboardPath(user?.role, additionalRoles)} replace />
                    }
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
