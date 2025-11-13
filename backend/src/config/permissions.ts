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
  | 'performance:charts'
  | 'performance:generate'
  | 'messages:send'
  | 'messages:receive'
  | 'fees:view_self'
  | 'profile:view_self'
  | 'support:raise';

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
    'students:view_own_class'
  ],
  hod: [
    'dashboard:view',
    'attendance:view',
    'exams:view',
    'grades:manage',
    'department-analytics',
    'reports:view',
    'performance:charts',
    'messages:send'
  ],
  admin: [
    'dashboard:view',
    'attendance:manage',
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
    'school:manage'
  ],
  superadmin: [
    'dashboard:view',
    'attendance:manage',
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
    'performance:generate',
    'messages:send',
    'messages:receive',
    'school:manage'
  ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes(permission);
}
