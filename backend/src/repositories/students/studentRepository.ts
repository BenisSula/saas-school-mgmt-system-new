/**
 * Student Repository
 *
 * Data access layer for Student domain.
 * Implements the Repository pattern for database operations.
 */

import type { PoolClient } from 'pg';
import { BaseRepository, type FindOptions, type FilterConditions } from '../base/baseRepository';
import type { Student, StudentFilters } from '../../../../shared/domain/types/student.types';
import { resolveClassId } from '../../lib/crudHelpers';
import { getTableName, serializeJsonField } from '../../lib/serviceUtils';

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  class_id: string | null;
  class_uuid: string | null;
  admission_number: string | null;
  parent_contacts: unknown;
  enrollment_status?: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Student Repository
 *
 * Handles all database operations for students.
 */
export class StudentRepository extends BaseRepository {
  constructor(client: PoolClient, schema: string) {
    super(client, schema, 'students');
  }

  /**
   * Find student by ID
   */
  // @ts-expect-error - Override with specific type, incompatible with base generic
  async findById(id: string): Promise<Student | null> {
    const result = await this.client.query<StudentRow>(
      `SELECT * FROM ${this.getTableName()} WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToStudent(result.rows[0]);
  }

  /**
   * Find students with filters
   */
  async findWithFilters(filters: StudentFilters): Promise<Student[]> {
    const tableName = this.getTableName();
    let query = `SELECT * FROM ${tableName}`;
    const params: unknown[] = [];
    const conditions: string[] = [];
    let paramIndex = 1;

    if (filters.enrollmentStatus) {
      conditions.push(`enrollment_status = $${paramIndex}`);
      params.push(filters.enrollmentStatus);
      paramIndex++;
    }

    if (filters.classId) {
      conditions.push(`(class_id = $${paramIndex} OR class_uuid = $${paramIndex})`);
      params.push(filters.classId);
      paramIndex++;
    }

    if (filters.search) {
      conditions.push(`(
        LOWER(first_name || ' ' || last_name) LIKE $${paramIndex}
        OR LOWER(admission_number) LIKE $${paramIndex}
        OR LOWER(class_id) LIKE $${paramIndex}
      )`);
      params.push(`%${filters.search.toLowerCase()}%`);
      paramIndex++;
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }

    query += ` ORDER BY last_name, first_name`;

    if (filters.limit) {
      query += ` LIMIT $${paramIndex}`;
      params.push(filters.limit);
      paramIndex++;
    }

    if (filters.offset) {
      query += ` OFFSET $${paramIndex}`;
      params.push(filters.offset);
    }

    const result = await this.client.query<StudentRow>(query, params);
    return result.rows.map((row) => this.mapRowToStudent(row));
  }

  /**
   * Create student
   */
  // @ts-expect-error - Override with specific type, incompatible with base generic
  async create(data: {
    firstName: string;
    lastName: string;
    dateOfBirth?: string | null;
    classId?: string;
    admissionNumber?: string | null;
    parentContacts?: Array<{
      name: string;
      relationship: string;
      phone?: string;
      email?: string;
    }>;
  }): Promise<Student> {
    // Resolve classId to both class_id (name) and class_uuid (UUID)
    const { classIdName, classUuid } = await resolveClassId(this.client, this.schema, data.classId);

    const tableName = this.getTableName();
    const result = await this.client.query<StudentRow>(
      `
      INSERT INTO ${tableName} (first_name, last_name, date_of_birth, class_id, class_uuid, admission_number, parent_contacts)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `,
      [
        data.firstName,
        data.lastName,
        data.dateOfBirth ?? null,
        classIdName,
        classUuid,
        data.admissionNumber ?? null,
        serializeJsonField(data.parentContacts ?? []),
      ]
    );

    return this.mapRowToStudent(result.rows[0]);
  }

  /**
   * Update student
   */
  async update(
    id: string,
    data: Partial<{
      firstName: string;
      lastName: string;
      dateOfBirth?: string | null;
      classId?: string;
      admissionNumber?: string | null;
      parentContacts?: Array<{
        name: string;
        relationship: string;
        phone?: string;
        email?: string;
      }>;
    }>
  ): Promise<Student | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    // If classId is provided, resolve it
    let classIdName = existing.classId || null;
    let classUuid = existing.classUuid || null;

    if (data.classId) {
      const resolved = await resolveClassId(this.client, this.schema, data.classId);
      classIdName = resolved.classIdName ?? classIdName;
      classUuid = resolved.classUuid ?? classUuid;
    }

    const tableName = this.getTableName();
    const result = await this.client.query<StudentRow>(
      `
      UPDATE ${tableName}
      SET first_name = COALESCE($1, first_name),
          last_name = COALESCE($2, last_name),
          date_of_birth = COALESCE($3, date_of_birth),
          class_id = COALESCE($4, class_id),
          class_uuid = COALESCE($5, class_uuid),
          admission_number = COALESCE($6, admission_number),
          parent_contacts = COALESCE($7, parent_contacts),
          updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `,
      [
        data.firstName ?? existing.firstName,
        data.lastName ?? existing.lastName,
        data.dateOfBirth ?? existing.dateOfBirth,
        classIdName,
        classUuid,
        data.admissionNumber ?? existing.admissionNumber,
        serializeJsonField(data.parentContacts ?? existing.parentContacts),
        id,
      ]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapRowToStudent(result.rows[0]);
  }

  /**
   * Update student's class
   */
  async updateClass(
    id: string,
    classId: string
  ): Promise<{
    previousClassId: string | null;
    previousClassUuid: string | null;
    student: Student;
  } | null> {
    const existing = await this.findById(id);
    if (!existing) {
      return null;
    }

    const { classIdName, classUuid } = await resolveClassId(this.client, this.schema, classId);

    const tableName = this.getTableName();
    const result = await this.client.query<StudentRow>(
      `
      UPDATE ${tableName}
      SET class_id = $1,
          class_uuid = $2,
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `,
      [classIdName, classUuid, id]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return {
      previousClassId: existing.classId || null,
      previousClassUuid: existing.classUuid || null,
      student: this.mapRowToStudent(result.rows[0]),
    };
  }

  /**
   * Get students in the same class as a given student
   */
  async findClassRoster(studentId: string): Promise<Array<{
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string | null;
    classId: string | null;
  }> | null> {
    const tableName = this.getTableName();

    // Get the student's class_uuid
    const studentResult = await this.client.query<{ class_uuid: string | null }>(
      `SELECT class_uuid FROM ${tableName} WHERE id = $1`,
      [studentId]
    );

    if (studentResult.rows.length === 0 || !studentResult.rows[0].class_uuid) {
      return null;
    }

    const classUuid = studentResult.rows[0].class_uuid;

    // Get all students in the same class
    const result = await this.client.query<{
      id: string;
      first_name: string;
      last_name: string;
      admission_number: string | null;
      class_id: string | null;
    }>(
      `
      SELECT id, first_name, last_name, admission_number, class_id
      FROM ${tableName}
      WHERE class_uuid = $1
      ORDER BY last_name ASC, first_name ASC
    `,
      [classUuid]
    );

    return result.rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      admissionNumber: row.admission_number,
      classId: row.class_id,
    }));
  }

  /**
   * Map database row to Student domain object
   */
  private mapRowToStudent(row: StudentRow): Student {
    return {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      dateOfBirth: row.date_of_birth,
      classId: row.class_id,
      classUuid: row.class_uuid,
      admissionNumber: row.admission_number,
      parentContacts: Array.isArray(row.parent_contacts)
        ? row.parent_contacts
        : typeof row.parent_contacts === 'object' && row.parent_contacts !== null
          ? Object.values(row.parent_contacts)
          : [],
      enrollmentStatus: row.enrollment_status || undefined,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    };
  }
}
