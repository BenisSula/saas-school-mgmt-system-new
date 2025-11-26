import { Pool, PoolClient } from 'pg';
import fs from 'fs';
import path from 'path';
import { getPool } from './connection';
import crypto from 'crypto';

export function assertValidSchemaName(schemaName: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(schemaName)) {
    throw new Error('Invalid schema name');
  }
}

export function createSchemaSlug(name: string): string {
  return `tenant_${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')}`;
}

interface TenantInput {
  name: string;
  domain?: string;
  schemaName: string;
  subscriptionType?: 'free' | 'trial' | 'paid';
  status?: 'active' | 'suspended' | 'deleted';
  billingEmail?: string | null;
}

export async function createTenantRecord(
  pool: Pool,
  { name, domain, schemaName, subscriptionType, status, billingEmail }: TenantInput
): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  const result = await pool.query(
    `
      INSERT INTO shared.tenants (id, name, domain, schema_name, subscription_type, status, billing_email)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id
    `,
    [
      id,
      name,
      domain ?? null,
      schemaName,
      subscriptionType ?? 'trial',
      status ?? 'active',
      billingEmail ?? null,
    ]
  );

  return { id: result.rows[0].id };
}

export async function createTenantSchema(pool: Pool, schemaName: string): Promise<void> {
  assertValidSchemaName(schemaName);
  await pool.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);
}

export async function runTenantMigrations(pool: Pool, schemaName: string): Promise<void> {
  const migrationsDir = path.resolve(__dirname, 'migrations', 'tenants');
  let files: string[] = [];
  try {
    files = (await fs.promises.readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ENOENT'
    ) {
      return;
    }
    throw error;
  }

  const client = await pool.connect();
  try {
    assertValidSchemaName(schemaName);
    await client.query(`SET search_path TO ${schemaName}, public`);
    
    if (files.length === 0) {
      console.log(`  ℹ️  No tenant migration files found for schema: ${schemaName}`);
      return;
    }
    
    console.log(`  📋 Found ${files.length} tenant migration file(s) for ${schemaName}`);
    
    for (const file of files) {
      console.log(`  🔄 Running tenant migration: ${file}...`);
      const sql = await fs.promises.readFile(path.join(migrationsDir, file), 'utf-8');
      const renderedSql = sql.replace(/{{schema}}/g, schemaName);

      // If file contains DO blocks, execute as single statement to avoid parsing issues
      // This is safer for complex nested DO blocks
      // Check for DO blocks (case-insensitive, handle various whitespace)
      const hasDoBlock = /DO\s+\$\$?/i.test(renderedSql);
      if (hasDoBlock) {
        try {
          // Execute the entire file as a single statement
          // PostgreSQL can handle the entire DO block as one statement
          await client.query(renderedSql);
          console.log(`  ✅ Tenant migration ${file} completed successfully`);
          continue;
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          console.error(`  ❌ [Migration Error] Failed to execute ${file}:`);
          console.error(`  ❌ [Migration Error] Error: ${errorMsg}`);
          // Log first 1000 chars of SQL for debugging (shows DO block start)
          const sqlPreview = renderedSql.substring(0, 1000).replace(/\n/g, '\\n');
          console.error(`  ❌ [Migration Error] SQL preview (first 1000 chars): ${sqlPreview}...`);
          throw new Error(`Migration failed in ${file}: ${errorMsg}`);
        }
      }

      // Split SQL statements properly, handling:
      // - Comments (-- style)
      // - String literals (single quotes)
      // - Dollar-quoted strings ($$ ... $$, including nested)
      // - Parentheses (for CHECK constraints, function calls, etc.)
      // - Semicolons that are actual statement terminators
      const statements: string[] = [];
      let currentStatement = '';
      let inString = false;
      let inComment = false;
      const dollarQuoteStack: string[] = []; // Stack to handle nested dollar quotes
      let parenDepth = 0;

      for (let i = 0; i < renderedSql.length; i++) {
        const char = renderedSql[i];
        const nextChar = renderedSql[i + 1] || '';
        const prevChar = renderedSql[i - 1] || '';

        // Handle comments
        if (!inString && dollarQuoteStack.length === 0 && char === '-' && nextChar === '-') {
          inComment = true;
          currentStatement += char;
          continue;
        }

        if (inComment) {
          currentStatement += char;
          if (char === '\n' || char === '\r') {
            inComment = false;
          }
          continue;
        }

        // Handle dollar-quoted strings ($$ ... $$, $tag$ ... $tag$, etc.)
        // Use a stack to handle nested dollar quotes
        if (!inString && char === '$') {
          // Check if this could be a dollar quote tag
          let tagEnd = i + 1;
          while (tagEnd < renderedSql.length && renderedSql[tagEnd] !== '$') {
            tagEnd++;
          }
          if (tagEnd < renderedSql.length) {
            const potentialTag = renderedSql.substring(i, tagEnd + 1);
            
            // Check if this matches the current top-of-stack tag (closing)
            if (dollarQuoteStack.length > 0 && dollarQuoteStack[dollarQuoteStack.length - 1] === potentialTag) {
              // This is a closing tag
              currentStatement += potentialTag;
              i = tagEnd; // Skip the tag
              dollarQuoteStack.pop(); // Remove from stack
              continue;
            } else {
              // This is an opening tag
              currentStatement += potentialTag;
              i = tagEnd; // Skip the tag
              dollarQuoteStack.push(potentialTag); // Add to stack
              continue;
            }
          }
        }

        // If we're inside a dollar quote, just add the character
        if (dollarQuoteStack.length > 0) {
          currentStatement += char;
          continue;
        }

        // Handle string literals (only if not in dollar quote)
        if (char === "'" && prevChar !== '\\') {
          inString = !inString;
          currentStatement += char;
          continue;
        }

        if (inString) {
          currentStatement += char;
          continue;
        }

        // Track parentheses depth
        if (char === '(') {
          parenDepth++;
          currentStatement += char;
          continue;
        }

        if (char === ')') {
          parenDepth--;
          currentStatement += char;
          continue;
        }

        // Only split on semicolon if we're not in a string, comment, dollar quote, or nested parentheses
        if (char === ';' && parenDepth === 0 && !inString && !inComment && dollarQuoteStack.length === 0) {
          currentStatement += char;
          const trimmed = currentStatement.trim();
          // Filter out empty statements and comments-only statements
          const cleaned = trimmed.replace(/--.*$/gm, '').trim();
          if (cleaned.length > 0 && !cleaned.match(/^\s*$/)) {
            statements.push(trimmed);
          }
          currentStatement = '';
          continue;
        }

        currentStatement += char;
      }

      // Add any remaining statement (shouldn't happen with proper SQL, but handle it)
      if (currentStatement.trim()) {
        const trimmed = currentStatement.trim();
        const cleaned = trimmed.replace(/--.*$/gm, '').trim();
        if (cleaned.length > 0 && !cleaned.match(/^\s*$/)) {
          statements.push(trimmed);
        }
      }

      for (let idx = 0; idx < statements.length; idx++) {
        let statement = statements[idx];
        if (statement.trim()) {
          // Safety check: If statement starts with DECLARE but doesn't have DO $$, 
          // it means the splitter broke a DO block. Try to fix it by checking previous statements.
          if (statement.trim().toUpperCase().startsWith('DECLARE') && !statement.toUpperCase().includes('DO $$')) {
            // This is a broken DO block - try to reconstruct it
            // Look for DO $$ in previous statements or combine with previous
            if (idx > 0 && statements[idx - 1].toUpperCase().includes('DO $$')) {
              // Combine with previous statement
              statement = statements[idx - 1] + '\n' + statement;
              // Remove the previous statement from execution (it's now part of this one)
              statements[idx - 1] = '';
            } else {
              // Can't fix automatically - this is a parsing error
              console.error(
                `[Migration Error] Statement ${idx + 1} appears to be a broken DO block (starts with DECLARE but missing DO $$)`
              );
            }
          }
          
          if (statement.trim()) {
            try {
              await client.query(statement);
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error);
              console.error(
                `[Migration Error] Failed to execute statement ${idx + 1}/${statements.length} in file ${file}:`
              );
              console.error(
                `[Migration Error] Statement: ${statement.substring(0, 200)}${statement.length > 200 ? '...' : ''}`
              );
              console.error(`[Migration Error] Error: ${errorMsg}`);
              throw new Error(
                `Migration failed in ${file} at statement ${idx + 1}: ${errorMsg}\nStatement: ${statement.substring(0, 100)}...`
              );
            }
          }
        }
      }
    }
  } finally {
    await client.query('SET search_path TO public');
    client.release();
  }
}

export async function seedTenant(pool: Pool, schemaName: string): Promise<void> {
  const client = await pool.connect();
  try {
    assertValidSchemaName(schemaName);
    await client.query(
      `
        INSERT INTO ${schemaName}.branding_settings (id, logo_url, primary_color, secondary_color, theme_flags)
        VALUES (uuid_generate_v4(), NULL, '#1d4ed8', '#0f172a', '{}'::jsonb)
        ON CONFLICT (id) DO NOTHING
      `
    );
    await client.query(
      `
        INSERT INTO ${schemaName}.grade_scales (id, min_score, max_score, grade, remark)
        VALUES
          (uuid_generate_v4(), 90, 100, 'A+', 'Outstanding'),
          (uuid_generate_v4(), 80, 89.99, 'A', 'Excellent'),
          (uuid_generate_v4(), 70, 79.99, 'B', 'Very Good'),
          (uuid_generate_v4(), 60, 69.99, 'C', 'Good'),
          (uuid_generate_v4(), 50, 59.99, 'D', 'Satisfactory'),
          (uuid_generate_v4(), 0, 49.99, 'F', 'Needs Improvement')
        ON CONFLICT (grade) DO NOTHING
      `
    );
  } finally {
    client.release();
  }
}

export async function createTenant(input: TenantInput, poolParam?: Pool): Promise<{ id: string }> {
  const pool = poolParam ?? getPool();

  await createTenantSchema(pool, input.schemaName);
  await runTenantMigrations(pool, input.schemaName);
  await seedTenant(pool, input.schemaName);
  const tenant = await createTenantRecord(pool, input);

  return tenant;
}

export async function withTenantSearchPath<T>(
  pool: Pool,
  schemaName: string,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    assertValidSchemaName(schemaName);
    await client.query(`SET search_path TO ${schemaName}, public`);
    return await fn(client);
  } finally {
    await client.query('SET search_path TO public');
    client.release();
  }
}
