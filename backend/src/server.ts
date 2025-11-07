import app from './app';
import { getPool } from './db/connection';

const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

async function startServer(): Promise<void> {
  const pool = getPool();

  try {
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

