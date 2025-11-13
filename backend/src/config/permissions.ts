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
  | 'teachers:manage'
  | 'school:manage'
  | 'performance:generate'
  | 'messages:send';

export const rolePermissions: Record<Role, Permission[]> = {
  student: ['dashboard:view', 'attendance:view', 'exams:view', 'fees:view'],
  teacher: [
    'dashboard:view',
    'attendance:view',
    'attendance:mark',
    'attendance:manage',
    'exams:view',
    'exams:manage',
    'grades:enter',
    'grades:edit',
    'grades:manage',
    'fees:view',
    'performance:generate',
    'messages:send',
    'students:view_own_class'
  ],
  hod: [
    'dashboard:view',
    'attendance:view',
    'attendance:manage',
    'exams:view',
    'exams:manage',
    'grades:manage',
    'performance:generate',
    'messages:send',
    'students:manage'
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
    'performance:generate',
    'messages:send',
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
    'performance:generate',
    'messages:send',
    'school:manage'
  ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes(permission);
}
