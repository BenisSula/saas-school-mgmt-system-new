import type { AuthUser, UserStatus } from './api';

const ACTIVE_STATUS: UserStatus = 'active';

/**
 * Normalizes a user object to ensure it has a valid status.
 * Status is now always provided by backend, but we keep this for backward compatibility
 * and to ensure we always have a valid status.
 *
 * @param user - The user object to normalize
 * @returns The normalized user object with a guaranteed status field
 */
export function normalizeUser(user: AuthUser): AuthUser {
  return {
    ...user,
    status: user.status ?? ACTIVE_STATUS,
  };
}

/**
 * Ensures that a user has an active status.
 * Throws an error if the user is not active.
 *
 * @param user - The user object to check
 * @throws {Error} If the user is not active
 */
export function ensureActive(user: AuthUser): void {
  if ((user.status ?? ACTIVE_STATUS) !== ACTIVE_STATUS) {
    const statusLabel = user.status === 'pending' ? 'pending admin approval' : 'inactive';
    throw new Error(`Account ${statusLabel}.`);
  }
}

/**
 * Checks if a user has an active status.
 *
 * @param user - The user object to check
 * @returns True if the user is active, false otherwise
 */
export function isActive(user: AuthUser): boolean {
  return (user.status ?? ACTIVE_STATUS) === ACTIVE_STATUS;
}
