# Migration Tracking Implementation Guide

**How to Enable Migration Tracking**

---

## 🎯 Why Add Tracking?

### Current System
- Runs **all 32 migrations** every time
- Takes ~5-10 seconds even if nothing changed
- No visibility into what's been applied

### With Tracking
- Runs **only new migrations**
- Takes <1 second if nothing new
- Full history of applied migrations
- Better for production

---

## 🚀 Quick Implementation

### Step 1: Use Enhanced Migration Runner

Replace `runMigrations` with `runMigrationsWithTracking`:

```typescript
// backend/src/db/migrate.ts
import { runMigrationsWithTracking } from './runMigrationsWithTracking';

async function executeMigrations(): Promise<void> {
  const pool = getPool();
  try {
    await runMigrationsWithTracking(pool); // Use tracking version
    console.log('Migrations completed successfully.');
  } finally {
    await closePool();
  }
}
```

### Step 2: Run Migrations

```bash
npm run migrate
```

**First Run:**
- Creates `shared.schema_migrations` table
- Executes all migrations
- Records each execution

**Subsequent Runs:**
- Checks tracking table
- Skips already-executed migrations
- Only runs new ones

---

## 📊 Migration Tracking Table

The system creates this table automatically:

```sql
CREATE TABLE shared.schema_migrations (
  migration_file TEXT PRIMARY KEY,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  execution_time_ms INTEGER,
  error_message TEXT
);
```

### Query Migration History

```sql
-- See all executed migrations
SELECT * FROM shared.schema_migrations 
ORDER BY executed_at DESC;

-- Check if specific migration ran
SELECT * FROM shared.schema_migrations 
WHERE migration_file = '029_stripe_integration_fields.sql';

-- See execution times
SELECT migration_file, execution_time_ms 
FROM shared.schema_migrations 
ORDER BY execution_time_ms DESC;
```

---

## 🔍 Migration Status Script

Check which migrations have been executed:

```typescript
// backend/src/scripts/checkMigrationStatus.ts (enhanced)
import { getExecutedMigrations } from '../db/runMigrationsWithTracking';
import { getPool, closePool } from '../db/connection';

async function checkStatus() {
  const pool = getPool();
  try {
    const executed = await getExecutedMigrations(pool);
    console.log(`Executed migrations: ${executed.length}`);
    executed.forEach(m => console.log(`  ✅ ${m}`));
  } finally {
    await closePool();
  }
}
```

---

## ⚠️ Important Notes

### Backward Compatibility

- ✅ **Safe to switch** - Existing migrations still work
- ✅ **Idempotent** - Can run multiple times safely
- ✅ **No breaking changes** - Works with current system

### First Run After Enabling

When you first enable tracking:
- All existing migrations will be marked as "not executed"
- They'll all run once (because tracking table is empty)
- After that, only new migrations run

### Manual Migration Marking

If you need to mark a migration as executed without running it:

```sql
INSERT INTO shared.schema_migrations (migration_file)
VALUES ('029_stripe_integration_fields.sql')
ON CONFLICT DO NOTHING;
```

---

## 🎯 When to Use Each System

### Use Tracking (Recommended)
- ✅ Production environments
- ✅ Staging environments
- ✅ When you have many migrations
- ✅ When migrations take time

### Use Non-Tracking (Current)
- ✅ Fresh database setup
- ✅ Testing environments
- ✅ When you want to ensure all migrations run
- ✅ When migrations are very fast

---

## 📝 Migration Best Practices

1. **Always use `IF NOT EXISTS`** in migrations
2. **Test migrations** before deploying
3. **Run migrations** as part of deployment
4. **Track migrations** in production
5. **Never modify** executed migrations
6. **Create new migrations** for schema changes

---

**Recommendation: Enable tracking for better performance and visibility.**

