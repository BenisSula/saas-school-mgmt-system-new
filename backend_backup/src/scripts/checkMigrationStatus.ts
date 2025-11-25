/**
 * Script to check migration status and identify issues
 * Usage: ts-node src/scripts/checkMigrationStatus.ts
 */

import { getPool, closePool } from '../db/connection';
import path from 'path';
import fs from 'fs/promises';

async function checkMigrationStatus(): Promise<void> {
  const pool = getPool();

  try {
    console.log('🔍 Checking database schema...\n');

    // Check if subscriptions table exists and its structure
    const subscriptionsCheck = await pool.query(`
      SELECT 
        column_name, 
        data_type, 
        is_nullable
      FROM information_schema.columns 
      WHERE table_schema = 'shared' 
      AND table_name = 'subscriptions'
      ORDER BY ordinal_position;
    `);

    if (subscriptionsCheck.rows.length > 0) {
      console.log('✅ subscriptions table exists');
      console.log('   Columns:');
      subscriptionsCheck.rows.forEach((col) => {
        console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
      });
    } else {
      console.log('❌ subscriptions table does not exist');
    }

    // Check if payments table exists
    const paymentsCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'shared' AND table_name = 'payments';
    `);
    console.log(`\n${paymentsCheck.rows[0].count > 0 ? '✅' : '❌'} payments table ${paymentsCheck.rows[0].count > 0 ? 'exists' : 'does not exist'}`);

    // Check if invoices table exists
    const invoicesCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'shared' AND table_name = 'invoices';
    `);
    console.log(`${invoicesCheck.rows[0].count > 0 ? '✅' : '❌'} invoices table ${invoicesCheck.rows[0].count > 0 ? 'exists' : 'does not exist'}`);

    // Check if external_events table exists
    const externalEventsCheck = await pool.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables 
      WHERE table_schema = 'shared' AND table_name = 'external_events';
    `);
    console.log(`${externalEventsCheck.rows[0].count > 0 ? '✅' : '❌'} external_events table ${externalEventsCheck.rows[0].count > 0 ? 'exists' : 'does not exist'}`);

    // List all migrations
    console.log('\n📋 Migration files:');
    const migrationsDir = path.resolve(__dirname, '../db/migrations');
    const files = (await fs.readdir(migrationsDir))
      .filter((file) => file.endsWith('.sql'))
      .sort();
    
    files.forEach((file, index) => {
      console.log(`   ${index + 1}. ${file}`);
    });

    console.log('\n💡 If migration 029 is failing, it might be due to:');
    console.log('   1. Table structure mismatch between migrations 004 and 019');
    console.log('   2. Missing columns in existing tables');
    console.log('   3. Index creation on non-existent columns');

  } catch (error) {
    console.error('Error checking migration status:', error);
  } finally {
    await closePool();
  }
}

checkMigrationStatus().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});

