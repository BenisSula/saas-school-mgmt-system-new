# Migration Best Practices

**Understanding When Migrations Are Needed**

---

## 🔍 Current System

### How It Works Now

The current migration system:
- ✅ **Runs all migrations** in alphabetical order every time
- ✅ **Uses idempotent SQL** (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
- ❌ **Does NOT track** which migrations have already run
- ⚠️ **Re-executes all migrations** on every run

### What This Means

**Good News:**
- Migrations are **safe to run multiple times** (idempotent)
- Won't break if you run `npm run migrate` multiple times
- Uses defensive SQL (`IF NOT EXISTS`, `DROP TRIGGER IF EXISTS`, etc.)

**Limitations:**
- Runs **all 32 migrations** every time (inefficient)
- Takes longer than necessary
- No way to skip already-applied migrations

---

## 📋 When Do You Need to Run Migrations?

### ✅ **You MUST Run Migrations When:**

1. **New Database Setup**
   - Fresh database installation
   - New development environment
   - New staging/production database

2. **After Pulling Code Changes**
   - New migration files added to the codebase
   - Team member added a new migration
   - You pulled latest code with new migrations

3. **After Deployment**
   - Deploying new code with migrations
   - Updating production database schema

4. **Database Reset**
   - After dropping/recreating database
   - After restoring from backup

### ❌ **You DON'T Need to Run Migrations When:**

1. **Regular Application Restarts**
   - Restarting the server (`npm run dev`)
   - Deploying code without schema changes
   - No new migration files added

2. **Code-Only Changes**
   - Bug fixes in application code
   - Frontend changes
   - Configuration changes (no DB schema changes)

3. **After Already Running Migrations**
   - If you just ran migrations successfully
   - No new migration files since last run

---

## 🚀 Recommended: Add Migration Tracking

### Current System (No Tracking)

```typescript
// Current: Runs ALL migrations every time
for (const file of files) {
  await pool.query(sql); // Runs even if already applied
}
```

**Issues:**
- Slow (runs all 32 migrations every time)
- Unnecessary database operations
- No way to know which migrations have run

### Better System (With Tracking)

**Option 1: Add Migration Tracking Table**

```sql
-- Create migration tracking table
CREATE TABLE IF NOT EXISTS shared.schema_migrations (
  id SERIAL PRIMARY KEY,
  migration_file TEXT NOT NULL UNIQUE,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_file 
  ON shared.schema_migrations(migration_file);
```

**Option 2: Use Migration Tool**

Consider using a migration tool like:
- **node-pg-migrate** - Tracks migrations automatically
- **knex.js migrations** - Built-in tracking
- **TypeORM migrations** - Automatic tracking

---

## 💡 Best Practices

### 1. **Check Before Running**

```bash
# Check if new migrations exist
ls -la backend/src/db/migrations/ | tail -5

# Check database schema
npx ts-node src/scripts/checkMigrationStatus.ts
```

### 2. **Run Only When Needed**

```bash
# Only run if:
# - New migration files exist
# - Database is fresh/new
# - Schema changes are needed
npm run migrate
```

### 3. **Track Migrations (Recommended)**

Implement migration tracking to:
- Skip already-applied migrations
- Faster execution
- Better visibility into what's been applied

### 4. **In Production**

- ✅ Run migrations as part of deployment process
- ✅ Run migrations before starting application
- ✅ Use migration tracking to avoid re-running
- ✅ Test migrations in staging first

---

## 🔧 Quick Fix: Add Migration Tracking

Here's a simple way to add tracking:

```typescript
// Enhanced runMigrations with tracking
export async function runMigrations(pool: Pool): Promise<void> {
  // Create tracking table if it doesn't exist
  await pool.query(`
    CREATE TABLE IF NOT EXISTS shared.schema_migrations (
      migration_file TEXT PRIMARY KEY,
      executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.resolve(__dirname, 'migrations');
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    // Check if already executed
    const result = await pool.query(
      'SELECT 1 FROM shared.schema_migrations WHERE migration_file = $1',
      [file]
    );

    if (result.rows.length > 0) {
      console.log(`⏭️  Skipping ${file} (already executed)`);
      continue;
    }

    // Run migration
    const sql = await fs.readFile(path.join(migrationsDir, file), 'utf-8');
    await pool.query(sql);

    // Record execution
    await pool.query(
      'INSERT INTO shared.schema_migrations (migration_file) VALUES ($1)',
      [file]
    );

    console.log(`✅ Migration ${file} completed`);
  }
}
```

---

## 📊 Current vs. Recommended

| Aspect | Current System | Recommended System |
|--------|---------------|-------------------|
| **Tracking** | ❌ None | ✅ Migration table |
| **Speed** | ⚠️ Slow (runs all) | ✅ Fast (skips applied) |
| **Safety** | ✅ Idempotent | ✅ Idempotent + tracked |
| **Visibility** | ❌ No history | ✅ Full history |
| **Rollback** | ❌ Not supported | ✅ Can be added |

---

## 🎯 Summary

### Current Answer: **No, you don't always need to migrate**

**Run migrations when:**
- ✅ Setting up new database
- ✅ New migration files added
- ✅ Schema changes needed

**Don't run migrations when:**
- ❌ Just restarting the app
- ❌ No new migration files
- ❌ Code-only changes

### Recommendation

**Add migration tracking** to:
- Speed up migrations (skip already-applied)
- Better visibility
- Production-ready approach

---

**Current system is safe but inefficient. Adding tracking would improve performance significantly.**

