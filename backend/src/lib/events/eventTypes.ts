/**
 * Event Type Definitions
 *
 * Centralized definitions of all events in the system.
 * Each domain should define its events here.
 */

/**
 * Student Events
 */
export interface StudentCreatedEvent extends Record<string, unknown> {
  studentId: string;
  student: {
    id: string;
    firstName: string;
    lastName: string;
    classId?: string;
  };
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

export interface StudentUpdatedEvent extends Record<string, unknown> {
  studentId: string;
  changes: Record<string, unknown>;
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

export interface StudentDeletedEvent extends Record<string, unknown> {
  studentId: string;
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

/**
 * User Events
 */
export interface UserCreatedEvent {
  userId: string;
  email: string;
  role: string;
  tenantId: string;
  timestamp: Date;
}

export interface UserUpdatedEvent {
  userId: string;
  changes: Record<string, unknown>;
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

/**
 * Teacher Events
 */
export interface TeacherCreatedEvent {
  teacherId: string;
  teacher: {
    id: string;
    firstName: string;
    lastName: string;
  };
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

/**
 * Class Events
 */
export interface ClassCreatedEvent {
  classId: string;
  className: string;
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

/**
 * Exam Events
 */
export interface ExamCreatedEvent {
  examId: string;
  examName: string;
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

/**
 * Grade Events
 */
export interface GradeSubmittedEvent {
  gradeId: string;
  studentId: string;
  examId: string;
  score: number;
  actorId: string;
  tenantId: string;
  timestamp: Date;
}

/**
 * Event Name Constants
 */
export const EventNames = {
  // Student events
  STUDENT_CREATED: 'student.created',
  STUDENT_UPDATED: 'student.updated',
  STUDENT_DELETED: 'student.deleted',

  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',

  // Teacher events
  TEACHER_CREATED: 'teacher.created',
  TEACHER_UPDATED: 'teacher.updated',

  // Class events
  CLASS_CREATED: 'class.created',
  CLASS_UPDATED: 'class.updated',

  // Exam events
  EXAM_CREATED: 'exam.created',
  EXAM_UPDATED: 'exam.updated',

  // Grade events
  GRADE_SUBMITTED: 'grade.submitted',
  GRADE_UPDATED: 'grade.updated',
} as const;

export type EventName = (typeof EventNames)[keyof typeof EventNames];
