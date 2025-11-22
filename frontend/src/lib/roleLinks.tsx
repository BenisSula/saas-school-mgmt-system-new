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
  Shield
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
    path: '/dashboard/overview'
  },
  {
    id: 'admin-users',
    label: 'User management',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/users'
  },
  {
    id: 'admin-teachers',
    label: 'Teachers',
    icon: <UserCheck className="h-5 w-5" />,
    path: '/dashboard/teachers'
  },
  {
    id: 'admin-students',
    label: 'Students',
    icon: <GraduationCap className="h-5 w-5" />,
    path: '/dashboard/students'
  },
  {
    id: 'admin-hods',
    label: 'HODs',
    icon: <Shield className="h-5 w-5" />,
    path: '/dashboard/hods'
  },
  {
    id: 'admin-classes',
    label: 'Classes & subjects',
    icon: <NotebookPen className="h-5 w-5" />,
    path: '/dashboard/classes'
  },
  {
    id: 'admin-attendance',
    label: 'Attendance',
    icon: <UserCheck className="h-5 w-5" />,
    path: '/dashboard/attendance'
  },
  {
    id: 'admin-examinations',
    label: 'Examinations',
    icon: <GraduationCap className="h-5 w-5" />,
    path: '/dashboard/examinations'
  },
  {
    id: 'admin-fees',
    label: 'Fees & payments',
    icon: <Wallet className="h-5 w-5" />,
    path: '/dashboard/fees'
  },
  {
    id: 'admin-reports',
    label: 'Reports (printable)',
    icon: <ClipboardList className="h-5 w-5" />,
    path: '/dashboard/reports'
  },
  {
    id: 'admin-settings',
    label: 'School settings',
    icon: <Settings2 className="h-5 w-5" />,
    path: '/dashboard/settings'
  }
];

const teacherLinks: SidebarLink[] = [
  {
    id: 'teacher-overview',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/teacher/dashboard'
  },
  {
    id: 'teacher-classes',
    label: 'My Classes',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/teacher/classes'
  },
  {
    id: 'teacher-students',
    label: 'My Students',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/teacher/students'
  },
  {
    id: 'teacher-attendance',
    label: 'Attendance',
    icon: <UserCheck className="h-5 w-5" />,
    path: '/dashboard/teacher/attendance'
  },
  {
    id: 'teacher-grades',
    label: 'Exams & Grades',
    icon: <NotebookPen className="h-5 w-5" />,
    path: '/dashboard/teacher/grades'
  },
  {
    id: 'teacher-reports',
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/teacher/reports'
  },
  {
    id: 'teacher-messages',
    label: 'Messages',
    icon: <MessageCircle className="h-5 w-5" />,
    path: '/dashboard/teacher/messages'
  },
  {
    id: 'teacher-profile',
    label: 'Profile',
    icon: <UserCircle className="h-5 w-5" />,
    path: '/dashboard/teacher/profile'
  }
];

const studentLinks: SidebarLink[] = [
  {
    id: 'student-overview',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/student/overview'
  },
  {
    id: 'student-profile',
    label: 'Profile',
    icon: <UserCircle className="h-5 w-5" />,
    path: '/dashboard/student/profile'
  },
  {
    id: 'student-attendance',
    label: 'Attendance',
    icon: <CalendarCheck className="h-5 w-5" />,
    path: '/dashboard/student/attendance'
  },
  {
    id: 'student-results',
    label: 'Results',
    icon: <LineChart className="h-5 w-5" />,
    path: '/dashboard/student/results'
  },
  {
    id: 'student-fees',
    label: 'Fees',
    icon: <Wallet className="h-5 w-5" />,
    path: '/dashboard/student/fees'
  }
];

const superAdminLinks: SidebarLink[] = [
  {
    id: 'super-dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/superuser/dashboard'
  },
  {
    id: 'super-overview',
    label: 'Platform Overview',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/superuser/overview'
  },
  {
    id: 'super-schools',
    label: 'Manage Schools',
    icon: <Building2 className="h-5 w-5" />,
    path: '/dashboard/superuser/schools'
  },
  {
    id: 'super-subscriptions',
    label: 'Subscription & Billing',
    icon: <CreditCard className="h-5 w-5" />,
    path: '/dashboard/superuser/subscriptions'
  },
  {
    id: 'super-users',
    label: 'User Management',
    icon: <Users className="h-5 w-5" />,
    path: '/dashboard/superuser/users'
  },
  {
    id: 'super-reports',
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/superuser/reports'
  },
  {
    id: 'super-activity',
    label: 'Activity Monitoring',
    icon: <Activity className="h-5 w-5" />,
    path: '/dashboard/superuser/activity'
  },
  {
    id: 'super-investigations',
    label: 'Investigation Tools',
    icon: <Shield className="h-5 w-5" />,
    path: '/dashboard/superuser/investigations'
  },
  {
    id: 'super-settings',
    label: 'Platform Settings',
    icon: <Settings2 className="h-5 w-5" />,
    path: '/dashboard/superuser/settings'
  }
];

const hodLinks: SidebarLink[] = [
  {
    id: 'hod-overview',
    label: 'Dashboard',
    icon: <LayoutDashboard className="h-5 w-5" />,
    path: '/dashboard/hod/overview'
  },
  {
    id: 'hod-reports',
    label: 'Reports',
    icon: <BarChart3 className="h-5 w-5" />,
    path: '/dashboard/hod/reports'
  },
  {
    id: 'hod-analytics',
    label: 'Analytics',
    icon: <LineChart className="h-5 w-5" />,
    path: '/dashboard/hod/analytics'
  }
];

const ROLE_LINKS: RoleLinkMap = {
  superadmin: superAdminLinks,
  admin: adminLinks,
  hod: hodLinks,
  teacher: teacherLinks,
  student: studentLinks
};

/**
 * Get sidebar links for a role, filtered by permissions
 * Only returns links the user has permission to access
 */
export function getSidebarLinksForRole(role: Role | null | undefined): SidebarLink[] {
  if (!role) return [];
  const links = ROLE_LINKS[role] ?? [];
  // Filter links based on RBAC permissions
  return filterSidebarLinksByPermission(links, role);
}

export function getDefaultDashboardPath(role: Role | null | undefined): string {
  if (role === 'superadmin') {
    return '/dashboard/superuser/dashboard';
  }
  const links = getSidebarLinksForRole(role);
  return links[0]?.path ?? '/dashboard/overview';
}

/**
 * Get superuser links (alias for superadmin role)
 */
export function getSuperuserLinks(): SidebarLink[] {
  return getSidebarLinksForRole('superadmin');
}

export const sidebarLinksByRole: RoleLinkMap = ROLE_LINKS;
