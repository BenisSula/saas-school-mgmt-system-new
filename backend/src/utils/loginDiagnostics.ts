/**
 * Diagnostic utility to help identify login issues
 * This can be called from the login route to get detailed error information
 */

import { getPool } from '../db/connection';

export interface LoginDiagnostics {
  databaseConnected: boolean;
  userTableExists: boolean;
  statusColumnExists: boolean;
  userFound: boolean;
  hasPasswordHash: boolean;
  hasStatus: boolean;
  errors: string[];
}

export async function diagnoseLoginIssue(email: string): Promise<LoginDiagnostics> {
  const diagnostics: LoginDiagnostics = {
    databaseConnected: false,
    userTableExists: false,
    statusColumnExists: false,
    userFound: false,
    hasPasswordHash: false,
    hasStatus: false,
    errors: [],
  };

  try {
    const pool = getPool();
    diagnostics.databaseConnected = true;

    // Check if users table exists
    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'shared' 
          AND table_name = 'users'
        )
      `);
      diagnostics.userTableExists = tableCheck.rows[0]?.exists ?? false;
    } catch (error) {
      diagnostics.errors.push(`Table check failed: ${(error as Error).message}`);
    }

    // Check if status column exists
    if (diagnostics.userTableExists) {
      try {
        const columnCheck = await pool.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_schema = 'shared' 
            AND table_name = 'users'
            AND column_name = 'status'
          )
        `);
        diagnostics.statusColumnExists = columnCheck.rows[0]?.exists ?? false;
      } catch (error) {
        diagnostics.errors.push(`Column check failed: ${(error as Error).message}`);
      }
    }

    // Try to find user
    if (diagnostics.userTableExists) {
      try {
        const userResult = await pool.query(
          `SELECT id, email, password_hash, status FROM shared.users WHERE email = $1`,
          [email.toLowerCase()]
        );

        if (userResult.rows.length > 0) {
          diagnostics.userFound = true;
          const user = userResult.rows[0];
          diagnostics.hasPasswordHash = !!user.password_hash;
          diagnostics.hasStatus = user.status !== null && user.status !== undefined;
        }
      } catch (error) {
        diagnostics.errors.push(`User query failed: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    diagnostics.errors.push(`Database connection failed: ${(error as Error).message}`);
  }

  return diagnostics;
}
