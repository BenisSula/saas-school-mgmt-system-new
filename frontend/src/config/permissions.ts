// Frontend permissions configuration matching backend
// This ensures frontend and backend RBAC stay in sync

export type Role = 'student' | 'teacher' | 'hod' | 'admin' | 'superadmin';

export type Permission =
  | 'dashboard:view'
  | 'attendance:manage'
  | 'attendance:view'
  | 'attendance:mark'
  | 'exams:manage'
  | 'exams:view'
  | 'grades:manage'
  | 'grades:enter'
  | 'grades:edit'
  | 'fees:manage'
  | 'fees:view'
  | 'users:invite'
  | 'users:manage'
  | 'tenants:manage'
  | 'settings:branding'
  | 'settings:terms'
  | 'settings:classes'
  | 'students:manage'
  | 'students:view_own_class'
  | 'students:view_self'
  | 'teachers:manage'
  | 'school:manage'
  | 'department-analytics'
  | 'reports:view'
  | 'reports:manage'
  | 'performance:charts'
  | 'performance:generate'
  | 'messages:send'
  | 'messages:receive'
  | 'fees:view_self'
  | 'profile:view_self'
  | 'support:raise'
  | 'support:view'
  | 'support:manage'
  | 'announcements:manage'
  | 'kb:manage'
  | 'status:view'
  | 'status:manage'
  | 'notifications:send'
  | 'subscriptions:manage'
  | 'subscriptions:view'
  | 'subscriptions:update'
  | 'overrides:manage'
  | 'overrides:view'
  | 'overrides:create'
  | 'overrides:revoke'
  | 'permission_overrides:manage'
  | 'permission_overrides:view';

export const rolePermissions: Record<Role, Permission[]> = {
  student: [
    'dashboard:view',
    'attendance:view',
    'exams:view',
    'fees:view',
    'fees:view_self',
    'messages:receive',
    'students:view_self',
    'profile:view_self',
    'support:raise'
  ],
  teacher: [
    'dashboard:view',
    'attendance:mark',
    'attendance:view',
    'grades:enter',
    'grades:edit',
    'performance:generate',
    'messages:send',
    'messages:receive',
    'students:view_own_class',
    'reports:view',
    'profile:view_self'
  ],
  hod: [
    'dashboard:view',
    'attendance:view',
    'exams:view',
    'grades:manage',
    'department-analytics',
    'reports:view',
    'performance:charts',
    'messages:send',
    'users:manage',
    'teachers:manage'
  ],
  admin: [
    'dashboard:view',
    'attendance:manage',
    'attendance:view',
    'exams:manage',
    'exams:view',
    'grades:manage',
    'fees:manage',
    'fees:view',
    'users:invite',
    'users:manage',
    'settings:branding',
    'settings:terms',
    'settings:classes',
    'students:manage',
    'students:view_own_class',
    'teachers:manage',
    'reports:view',
    'performance:generate',
    'messages:send',
    'messages:receive',
    'school:manage',
    'support:raise',
    'support:view',
    'support:manage',
    'announcements:manage',
    'kb:manage',
    'status:view',
    'status:manage'
  ],
  superadmin: [
    'dashboard:view',
    'attendance:manage',
    'attendance:view',
    'exams:manage',
    'exams:view',
    'grades:manage',
    'fees:manage',
    'fees:view',
    'users:invite',
    'users:manage',
    'tenants:manage',
    'settings:branding',
    'settings:terms',
    'settings:classes',
    'students:manage',
    'students:view_own_class',
    'teachers:manage',
    'reports:view',
    'reports:manage',
    'performance:generate',
    'messages:send',
    'messages:receive',
    'school:manage',
    'support:raise',
    'support:view',
    'support:manage',
    'announcements:manage',
    'kb:manage',
    'status:view',
    'status:manage',
    'subscriptions:manage',
    'subscriptions:view',
    'subscriptions:update',
    'overrides:manage',
    'overrides:view',
    'overrides:create',
    'overrides:revoke',
    'permission_overrides:manage',
    'permission_overrides:view'
  ]
};

/**
 * Checks if a role has a specific permission
 */
export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes(permission);
}
