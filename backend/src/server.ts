import app from './app';
import { getPool } from './db/connection';
import { runMigrations } from './db/runMigrations';
import { seedDemoTenant } from './seed/demoTenant';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

async function startServer(): Promise<void> {
  const pool = getPool();

  try {
    await runMigrations(pool);

    const shouldSeedDemo =
      process.env.AUTO_SEED_DEMO === 'true' ||
      (process.env.AUTO_SEED_DEMO === undefined &&
        process.env.NODE_ENV !== 'production' &&
        process.env.NODE_ENV !== 'test');

    if (shouldSeedDemo) {
      await seedDemoTenant(pool);
    }

    await pool.query('SELECT 1');
    app.listen(PORT, () => {
      console.log(`Backend server listening on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server due to DB connection error', error);
    process.exit(1);
  }
}

void startServer();
