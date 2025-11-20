/**
 * Password hashing utilities using Argon2id
 * Provides secure password hashing with configurable parameters
 */

import argon2 from 'argon2';

/**
 * Argon2id hashing options
 * Using recommended parameters for production security
 */
const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id, // Use Argon2id (resistant to both GPU and side-channel attacks)
  memoryCost: 65536, // 64 MB (2^16 KB) - memory cost
  timeCost: 3, // Number of iterations
  parallelism: 4, // Number of threads
  hashLength: 32 // Output hash length in bytes
};

/**
 * Hash a password using Argon2id
 * @param password - Plain text password
 * @returns Hashed password string
 */
export async function hashPassword(password: string): Promise<string> {
  try {
    return await argon2.hash(password, ARGON2_OPTIONS);
  } catch (error) {
    console.error('[passwordHashing] Error hashing password:', error);
    throw new Error('Failed to hash password');
  }
}

/**
 * Verify a password against a hash
 * @param hash - Hashed password from database
 * @param password - Plain text password to verify
 * @returns True if password matches, false otherwise
 */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch (error) {
    console.error('[passwordHashing] Error verifying password:', error);
    return false;
  }
}

/**
 * Check if a hash needs rehashing (e.g., if parameters changed)
 * This can be used to gradually upgrade password hashes
 */
export function needsRehash(hash: string): boolean {
  // Argon2 hashes start with $argon2id$ or $argon2i$ or $argon2d$
  // Check if it's using the correct type
  if (!hash.startsWith('$argon2id$')) {
    return true;
  }

  // Could also check memoryCost, timeCost, etc. if needed
  // For now, just check the type
  return false;
}

