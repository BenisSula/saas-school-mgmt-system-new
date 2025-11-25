/**
 * Search Service
 * Provides unified search across students, teachers, classes, and subjects
 */

import type { PoolClient } from 'pg';
import { getTableName } from '../lib/serviceUtils';

export interface SearchResult {
  type: 'student' | 'teacher' | 'class' | 'subject';
  id: string;
  title: string;
  subtitle?: string;
  metadata?: Record<string, unknown>;
}

export interface SearchOptions {
  limit?: number;
  types?: SearchResult['type'][];
}

export async function search(
  client: PoolClient,
  schema: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const { limit = 20, types = ['student', 'teacher', 'class', 'subject'] } = options;
  const searchTerm = `%${query.toLowerCase()}%`;
  const results: SearchResult[] = [];

  // Search students
  if (types.includes('student')) {
    const studentsResult = await client.query(
      `SELECT id, full_name, student_id, class_id 
       FROM ${getTableName(schema, 'students')} 
       WHERE LOWER(full_name) LIKE $1 
          OR LOWER(student_id) LIKE $1 
       LIMIT $2`,
      [searchTerm, Math.ceil(limit / types.length)]
    );
    for (const row of studentsResult.rows) {
      results.push({
        type: 'student',
        id: row.id,
        title: row.full_name,
        subtitle: `Student ID: ${row.student_id}`,
        metadata: { classId: row.class_id }
      });
    }
  }

  // Search teachers
  if (types.includes('teacher')) {
    const teachersResult = await client.query(
      `SELECT id, full_name, teacher_id, phone 
       FROM ${getTableName(schema, 'teachers')} 
       WHERE LOWER(full_name) LIKE $1 
          OR LOWER(teacher_id) LIKE $1 
          OR LOWER(phone) LIKE $1 
       LIMIT $2`,
      [searchTerm, Math.ceil(limit / types.length)]
    );
    for (const row of teachersResult.rows) {
      results.push({
        type: 'teacher',
        id: row.id,
        title: row.full_name,
        subtitle: `Teacher ID: ${row.teacher_id}`,
        metadata: { phone: row.phone }
      });
    }
  }

  // Search classes
  if (types.includes('class')) {
    const classesResult = await client.query(
      `SELECT id, name, level 
       FROM ${getTableName(schema, 'classes')} 
       WHERE LOWER(name) LIKE $1 
          OR LOWER(level) LIKE $1 
       LIMIT $2`,
      [searchTerm, Math.ceil(limit / types.length)]
    );
    for (const row of classesResult.rows) {
      results.push({
        type: 'class',
        id: row.id,
        title: row.name,
        subtitle: `Level: ${row.level}`,
        metadata: { level: row.level }
      });
    }
  }

  // Search subjects
  if (types.includes('subject')) {
    const subjectsResult = await client.query(
      `SELECT id, name, code 
       FROM ${getTableName(schema, 'subjects')} 
       WHERE LOWER(name) LIKE $1 
          OR LOWER(code) LIKE $1 
       LIMIT $2`,
      [searchTerm, Math.ceil(limit / types.length)]
    );
    for (const row of subjectsResult.rows) {
      results.push({
        type: 'subject',
        id: row.id,
        title: row.name,
        subtitle: `Code: ${row.code}`,
        metadata: { code: row.code }
      });
    }
  }

  return results.slice(0, limit);
}

