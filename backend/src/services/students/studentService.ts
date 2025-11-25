/**
 * Student Service
 *
 * Business logic for Student domain.
 * Uses StudentRepository for data access and emits events for async workflows.
 */

import type { PoolClient } from 'pg';
import { StudentRepository } from '../../repositories/students/studentRepository';
import type {
  Student,
  StudentInput,
  StudentFilters,
} from '../../../../shared/domain/types/student.types';
import {
  emitEventSafely,
  EventNames,
  type StudentCreatedEvent,
  type StudentUpdatedEvent,
  type StudentDeletedEvent,
} from '../../lib/events';
import { createAuditLog } from '../audit/enhancedAuditService';

/**
 * List students with optional filters
 */
export async function listStudents(
  client: PoolClient,
  schema: string,
  filters?: StudentFilters
): Promise<Student[]> {
  const repository = new StudentRepository(client, schema);
  return repository.findWithFilters(filters || {});
}

/**
 * Get student by ID
 */
export async function getStudent(
  client: PoolClient,
  schema: string,
  id: string
): Promise<Student | null> {
  const repository = new StudentRepository(client, schema);
  return repository.findById(id);
}

/**
 * Create student
 */
export async function createStudent(
  client: PoolClient,
  schema: string,
  payload: StudentInput,
  actorId?: string,
  tenantId?: string
): Promise<Student> {
  const repository = new StudentRepository(client, schema);

  // Create student via repository
  const student = await repository.create({
    firstName: payload.firstName,
    lastName: payload.lastName,
    dateOfBirth: payload.dateOfBirth,
    classId: payload.classId,
    admissionNumber: payload.admissionNumber,
    parentContacts: payload.parentContacts,
  });

  // Create audit log
  if (actorId && tenantId) {
    try {
      await createAuditLog(client, {
        tenantId: tenantId,
        userId: actorId,
        action: 'STUDENT_CREATED',
        resourceType: 'student',
        resourceId: student.id,
        details: {
          studentEmail: (payload as { email?: string }).email,
          classId: student.classId ?? undefined,
          classUuid: student.classUuid,
        },
        severity: 'info',
      });
    } catch (auditError) {
      console.error(
        '[studentService] Failed to create audit log for student creation:',
        auditError
      );
    }
  }

  // Emit event for async workflows
  if (actorId && tenantId) {
    await emitEventSafely<StudentCreatedEvent>(EventNames.STUDENT_CREATED, {
      studentId: student.id,
      student: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        classId: student.classId ?? undefined,
      },
      actorId,
      tenantId,
      timestamp: new Date(),
    });
  }

  return student;
}

/**
 * Update student
 */
export async function updateStudent(
  client: PoolClient,
  schema: string,
  id: string,
  payload: Partial<StudentInput>,
  actorId?: string,
  tenantId?: string
): Promise<Student | null> {
  const repository = new StudentRepository(client, schema);

  // Get existing student to track changes
  const existing = await repository.findById(id);
  if (!existing) {
    return null;
  }

  // Update student via repository
  const updated = await repository.update(id, {
    firstName: payload.firstName,
    lastName: payload.lastName,
    dateOfBirth: payload.dateOfBirth,
    classId: payload.classId,
    admissionNumber: payload.admissionNumber,
    parentContacts: payload.parentContacts,
  });

  if (!updated) {
    return null;
  }

  // Track changes
  const changes: Record<string, unknown> = {};
  if (payload.firstName && payload.firstName !== existing.firstName) {
    changes.firstName = { from: existing.firstName, to: payload.firstName };
  }
  if (payload.lastName && payload.lastName !== existing.lastName) {
    changes.lastName = { from: existing.lastName, to: payload.lastName };
  }
  if (payload.classId && payload.classId !== existing.classId) {
    changes.classId = { from: existing.classId, to: payload.classId };
  }

  // Emit event for async workflows
  if (actorId && tenantId && Object.keys(changes).length > 0) {
    await emitEventSafely<StudentUpdatedEvent>(EventNames.STUDENT_UPDATED, {
      studentId: updated.id,
      changes,
      actorId,
      tenantId,
      timestamp: new Date(),
    });
  }

  return updated;
}

/**
 * Delete student
 */
export async function deleteStudent(
  client: PoolClient,
  schema: string,
  id: string,
  actorId?: string,
  tenantId?: string
): Promise<boolean> {
  const repository = new StudentRepository(client, schema);

  // Get student before deletion for event
  const student = await repository.findById(id);
  if (!student) {
    return false;
  }

  // Delete via repository
  const deleted = await repository.deleteById(id);

  if (deleted && actorId && tenantId) {
    // Emit event for async workflows
    await emitEventSafely<StudentDeletedEvent>(EventNames.STUDENT_DELETED, {
      studentId: student.id,
      actorId,
      tenantId,
      timestamp: new Date(),
    });
  }

  return deleted;
}

/**
 * Move student to different class
 */
export async function moveStudentToClass(
  client: PoolClient,
  schema: string,
  id: string,
  classId: string,
  actorId?: string,
  tenantId?: string
): Promise<{
  previousClassId: string | null;
  previousClassUuid: string | null;
  student: Student;
} | null> {
  const repository = new StudentRepository(client, schema);

  const result = await repository.updateClass(id, classId);

  if (result && actorId && tenantId) {
    // Emit event for class change
    await emitEventSafely<StudentUpdatedEvent>(EventNames.STUDENT_UPDATED, {
      studentId: result.student.id,
      changes: {
        classId: { from: result.previousClassId, to: result.student.classId },
      },
      actorId,
      tenantId,
      timestamp: new Date(),
    });
  }

  return result;
}

/**
 * Get student class roster
 */
export async function getStudentClassRoster(
  client: PoolClient,
  schema: string,
  studentId: string
): Promise<Array<{
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string | null;
  classId: string | null;
}> | null> {
  const repository = new StudentRepository(client, schema);
  return repository.findClassRoster(studentId);
}
