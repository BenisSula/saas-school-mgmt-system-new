/**
 * Role configuration and hierarchy
 */
import type { Role } from '../../config/permissions';

export interface RoleConfig {
  label: string;
  description: string;
  level: number; // Hierarchy level (higher = more permissions)
  parent?: Role; // Parent role in hierarchy
}

export const roleConfig: Record<Role, RoleConfig> = {
  superadmin: {
    label: 'Super Admin',
    description: 'Platform administrator with access to all tenants',
    level: 5,
  },
  admin: {
    label: 'Admin',
    description: 'School administrator with full access to their tenant',
    level: 4,
  },
  hod: {
    label: 'Head of Department',
    description: 'Department head with access to department resources',
    level: 3,
    parent: 'admin',
  },
  teacher: {
    label: 'Teacher',
    description: 'Teacher with access to assigned classes and students',
    level: 2,
    parent: 'hod',
  },
  student: {
    label: 'Student',
    description: 'Student with access to own data and resources',
    level: 1,
    parent: 'teacher',
  },
};

/**
 * Check if role1 has higher or equal level than role2
 */
export function hasHigherOrEqualLevel(role1: Role, role2: Role): boolean {
  return roleConfig[role1].level >= roleConfig[role2].level;
}

/**
 * Get all roles that are higher or equal to the given role
 */
export function getHigherOrEqualRoles(role: Role): Role[] {
  const roleLevel = roleConfig[role].level;
  return (Object.keys(roleConfig) as Role[]).filter((r) => roleConfig[r].level >= roleLevel);
}

/**
 * Get role label
 */
export function getRoleLabel(role: Role): string {
  return roleConfig[role].label;
}

/**
 * Get role description
 */
export function getRoleDescription(role: Role): string {
  return roleConfig[role].description;
}
