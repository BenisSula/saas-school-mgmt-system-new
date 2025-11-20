import app from './app';
import http from 'http';
import { wsManager } from './lib/websocket';
import { getPool } from './db/connection';
import { runMigrations } from './db/runMigrations';
// Seed data removed - use seedSuperUserOnly.ts script instead
import { validateRequiredEnvVars } from './lib/envValidation';
import { initializeEmailService } from './services/emailService';
import { printEmailConfigValidation } from './lib/emailConfigValidator';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

function listenWithRetry(server: http.Server, startPort: number, attempts = 5): void {
  let currentPort = startPort;
  let remaining = Math.max(1, attempts);
  const tryListen = () => {
    server.once('error', (err: Error & { code?: string }) => {
      if (err.code === 'EADDRINUSE' && remaining > 1) {
        remaining -= 1;
        currentPort += 1;
        console.warn(`Port ${currentPort - 1} in use. Retrying on ${currentPort}...`);
        setTimeout(() => {
          server.listen(currentPort);
        }, 200);
      } else {
        console.error('Failed to bind server:', err);
        process.exit(1);
      }
    });
    server.listen(currentPort, () => {
      console.log(`Backend server listening on port ${currentPort}`);
    });
  };
  tryListen();
}

async function startServer(): Promise<void> {
  // Validate required environment variables (especially JWT secrets)
  try {
    validateRequiredEnvVars();
  } catch (error) {
    console.error('❌ Environment validation failed:', (error as Error).message);
    process.exit(1);
  }

  const pool = getPool();

  try {
    // Validate and initialize email service
    printEmailConfigValidation();
    initializeEmailService();

    // Skip migrations if SKIP_MIGRATIONS is set (useful for development/testing)
    if (process.env.SKIP_MIGRATIONS !== 'true') {
      await runMigrations(pool);
    } else {
      console.warn('⚠️  Skipping migrations (SKIP_MIGRATIONS=true)');
    }

    // Seed data removed - only superuser should be seeded manually via seedSuperUserOnly.ts
    // To seed superuser, run: npm run seed:superuser

    await pool.query('SELECT 1');
    const server = http.createServer(app);
    // Initialize WebSocket manager (safe even if 'ws' not installed; it will log a warning)
    try {
      wsManager.initialize(server);
    } catch {
      // noop
    }
    listenWithRetry(server, PORT, 5);
  } catch (error) {
    const err = error as Error & { code?: string };
    console.error('\n❌ Failed to start server due to DB connection error\n');

    if (err.code === '28P01') {
      console.error('🔐 Password Authentication Failed');
      console.error(
        '\nThe PostgreSQL password in your .env file does not match your PostgreSQL server.'
      );
      console.error('\n📋 To fix this:');
      console.error('   Option 1: Reset PostgreSQL password to match .env');
      console.error('      Run in pgAdmin or psql:');
      console.error("      ALTER USER postgres WITH PASSWORD 'postgres';");
      console.error('\n   Option 2: Update .env with your actual password');
      console.error('      Edit backend/.env and update DATABASE_URL');
      console.error('\n   Option 3: Skip migrations temporarily (for testing)');
      console.error('      Set SKIP_MIGRATIONS=true in .env');
      console.error('\n📄 See backend/DATABASE_SETUP.md for detailed instructions\n');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('🔌 Connection Refused');
      console.error('\nPostgreSQL server is not running or not accessible on port 5432.');
      console.error('Please ensure PostgreSQL is running and accessible.\n');
    } else {
      console.error('Error details:', err.message);
      if (err.code) {
        console.error('Error code:', err.code);
      }
    }

    process.exit(1);
  }
}

void startServer();
