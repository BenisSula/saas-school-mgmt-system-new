/**
 * Notification Service
 * Manages user notifications
 */

import type { PoolClient } from 'pg';
import { getTableName } from '../lib/serviceUtils';

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

export async function getUserNotifications(
  client: PoolClient,
  schema: string,
  userId: string,
  limit: number = 50
): Promise<Notification[]> {
  const result = await client.query(
    `SELECT id, user_id, title, message, type, read, created_at, metadata
     FROM ${getTableName(schema, 'notifications')}
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit]
  );

  return result.rows.map((row) => ({
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type || 'info',
    read: row.read || false,
    createdAt: new Date(row.created_at),
    metadata: row.metadata
      ? typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata
      : undefined,
  }));
}

export async function markNotificationAsRead(
  client: PoolClient,
  schema: string,
  notificationId: string,
  userId: string
): Promise<boolean> {
  const result = await client.query(
    `UPDATE ${getTableName(schema, 'notifications')}
     SET read = true
     WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
  return (result.rowCount ?? 0) > 0;
}

export async function markAllNotificationsAsRead(
  client: PoolClient,
  schema: string,
  userId: string
): Promise<number> {
  const result = await client.query(
    `UPDATE ${getTableName(schema, 'notifications')}
     SET read = true
     WHERE user_id = $1 AND read = false`,
    [userId]
  );
  return result.rowCount || 0;
}

export async function createNotification(
  client: PoolClient,
  schema: string,
  notification: {
    userId: string;
    title: string;
    message: string;
    type?: 'info' | 'success' | 'warning' | 'error';
    metadata?: Record<string, unknown>;
  }
): Promise<Notification> {
  const result = await client.query(
    `INSERT INTO ${getTableName(schema, 'notifications')} 
     (user_id, title, message, type, read, metadata)
     VALUES ($1, $2, $3, $4, false, $5)
     RETURNING id, user_id, title, message, type, read, created_at, metadata`,
    [
      notification.userId,
      notification.title,
      notification.message,
      notification.type || 'info',
      notification.metadata ? JSON.stringify(notification.metadata) : null,
    ]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    message: row.message,
    type: row.type || 'info',
    read: row.read || false,
    createdAt: new Date(row.created_at),
    metadata: row.metadata
      ? typeof row.metadata === 'string'
        ? JSON.parse(row.metadata)
        : row.metadata
      : undefined,
  };
}
