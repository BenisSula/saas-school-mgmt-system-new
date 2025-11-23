/**
 * Centralized formatting utilities for consistent display across the application
 * This file consolidates all formatting functions for dates, numbers, currency, etc.
 */

import { formatDateTime, formatDateShort } from './date';
import { formatCurrency as formatCurrencyUtil, formatNumber as formatNumberUtil } from './data';

// Re-export date formatters
export { formatDateTime, formatDateShort };

/**
 * Standardized date formatting
 * Uses consistent locale and format across the app
 */
export function formatDate(
  value: string | Date | null | undefined,
  relative: boolean = false
): string {
  if (!value) return '—';

  if (relative) {
    const now = new Date();
    const then = typeof value === 'string' ? new Date(value) : value;
    const diffMs = now.getTime() - then.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
  }

  const dateStr = typeof value === 'string' ? value : value.toISOString();
  return formatDateTime(dateStr);
}

/**
 * Standardized number formatting
 * Uses Intl.NumberFormat for consistent locale-aware formatting
 * Note: options parameter reserved for future use
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function formatNumber(
  value: number | null | undefined,
  _options?: Intl.NumberFormatOptions
): string {
  if (value === null || value === undefined) return '—';
  return formatNumberUtil(value);
}

/**
 * Standardized currency formatting
 * Uses Intl.NumberFormat with currency style
 * Note: options parameter reserved for future use
 */
export function formatCurrency(
  amount: number | null | undefined,
  currency: string = 'USD',
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _options?: Intl.NumberFormatOptions
): string {
  if (amount === null || amount === undefined) return '—';
  return formatCurrencyUtil(amount, currency);
}

/**
 * Format percentage
 */
export function formatPercentage(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined) return '—';
  return `${value.toFixed(decimals)}%`;
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Format duration (milliseconds to human-readable)
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}
