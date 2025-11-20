/**
 * Shared formatting utilities for consistent display across components
 */

import { formatDateTime } from '../lib/utils/date';

export interface NormalizedDeviceInfo {
  platform?: string;
  os?: string;
  browser?: string;
  deviceType?: 'mobile' | 'tablet' | 'desktop';
  raw?: string;
}

/**
 * Format device info for display
 */
export function formatDeviceInfo(deviceInfo: NormalizedDeviceInfo | Record<string, unknown> | null | undefined): string {
  if (!deviceInfo) return '—';
  
  const normalized = deviceInfo as NormalizedDeviceInfo;
  
  const parts: string[] = [];
  if (normalized.platform) parts.push(normalized.platform);
  if (normalized.os) parts.push(normalized.os);
  if (normalized.browser) parts.push(normalized.browser);
  
  return parts.length > 0 ? parts.join(' • ') : '—';
}

/**
 * Format device platform for display
 */
export function formatDevicePlatform(deviceInfo: NormalizedDeviceInfo | Record<string, unknown> | null | undefined): string {
  if (!deviceInfo) return '—';
  const normalized = deviceInfo as NormalizedDeviceInfo;
  return normalized.platform || normalized.deviceType || '—';
}

/**
 * Format device OS for display
 */
export function formatDeviceOS(deviceInfo: NormalizedDeviceInfo | Record<string, unknown> | null | undefined): string {
  if (!deviceInfo) return '—';
  const normalized = deviceInfo as NormalizedDeviceInfo;
  return normalized.os || '—';
}

/**
 * Format device browser for display
 */
export function formatDeviceBrowser(deviceInfo: NormalizedDeviceInfo | Record<string, unknown> | null | undefined): string {
  if (!deviceInfo) return '—';
  const normalized = deviceInfo as NormalizedDeviceInfo;
  return normalized.browser || '—';
}

/**
 * Format currency amount
 * Re-exported from lib/utils/data for backward compatibility
 * Use lib/utils/data directly for new code
 */
export { formatCurrency } from '../lib/utils/data';

/**
 * Format date/time with relative time option
 */
export function formatDate(date: string | Date | null | undefined, relative: boolean = false): string {
  if (!date) return '—';
  
  if (relative) {
    const now = new Date();
    const then = new Date(date);
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
  }
  
  const dateStr = typeof date === 'string' ? date : date.toISOString();
  return formatDateTime(dateStr);
}

/**
 * Re-export formatDateTime for convenience
 */
export { formatDateTime } from '../lib/utils/date';

/**
 * Format user agent string (truncate if too long)
 */
export function formatUserAgent(userAgent: string | null | undefined, maxLength: number = 50): string {
  if (!userAgent) return '—';
  if (userAgent.length <= maxLength) return userAgent;
  return `${userAgent.slice(0, maxLength)}...`;
}

/**
 * Format metadata reason
 */
export function formatMetadataReason(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return '—';
  const reason = metadata.reason || metadata.failureReason || metadata.description;
  return typeof reason === 'string' ? reason : '—';
}

/**
 * Format metadata notification status
 */
export function formatNotificationStatus(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return '—';
  const sent = metadata.notificationSent || metadata.notification_sent || metadata.emailSent;
  if (sent === true || sent === 'true') return 'Sent';
  if (sent === false || sent === 'false') return 'Not Sent';
  return '—';
}

/**
 * Format changed by user info
 */
export function formatChangedBy(
  changedBy: string | null | undefined,
  changedByEmail?: string | null,
  changedByName?: string | null
): string {
  if (changedByName) return changedByName;
  if (changedByEmail) return changedByEmail;
  if (changedBy) return `User ${changedBy.slice(0, 8)}...`;
  return 'Self';
}

/**
 * Format request ID (truncate)
 */
export function formatRequestId(requestId: string | null | undefined): string {
  if (!requestId) return '—';
  if (requestId.length <= 12) return requestId;
  return `${requestId.slice(0, 8)}...${requestId.slice(-4)}`;
}

/**
 * Format tags array as comma-separated string
 */
export function formatTags(tags: string[] | null | undefined): string {
  if (!tags || tags.length === 0) return '—';
  return tags.join(', ');
}

