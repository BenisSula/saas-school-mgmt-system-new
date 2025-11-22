/**
 * Student Dashboard Service
 * Provides data for student dashboard
 */

import type { PoolClient } from 'pg';
import { assertValidSchemaName } from '../db/tenantManager';
import { getStudentAttendance, getAttendanceSummary } from './attendanceService';
import { getClassResources } from './classResourcesService';
import { getClassAnnouncements } from './teacherAnnouncementsService';

export interface StudentDashboardData {
  attendance: {
    summary: {
      present: number;
      total: number;
      percentage: number;
    };
    recent: Array<{
      date: string;
      status: string;
    }>;
  };
  grades: {
    recent: Array<{
      subject: string;
      score: number;
      grade: string | null;
      exam: string | null;
      date: Date;
    }>;
    summary: {
      average: number;
      totalSubjects: number;
    };
  };
  classSchedule: Array<{
    day: string;
    time: string;
    subject: string;
    teacher: string;
  }>;
  resources: Array<{
    id: string;
    title: string;
    description: string | null;
    file_url: string;
    file_type: string;
    created_at: Date;
  }>;
  announcements: Array<{
    id: string;
    message: string;
    teacher_name: string | null;
    created_at: Date;
  }>;
  upcomingTasks: Array<{
    id: string;
    title: string;
    dueDate: Date;
    subject: string;
  }>;
}

/**
 * Get student dashboard data
 */
export async function getStudentDashboard(
  client: PoolClient,
  schema: string,
  studentId: string,
  classId: string
): Promise<StudentDashboardData> {
  assertValidSchemaName(schema);

  // Verify student belongs to class
  const studentCheck = await client.query<{ class_id: string | null; class_uuid: string | null }>(
    `SELECT class_id, class_uuid FROM ${schema}.students WHERE id = $1`,
    [studentId]
  );

  if (studentCheck.rows.length === 0) {
    throw new Error('Student not found');
  }

  const student = studentCheck.rows[0];
  const isInClass =
    student.class_id === classId ||
    student.class_uuid === classId ||
    (typeof classId === 'string' && (student.class_id === classId || student.class_uuid === classId));

  if (!isInClass) {
    throw new Error('Student does not belong to this class');
  }

  // Get attendance summary
  const attendanceSummary = await getAttendanceSummary(client, schema, studentId);
  const attendanceHistory = await getStudentAttendance(client, schema, studentId);
  const recentAttendance = attendanceHistory.slice(0, 10).map((record) => ({
    date: record.attendance_date,
    status: record.status
  }));

  // Get recent grades
  const gradesResult = await client.query(
    `
      SELECT 
        g.*,
        s.name as subject_name,
        e.name as exam_name
      FROM ${schema}.grades g
      LEFT JOIN ${schema}.subjects s ON g.subject_id = s.id
      LEFT JOIN ${schema}.exams e ON g.exam_id = e.id
      WHERE g.student_id = $1
      ORDER BY g.created_at DESC
      LIMIT 10
    `,
    [studentId]
  );

  const recentGrades = gradesResult.rows.map((row) => ({
    subject: row.subject_name || row.subject_id || 'Unknown',
    score: row.score,
    grade: row.grade || null,
    exam: row.exam_name || null,
    date: row.created_at
  }));

  // Calculate grade summary
  const allGradesResult = await client.query<{ score: number; subject_id: string | null }>(
    `SELECT score, subject_id FROM ${schema}.grades WHERE student_id = $1`,
    [studentId]
  );
  const allScores = allGradesResult.rows.map((r) => r.score);
  const average = allScores.length > 0 ? allScores.reduce((a, b) => a + b, 0) / allScores.length : 0;
  const uniqueSubjects = new Set(allGradesResult.rows.map((r) => r.subject_id).filter(Boolean));

  // Get class schedule (placeholder - would need schedule table)
  const classSchedule: Array<{ day: string; time: string; subject: string; teacher: string }> = [];

  // Get class resources
  const resources = await getClassResources(client, schema, classId);

  // Get class announcements
  const announcements = await getClassAnnouncements(client, schema, classId, 10);

  // Get upcoming tasks (placeholder - would need assignments/tasks table)
  const upcomingTasks: Array<{ id: string; title: string; dueDate: Date; subject: string }> = [];

  return {
    attendance: {
      summary: attendanceSummary,
      recent: recentAttendance
    },
    grades: {
      recent: recentGrades,
      summary: {
        average: Math.round(average * 100) / 100,
        totalSubjects: uniqueSubjects.size
      }
    },
    classSchedule,
    resources: resources.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      file_url: r.file_url,
      file_type: r.file_type,
      created_at: r.created_at
    })),
    announcements: announcements.map((a) => ({
      id: a.id,
      message: a.message,
      teacher_name: a.teacher_name || null,
      created_at: a.created_at
    })),
    upcomingTasks
  };
}

