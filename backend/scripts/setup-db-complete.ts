/**
 * Complete Database Setup Script
 * This script:
 * 1. Creates the database if it doesn't exist
 * 2. Runs all migrations
 * 3. Verifies the setup
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';
import { runMigrations } from '../src/db/runMigrations';

dotenv.config();

async function setupDatabase(): Promise<void> {
  // Connect to postgres database first (to create saas_school)
  const adminPool = new Pool({
    connectionString: process.env.DATABASE_URL?.replace(/\/saas_school$/, '/postgres') || 
                      'postgres://postgres:postgres@localhost:5432/postgres',
  });

  try {
    console.log('🔍 Checking if database exists...');
    
    // Check if database exists
    const dbCheck = await adminPool.query(
      "SELECT datname FROM pg_database WHERE datname = 'saas_school'"
    );

    if (dbCheck.rows.length === 0) {
      console.log('📦 Creating database saas_school...');
      await adminPool.query('CREATE DATABASE saas_school');
      console.log('✅ Database created successfully');
    } else {
      console.log('✅ Database already exists');
    }

    await adminPool.end();

    // Now connect to saas_school and run migrations
    console.log('🔄 Running migrations...');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL || 
                        'postgres://postgres:postgres@localhost:5432/saas_school',
    });

    await runMigrations(pool);
    console.log('✅ Migrations completed successfully');

    // Verify setup
    console.log('🔍 Verifying setup...');
    const schemaCheck = await pool.query(
      "SELECT schema_name FROM information_schema.schemata WHERE schema_name = 'shared'"
    );

    if (schemaCheck.rows.length > 0) {
      console.log('✅ Shared schema exists');
      
      const tablesCheck = await pool.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'shared'"
      );
      console.log(`✅ Found ${tablesCheck.rows.length} tables in shared schema`);
    }

    await pool.end();
    console.log('🎉 Database setup completed successfully!');

  } catch (error) {
    console.error('❌ Database setup failed:', error);
    if (error instanceof Error) {
      if (error.message.includes('password authentication failed')) {
        console.error('\n💡 Password authentication failed.');
        console.error('   Please ensure your PostgreSQL password matches the .env file.');
        console.error('   Or reset it with: ALTER USER postgres WITH PASSWORD \'postgres\';');
      } else if (error.message.includes('ECONNREFUSED')) {
        console.error('\n💡 Cannot connect to PostgreSQL.');
        console.error('   Please ensure PostgreSQL is running on port 5432.');
      }
    }
    process.exit(1);
  }
}

setupDatabase();

