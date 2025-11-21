/**
 * Filter sidebar links based on RBAC permissions
 * Only shows links that the user has permission to access
 */
import type { SidebarLink } from '../roleLinks';
import type { Role, Permission } from '../../config/permissions';
import { hasPermission } from '../../config/permissions';

export interface LinkPermission {
  linkId: string;
  requiredPermissions?: Permission[];
  requireAll?: boolean; // If true, requires ALL permissions; if false, requires ANY
}

/**
 * Permission mapping for sidebar links
 * Maps link IDs to required permissions
 */
const LINK_PERMISSIONS: Record<string, LinkPermission> = {
  // Admin links
  'admin-overview': { linkId: 'admin-overview', requiredPermissions: ['dashboard:view'] },
  'admin-users': { linkId: 'admin-users', requiredPermissions: ['users:manage'] },
  'admin-classes': { linkId: 'admin-classes', requiredPermissions: ['settings:classes'] },
  'admin-attendance': { linkId: 'admin-attendance', requiredPermissions: ['attendance:manage'] },
  'admin-examinations': { linkId: 'admin-examinations', requiredPermissions: ['exams:manage'] },
  'admin-fees': { linkId: 'admin-fees', requiredPermissions: ['fees:manage'] },
  'admin-reports': { linkId: 'admin-reports', requiredPermissions: ['reports:view'] },
  'admin-settings': {
    linkId: 'admin-settings',
    requiredPermissions: ['settings:branding', 'settings:terms']
  },
  'admin-student-profile': {
    linkId: 'admin-student-profile',
    requiredPermissions: ['students:manage']
  },

  // Teacher links
  'teacher-overview': { linkId: 'teacher-overview', requiredPermissions: ['dashboard:view'] },
  'teacher-classes': {
    linkId: 'teacher-classes',
    requiredPermissions: ['students:view_own_class']
  },
  'teacher-students': {
    linkId: 'teacher-students',
    requiredPermissions: ['students:view_own_class']
  },
  'teacher-attendance': { linkId: 'teacher-attendance', requiredPermissions: ['attendance:mark'] },
  'teacher-grades': { linkId: 'teacher-grades', requiredPermissions: ['grades:enter'] },
  'teacher-reports': { linkId: 'teacher-reports', requiredPermissions: ['reports:view'] },
  'teacher-messages': {
    linkId: 'teacher-messages',
    requiredPermissions: ['messages:send', 'messages:receive']
  },
  'teacher-profile': { linkId: 'teacher-profile', requiredPermissions: ['profile:view_self'] },

  // Student links
  'student-overview': { linkId: 'student-overview', requiredPermissions: ['dashboard:view'] },
  'student-profile': { linkId: 'student-profile', requiredPermissions: ['profile:view_self'] },
  'student-attendance': { linkId: 'student-attendance', requiredPermissions: ['attendance:view'] },
  'student-results': { linkId: 'student-results', requiredPermissions: ['exams:view'] },
  'student-fees': { linkId: 'student-fees', requiredPermissions: ['fees:view_self'] },

  // SuperAdmin links
  'super-overview': { linkId: 'super-overview', requiredPermissions: ['dashboard:view'] },
  'super-schools': { linkId: 'super-schools', requiredPermissions: ['tenants:manage'] },
  'super-subscriptions': { linkId: 'super-subscriptions', requiredPermissions: ['tenants:manage'] },
  'super-users': { linkId: 'super-users', requiredPermissions: ['users:manage'] },
  'super-reports': { linkId: 'super-reports', requiredPermissions: ['reports:view'] },
  'super-settings': { linkId: 'super-settings', requiredPermissions: ['settings:branding'] },

  // HOD links
  'hod-overview': { linkId: 'hod-overview', requiredPermissions: ['dashboard:view'] },
  'hod-reports': { linkId: 'hod-reports', requiredPermissions: ['reports:view'] },
  'hod-analytics': {
    linkId: 'hod-analytics',
    requiredPermissions: ['department-analytics', 'performance:charts']
  }
};

/**
 * Check if user has permission to access a link
 */
function canAccessLink(role: Role, linkId: string): boolean {
  const linkPermission = LINK_PERMISSIONS[linkId];

  // If no permission requirement, allow access
  if (
    !linkPermission ||
    !linkPermission.requiredPermissions ||
    linkPermission.requiredPermissions.length === 0
  ) {
    return true;
  }

  const { requiredPermissions, requireAll = false } = linkPermission;

  if (requireAll) {
    // User must have ALL specified permissions
    return requiredPermissions.every((perm) => hasPermission(role, perm));
  } else {
    // User must have ANY of the specified permissions
    return requiredPermissions.some((perm) => hasPermission(role, perm));
  }
}

/**
 * Filter sidebar links based on user's role and permissions
 */
export function filterSidebarLinksByPermission(
  links: SidebarLink[],
  role: Role | null | undefined
): SidebarLink[] {
  if (!role) {
    return [];
  }

  return links.filter((link) => canAccessLink(role, link.id));
}
