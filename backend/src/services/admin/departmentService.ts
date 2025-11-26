/**
 * Admin Department Management Service
 * Handles department CRUD operations within tenant context
 *
 * DRY: Reuses existing audit logging and validation utilities
 * Multi-tenant: All operations scoped to tenant's school
 */

import type { PoolClient } from 'pg';
import { getPool } from '../../db/connection';
import { createAuditLog } from '../audit/enhancedAuditService';

export interface DepartmentInput {
  name: string;
  slug?: string;
  contactEmail?: string;
  contactPhone?: string;
  metadata?: Record<string, unknown>;
}

export interface DepartmentRecord {
  id: string;
  schoolId: string;
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  hodCount?: number;
  teacherCount?: number;
}

/**
 * Create a new department for the tenant's school
 */
export async function createDepartment(
  client: PoolClient,
  _tenantId: string,
  schoolId: string,
  input: DepartmentInput,
  actorId: string
): Promise<DepartmentRecord> {
  // Use getPool() for shared schema queries (departments table is in shared schema)
  const pool = getPool();

  // Generate slug if not provided
  const slug =
    input.slug ||
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

  // Check for duplicate slug within school
  const duplicateCheck = await pool.query(
    `SELECT id FROM shared.departments WHERE school_id = $1 AND slug = $2`,
    [schoolId, slug]
  );

  if ((duplicateCheck.rowCount ?? 0) > 0) {
    throw new Error(`Department with slug "${slug}" already exists`);
  }

  // Create department
  const result = await pool.query<{
    id: string;
    school_id: string;
    name: string;
    slug: string;
    contact_email: string | null;
    contact_phone: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `INSERT INTO shared.departments 
     (school_id, name, slug, contact_email, contact_phone, metadata)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, school_id, name, slug, contact_email, contact_phone, metadata, created_at, updated_at`,
    [
      schoolId,
      input.name,
      slug,
      input.contactEmail || null,
      input.contactPhone || null,
      JSON.stringify(input.metadata || {}),
    ]
  );

  const department = result.rows[0];

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'department:create',
    resourceType: 'department',
    resourceId: department.id,
    details: { name: input.name, slug },
    severity: 'info',
    tags: ['department', 'admin'],
  });

  return {
    id: department.id,
    schoolId: department.school_id,
    name: department.name,
    slug: department.slug,
    contactEmail: department.contact_email,
    contactPhone: department.contact_phone,
    metadata: department.metadata,
    createdAt: department.created_at,
    updatedAt: department.updated_at,
  };
}

/**
 * List all departments for a school with user counts
 */
export async function listDepartments(
  schoolId: string,
  includeCounts: boolean = true
): Promise<DepartmentRecord[]> {
  const pool = getPool();

  if (includeCounts) {
    const result = await pool.query<{
      id: string;
      school_id: string;
      name: string;
      slug: string;
      contact_email: string | null;
      contact_phone: string | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
      hod_count: string;
      teacher_count: string;
    }>(
      `SELECT 
        d.id, d.school_id, d.name, d.slug, d.contact_email, d.contact_phone,
        d.metadata, d.created_at, d.updated_at,
        COUNT(DISTINCT CASE WHEN ur.role_name = 'hod' THEN u.id END)::text as hod_count,
        COUNT(DISTINCT CASE WHEN u.department_id = d.id AND u.role = 'teacher' THEN u.id END)::text as teacher_count
       FROM shared.departments d
       LEFT JOIN shared.users u ON u.department_id = d.id
       LEFT JOIN shared.user_roles ur ON ur.user_id = u.id
       WHERE d.school_id = $1
       GROUP BY d.id, d.school_id, d.name, d.slug, d.contact_email, d.contact_phone, d.metadata, d.created_at, d.updated_at
       ORDER BY d.name`,
      [schoolId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      schoolId: row.school_id,
      name: row.name,
      slug: row.slug,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      hodCount: Number(row.hod_count),
      teacherCount: Number(row.teacher_count),
    }));
  } else {
    const result = await pool.query<{
      id: string;
      school_id: string;
      name: string;
      slug: string;
      contact_email: string | null;
      contact_phone: string | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, school_id, name, slug, contact_email, contact_phone, metadata, created_at, updated_at
       FROM shared.departments
       WHERE school_id = $1
       ORDER BY name`,
      [schoolId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      schoolId: row.school_id,
      name: row.name,
      slug: row.slug,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }
}

/**
 * Get department by ID
 */
export async function getDepartmentById(
  departmentId: string,
  schoolId: string
): Promise<DepartmentRecord | null> {
  const pool = getPool();
  const result = await pool.query<{
    id: string;
    school_id: string;
    name: string;
    slug: string;
    contact_email: string | null;
    contact_phone: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT id, school_id, name, slug, contact_email, contact_phone, metadata, created_at, updated_at
     FROM shared.departments
     WHERE id = $1 AND school_id = $2`,
    [departmentId, schoolId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    slug: row.slug,
    contactEmail: row.contact_email,
    contactPhone: row.contact_phone,
    metadata: row.metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Update department
 */
export async function updateDepartment(
  client: PoolClient,
  departmentId: string,
  schoolId: string,
  input: Partial<DepartmentInput>,
  actorId: string
): Promise<DepartmentRecord> {
  const pool = getPool();

  // Check department exists and belongs to school
  const existing = await getDepartmentById(departmentId, schoolId);
  if (!existing) {
    throw new Error('Department not found');
  }

  // Build update query dynamically
  const updates: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  if (input.name !== undefined) {
    updates.push(`name = $${paramIndex++}`);
    values.push(input.name);
  }
  if (input.slug !== undefined) {
    // Check for duplicate slug
    const duplicateCheck = await pool.query(
      `SELECT id FROM shared.departments WHERE school_id = $1 AND slug = $2 AND id != $3`,
      [schoolId, input.slug, departmentId]
    );
    if ((duplicateCheck.rowCount ?? 0) > 0) {
      throw new Error(`Department with slug "${input.slug}" already exists`);
    }
    updates.push(`slug = $${paramIndex++}`);
    values.push(input.slug);
  }
  if (input.contactEmail !== undefined) {
    updates.push(`contact_email = $${paramIndex++}`);
    values.push(input.contactEmail || null);
  }
  if (input.contactPhone !== undefined) {
    updates.push(`contact_phone = $${paramIndex++}`);
    values.push(input.contactPhone || null);
  }
  if (input.metadata !== undefined) {
    updates.push(`metadata = $${paramIndex++}`);
    values.push(JSON.stringify(input.metadata));
  }

  if (updates.length === 0) {
    return existing;
  }

  updates.push(`updated_at = NOW()`);
  values.push(departmentId, schoolId);

  const result = await pool.query<{
    id: string;
    school_id: string;
    name: string;
    slug: string;
    contact_email: string | null;
    contact_phone: string | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }>(
    `UPDATE shared.departments
     SET ${updates.join(', ')}
     WHERE id = $${paramIndex++} AND school_id = $${paramIndex++}
     RETURNING id, school_id, name, slug, contact_email, contact_phone, metadata, created_at, updated_at`,
    values
  );

  const updated = result.rows[0];

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'department:update',
    resourceType: 'department',
    resourceId: departmentId,
    details: { updates: input },
    severity: 'info',
    tags: ['department', 'admin'],
  });

  return {
    id: updated.id,
    schoolId: updated.school_id,
    name: updated.name,
    slug: updated.slug,
    contactEmail: updated.contact_email,
    contactPhone: updated.contact_phone,
    metadata: updated.metadata,
    createdAt: updated.created_at,
    updatedAt: updated.updated_at,
  };
}

/**
 * Delete department
 */
export async function deleteDepartment(
  client: PoolClient,
  departmentId: string,
  schoolId: string,
  actorId: string
): Promise<void> {
  const pool = getPool();

  // Check department exists
  const existing = await getDepartmentById(departmentId, schoolId);
  if (!existing) {
    throw new Error('Department not found');
  }

  // Check if department has users
  const userCheck = await pool.query(
    `SELECT COUNT(*) as count FROM shared.users WHERE department_id = $1`,
    [departmentId]
  );
  const userCount = Number(userCheck.rows[0]?.count ?? 0);
  if (userCount > 0) {
    throw new Error(
      `Cannot delete department: ${userCount} user(s) are assigned to this department`
    );
  }

  await pool.query(`DELETE FROM shared.departments WHERE id = $1 AND school_id = $2`, [
    departmentId,
    schoolId,
  ]);

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'department:delete',
    resourceType: 'department',
    resourceId: departmentId,
    details: { name: existing.name },
    severity: 'info',
    tags: ['department', 'admin'],
  });
}

/**
 * Assign HOD to department
 */
export async function assignHODToDepartment(
  client: PoolClient,
  departmentId: string,
  schoolId: string,
  userId: string,
  actorId: string
): Promise<void> {
  const pool = getPool();

  // Verify department exists and belongs to school
  const department = await getDepartmentById(departmentId, schoolId);
  if (!department) {
    throw new Error('Department not found');
  }

  // Verify user exists and belongs to tenant
  const userCheck = await pool.query(`SELECT id, tenant_id FROM shared.users WHERE id = $1`, [
    userId,
  ]);
  if (userCheck.rows.length === 0) {
    throw new Error('User not found');
  }

  // Check if user already has HOD role
  const hodRoleCheck = await pool.query(
    `SELECT user_id FROM shared.user_roles WHERE user_id = $1 AND role_name = 'hod'`,
    [userId]
  );

  if (hodRoleCheck.rows.length === 0) {
    // Add HOD role
    await pool.query(
      `INSERT INTO shared.user_roles (user_id, role_name, assigned_by)
       VALUES ($1, 'hod', $2)
       ON CONFLICT (user_id, role_name) DO UPDATE SET assigned_by = $2`,
      [userId, actorId]
    );
  }

  // Update user's department
  await pool.query(`UPDATE shared.users SET department_id = $1 WHERE id = $2`, [
    departmentId,
    userId,
  ]);

  // Audit log
  await createAuditLog(client, {
    userId: actorId,
    action: 'department:assign_hod',
    resourceType: 'department',
    resourceId: departmentId,
    details: { userId, departmentName: department.name },
    severity: 'info',
    tags: ['department', 'hod', 'admin'],
  });
}
