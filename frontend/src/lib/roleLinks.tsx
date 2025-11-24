import type { ReactNode } from 'react';
import {
  LayoutDashboard,
  Users,
  Settings2,
  BarChart3,
  Wallet,
  GraduationCap,
  NotebookPen,
  UserCheck,
  CalendarCheck,
  LineChart,
  Building2,
  CreditCard,
  ClipboardList,
  MessageCircle,
  UserCircle,
  Activity,
  Shield,
  Database,
} from 'lucide-react';
import type { Role } from './api';
import { filterSidebarLinksByPermission } from './rbac/filterSidebarLinks';

export interface SidebarLink {
  id: string;
  label: string;
  icon: ReactNode;
  path: string;
}

type RoleLinkMap = Record<Role, SidebarLink[]>;

const adminLinks: SidebarLink[] = [
  {
    id: 'admin-overview',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/overview',
  },
  {
    id: 'admin-users',
    label: 'User management',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/users',
  },
  {
    id: 'admin-teachers',
    label: 'Teachers',
    icon: <UserCheck className="h-5 w-5" />,
    path: '/dashboard/teachers',
  },
  {
    id: 'admin-students',
    label: 'Students',
    icon: <GraduationCap className="h-5 w-5" />,
    path: '/dashboard/students',
  },
  {
    id: 'admin-hods',
    label: 'HODs',
    icon: <Shield className="h-5 w-5" />,
    path: '/dashboard/hods',
  },
  {
    id: 'admin-departments',
    label: 'Departments',
    icon: <Building2 className="h-5 w-5" />,
    path: '/dashboard/departments',
  },
  {
    id: 'admin-classes-management',
    label: 'Classes Management',
    icon: <NotebookPen className="h-5 w-5" />,
    path: '/dashboard/classes-management',
  },
  {
    id: 'admin-classes',
    label: 'Classes & subjects',
    icon: <NotebookPen className="h-5 w-5" />,
    path: '/dashboard/classes',
  },
  {
    id: 'admin-users-management',
    label: 'Users Management',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/users-management',
  },
  {
    id: 'admin-announcements',
    label: 'Announcements',
    icon: <MessageCircle className="h-5 w-5" />,
    path: '/dashboard/announcements',
  },
  {
    id: 'admin-attendance',
    label: 'Attendance',
    icon: <UserCheck className="h-5 w-5" />,
    path: '/dashboard/attendance',
  },
  {
    id: 'admin-examinations',
    label: 'Examinations',
    icon: <GraduationCap className="h-5 w-5" />,
    path: '/dashboard/examinations',
  },
  {
    id: 'admin-fees',
    label: 'Fees & payments',
    icon: <Wallet className="h-5 w-5" />,
    path: '/dashboard/fees',
  },
  {
    id: 'admin-reports',
    label: 'Reports (printable)',
    icon: <ClipboardList className="h-5 w-5" />,
    path: '/dashboard/reports',
  },
  {
    id: 'admin-settings',
    label: 'School settings',
    icon: <Settings2 className="h-5 w-5" />,
    path: '/dashboard/settings',
  },
];

const teacherLinks: SidebarLink[] = [
  {
    id: 'teacher-overview',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/teacher/dashboard',
  },
  {
    id: 'teacher-classes',
    label: 'My Classes',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/teacher/classes',
  },
  {
    id: 'teacher-students',
    label: 'My Students',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/teacher/students',
  },
  {
    id: 'teacher-attendance',
    label: 'Attendance',
    icon: <UserCheck className="h-5 w-5" />,
    path: '/dashboard/teacher/attendance',
  },
  {
    id: 'teacher-grades',
    label: 'Exams & Grades',
    icon: <NotebookPen className="h-5 w-5" />,
    path: '/dashboard/teacher/grades',
  },
  {
    id: 'teacher-reports',
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/teacher/reports',
  },
  {
    id: 'teacher-messages',
    label: 'Messages',
    icon: <MessageCircle className="h-5 w-5" />,
    path: '/dashboard/teacher/messages',
  },
  {
    id: 'teacher-profile',
    label: 'Profile',
    icon: <UserCircle className="h-5 w-5" />,
    path: '/dashboard/teacher/profile',
  },
];

const studentLinks: SidebarLink[] = [
  {
    id: 'student-overview',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/student/overview',
  },
  {
    id: 'student-profile',
    label: 'Profile',
    icon: <UserCircle className="h-5 w-5" />,
    path: '/dashboard/student/profile',
  },
  {
    id: 'student-attendance',
    label: 'Attendance',
    icon: <CalendarCheck className="h-5 w-5" />,
    path: '/dashboard/student/attendance',
  },
  {
    id: 'student-results',
    label: 'Results',
    icon: <LineChart className="h-5 w-5" />,
    path: '/dashboard/student/results',
  },
  {
    id: 'student-fees',
    label: 'Fees',
    icon: <Wallet className="h-5 w-5" />,
    path: '/dashboard/student/fees',
  },
];

const superAdminLinks: SidebarLink[] = [
  {
    id: 'super-dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/superuser/dashboard',
  },
  {
    id: 'super-overview',
    label: 'Platform Overview',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/superuser/overview',
  },
  {
    id: 'super-schools',
    label: 'Manage Schools',
    icon: <Building2 className="h-5 w-5" />,
    path: '/dashboard/superuser/schools',
  },
  {
    id: 'super-subscriptions',
    label: 'Subscription & Billing',
    icon: <CreditCard className="h-5 w-5" />,
    path: '/dashboard/superuser/subscriptions',
  },
  {
    id: 'super-users',
    label: 'User Management',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/superuser/users',
  },
  {
    id: 'super-reports',
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/superuser/reports',
  },
  {
    id: 'super-activity',
    label: 'Activity Monitoring',
    icon: <Activity className="h-5 w-5" />,
    path: '/dashboard/superuser/activity',
  },
  {
    id: 'super-maintenance',
    label: 'Maintenance',
    icon: <Database className="h-5 w-5" />,
    path: '/dashboard/superuser/maintenance',
  },
  {
    id: 'super-investigations',
    label: 'Investigation Tools',
    icon: <Shield className="h-5 w-5" />,
    path: '/dashboard/superuser/investigations',
  },
  {
    id: 'super-settings',
    label: 'Platform Settings',
    icon: <Settings2 className="h-5 w-5" />,
    path: '/dashboard/superuser/settings',
  },
];

const hodLinks: SidebarLink[] = [
  {
    id: 'hod-dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/hod/dashboard',
  },
  {
    id: 'hod-teachers',
    label: 'Department Teachers',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/hod/teachers',
  },
  {
    id: 'hod-reports',
    label: 'Department Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/hod/reports',
  },
  {
    id: 'hod-profile',
    label: 'Profile',
    icon: <UserCircle className="h-5 w-5" />,
    path: '/dashboard/hod/profile',
  },
];

const ROLE_LINKS: RoleLinkMap = {
  superadmin: superAdminLinks,
  admin: adminLinks,
  hod: hodLinks,
  teacher: teacherLinks,
  student: studentLinks,
};

/**
 * Get sidebar links for a role, filtered by permissions
 * Only returns links the user has permission to access
 *
 * @param role - The user's primary role
 * @param additionalRoles - Optional array of additional role names (e.g., ['hod'])
 */
export function getSidebarLinksForRole(
  role: Role | null | undefined,
  additionalRoles?: string[]
): SidebarLink[] {
  if (!role) return [];

  // Check if user is HOD using helper function
  const isHOD = role === 'teacher' && additionalRoles?.includes('hod');

  // If HOD, return HOD links, otherwise return links for primary role
  const effectiveRole: Role = isHOD ? 'hod' : role;
  const links = ROLE_LINKS[effectiveRole] ?? [];

  // Filter links based on RBAC permissions
  // Pass additionalRoles so permission checking can account for HOD permissions
  return filterSidebarLinksByPermission(links, role, additionalRoles);
}

export function getDefaultDashboardPath(
  role: Role | null | undefined,
  additionalRoles?: string[]
): string {
  if (role === 'superadmin') {
    return '/dashboard/superuser/dashboard';
  }
  // Check if user is HOD using helper function
  const isHOD = role === 'teacher' && additionalRoles?.includes('hod');
  if (isHOD) {
    return '/dashboard/hod/dashboard';
  }
  const links = getSidebarLinksForRole(role, additionalRoles);
  return links[0]?.path ?? '/dashboard/overview';
}

/**
 * Get superuser links (alias for superadmin role)
 */
export function getSuperuserLinks(): SidebarLink[] {
  return getSidebarLinksForRole('superadmin');
}

export const sidebarLinksByRole: RoleLinkMap = ROLE_LINKS;
