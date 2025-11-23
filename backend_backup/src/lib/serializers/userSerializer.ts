/**
 * User Serializer
 * Provides utilities for resolving user IDs to user information
 */

import { Pool } from 'pg';

export interface UserInfo {
  id: string;
  email: string;
  fullName?: string | null;
  role?: string | null;
}

/**
 * Resolve user ID to user email/name
 * Returns null if user not found
 */
export async function resolveUserId(
  pool: Pool,
  userId: string | null | undefined
): Promise<UserInfo | null> {
  if (!userId) {
    return null;
  }
  
  try {
    const result = await pool.query(
      `
        SELECT id, email, full_name, role
        FROM shared.users
        WHERE id = $1
      `,
      [userId]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name || null,
      role: row.role || null
    };
  } catch (error) {
    console.error('[userSerializer] Error resolving user:', error);
    return null;
  }
}

/**
 * Resolve multiple user IDs to user info map
 * Returns map of userId -> UserInfo
 */
export async function resolveUserIds(
  pool: Pool,
  userIds: (string | null | undefined)[]
): Promise<Map<string, UserInfo>> {
  const validIds = userIds.filter((id): id is string => Boolean(id));
  
  if (validIds.length === 0) {
    return new Map();
  }
  
  try {
    const result = await pool.query(
      `
        SELECT id, email, full_name, role
        FROM shared.users
        WHERE id = ANY($1::uuid[])
      `,
      [validIds]
    );
    
    const userMap = new Map<string, UserInfo>();
    for (const row of result.rows) {
      userMap.set(row.id, {
        id: row.id,
        email: row.email,
        fullName: row.full_name || null,
        role: row.role || null
      });
    }
    
    return userMap;
  } catch (error) {
    console.error('[userSerializer] Error resolving users:', error);
    return new Map();
  }
}

