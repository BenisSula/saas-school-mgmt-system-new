export type Role = 'student' | 'teacher' | 'hod' | 'admin' | 'superadmin';

export type Permission =
  | 'dashboard:view'
  | 'attendance:manage'
  | 'attendance:view'
  | 'exams:manage'
  | 'exams:view'
  | 'grades:manage'
  | 'fees:manage'
  | 'fees:view'
  | 'users:invite'
  | 'users:manage'
  | 'tenants:manage'
  | 'settings:branding'
  | 'settings:terms'
  | 'settings:classes'
  | 'students:manage'
  | 'teachers:manage'
  | 'school:manage';

export const rolePermissions: Record<Role, Permission[]> = {
  student: ['dashboard:view', 'attendance:view', 'exams:view', 'fees:view'],
  teacher: [
    'dashboard:view',
    'attendance:manage',
    'exams:manage',
    'exams:view',
    'grades:manage',
    'fees:view',
    'students:manage'
  ],
  hod: ['dashboard:view', 'attendance:view', 'exams:view', 'grades:manage'],
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
    'teachers:manage',
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
    'teachers:manage',
    'school:manage'
  ]
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = rolePermissions[role] ?? [];
  return permissions.includes(permission);
}
