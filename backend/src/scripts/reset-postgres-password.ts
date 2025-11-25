/**
 * Script to reset PostgreSQL password
 * This script helps reset the postgres user password to match .env
 */

import { Pool } from 'pg';
import * as readline from 'readline';
import dotenv from 'dotenv';

dotenv.config();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function resetPassword(): Promise<void> {
  console.log('\n=== PostgreSQL Password Reset Tool ===\n');

  // Try to get current password
  console.log('To reset the password, we need your current PostgreSQL password.');
  console.log("If you don't know it, you can:");
  console.log('1. Check with your system administrator');
  console.log('2. Use pgAdmin to reset it manually');
  console.log(
    '3. Run the PowerShell script: scripts\\fix-postgres-password.ps1 (as Administrator)\n'
  );

  const currentPassword = await question(
    'Enter your current PostgreSQL password (or press Enter to skip): '
  );

  if (!currentPassword || currentPassword.trim() === '') {
    console.log('\n⚠️  Skipping automated reset.');
    console.log('\nManual steps:');
    console.log('1. Open pgAdmin');
    console.log('2. Connect to PostgreSQL server');
    console.log("3. Run: ALTER USER postgres WITH PASSWORD 'postgres';");
    console.log('4. Then run: npm run setup:db\n');
    rl.close();
    return;
  }

  // Try to connect with current password
  const testPool = new Pool({
    connectionString: `postgres://postgres:${currentPassword}@localhost:5432/postgres`,
  });

  try {
    console.log('\n🔍 Testing connection with provided password...');
    await testPool.query('SELECT 1');
    console.log('✅ Connection successful!\n');

    console.log("🔄 Resetting password to 'postgres'...");
    await testPool.query("ALTER USER postgres WITH PASSWORD 'postgres';");
    console.log('✅ Password reset successfully!\n');

    // Test new password
    console.log('🔍 Testing new password...');
    const newPool = new Pool({
      connectionString: 'postgres://postgres:postgres@localhost:5432/postgres',
    });
    await newPool.query('SELECT 1');
    console.log('✅ New password works!\n');

    await newPool.end();
    await testPool.end();

    console.log("🎉 Password has been successfully reset to 'postgres'!");
    console.log('\nNext steps:');
    console.log('1. Run: npm run setup:db');
    console.log('2. Run: npm run dev\n');
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error('\n❌ Failed to reset password:', err.message);

    if (err.code === '28P01') {
      console.error('\n💡 The password you entered is incorrect.');
      console.error('Please try again or use pgAdmin to reset it manually.\n');
    } else {
      console.error('\nError details:', err);
    }

    await testPool.end().catch(() => {});
  }

  rl.close();
}

resetPassword().catch((error) => {
  console.error('Unexpected error:', error);
  rl.close();
  process.exit(1);
});
