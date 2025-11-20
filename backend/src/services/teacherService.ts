import type { PoolClient } from 'pg';
import { TeacherInput } from '../validators/teacherValidator';
import { getTableName, serializeJsonField } from '../lib/serviceUtils';
import {
  filterTeachersByDepartment,
  getUserDepartmentId,
  isUserHOD
} from '../lib/rbacFilters';
import type { Role } from '../config/permissions';

const table = 'teachers';

export interface ListTeachersOptions {
  userId?: string;
  userRole?: Role;
  departmentId?: string | null;
}

export async function listTeachers(
  client: PoolClient,
  schema: string,
  options?: ListTeachersOptions
) {
  const tableName = getTableName(schema, table);
  let result = await client.query(`SELECT * FROM ${tableName} ORDER BY created_at DESC`);
  let teachers = result.rows;

  // Apply RBAC filtering
  if (options?.userRole && options?.userId) {
    // HOD: Filter by department
    if (options.userRole === 'hod' || (await isUserHOD(client, options.userId))) {
      const deptId = options.departmentId ?? (await getUserDepartmentId(client, options.userId));
      teachers = await filterTeachersByDepartment(client, schema, deptId, teachers);
    }
    // Teacher: Can only see themselves (handled by permission check in routes)
    // Admin/SuperAdmin: See all (no filtering needed)
  }

  return teachers;
}

export async function getTeacher(client: PoolClient, schema: string, id: string) {
  const tableName = getTableName(schema, table);
  const result = await client.query(`SELECT * FROM ${tableName} WHERE id = $1`, [id]);
  return result.rows[0];
}

export async function createTeacher(client: PoolClient, schema: string, payload: TeacherInput) {
  const tableName = getTableName(schema, table);
  const result = await client.query(
    `
      INSERT INTO ${tableName} (name, email, subjects, assigned_classes, qualifications, years_of_experience)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `,
    [
      payload.name,
      payload.email,
      serializeJsonField(payload.subjects ?? []),
      serializeJsonField(payload.assignedClasses ?? []),
      payload.qualifications ?? null,
      payload.yearsOfExperience ?? 0
    ]
  );

  return result.rows[0];
}

export async function updateTeacher(
  client: PoolClient,
  schema: string,
  id: string,
  payload: Partial<TeacherInput>
) {
  const existing = await getTeacher(client, schema, id);
  if (!existing) {
    return null;
  }

  const tableName = getTableName(schema, table);
  const next = {
    name: payload.name ?? existing.name,
    email: payload.email ?? existing.email,
    subjects: serializeJsonField(payload.subjects ?? existing.subjects),
    assigned_classes: serializeJsonField(payload.assignedClasses ?? existing.assigned_classes),
    qualifications: payload.qualifications ?? existing.qualifications ?? null,
    years_of_experience: payload.yearsOfExperience ?? existing.years_of_experience ?? 0
  };

  const result = await client.query(
    `
      UPDATE ${tableName}
      SET name = $1,
          email = $2,
          subjects = $3,
          assigned_classes = $4,
          qualifications = $5,
          years_of_experience = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING *
    `,
    [
      next.name,
      next.email,
      next.subjects,
      next.assigned_classes,
      next.qualifications,
      next.years_of_experience,
      id
    ]
  );

  return result.rows[0];
}

export async function deleteTeacher(client: PoolClient, schema: string, id: string) {
  const tableName = getTableName(schema, table);
  await client.query(`DELETE FROM ${tableName} WHERE id = $1`, [id]);
}
