# Migration FAQ

**Common Questions About Database Migrations**

---

## ❓ Do I Always Have to Run Migrations?

### Short Answer: **No**

You only need to run migrations when:
- ✅ Setting up a new database
- ✅ New migration files have been added
- ✅ Database schema needs to be updated

You **don't** need to run migrations for:
- ❌ Regular application restarts
- ❌ Code-only changes (no DB changes)
- ❌ Frontend updates
- ❌ Configuration changes (no schema changes)

---

## 🔄 How Often Should I Run Migrations?

### Development
- **When:** After pulling code with new migrations
- **Frequency:** As needed (when new migrations exist)
- **Command:** `npm run migrate`

### Staging/Production
- **When:** As part of deployment process
- **Frequency:** Every deployment (if migrations exist)
- **Best Practice:** Run migrations **before** starting the app

---

## ⚡ Is It Safe to Run Migrations Multiple Times?

### Yes! ✅

The current system uses **idempotent SQL**:
- `CREATE TABLE IF NOT EXISTS` - Won't error if table exists
- `CREATE INDEX IF NOT EXISTS` - Won't error if index exists
- `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` - Won't error if column exists
- `ON CONFLICT DO NOTHING` - Won't error on duplicates

**Result:** Safe to run `npm run migrate` multiple times.

---

## 🐌 Why Are Migrations Slow?

### Current System
- Runs **all 32 migrations** every time
- Even if they've already been applied
- Takes ~5-10 seconds

### Solution
- Enable **migration tracking** (see `MIGRATION_TRACKING_GUIDE.md`)
- Only runs new migrations
- Much faster (<1 second if nothing new)

---

## 🔍 How Do I Know If I Need to Run Migrations?

### Check for New Migration Files

```bash
# See latest migration files
ls -lt backend/src/db/migrations/ | head -5

# Check if migration 029 exists (Phase 8.1)
ls backend/src/db/migrations/029_stripe_integration_fields.sql
```

### Check Database Schema

```bash
# Check if tables exist
npx ts-node src/scripts/checkMigrationStatus.ts

# Check if specific table exists
psql $DATABASE_URL -c "\d shared.external_events"
```

### Check Migration Tracking (if enabled)

```sql
SELECT * FROM shared.schema_migrations 
ORDER BY executed_at DESC 
LIMIT 5;
```

---

## 🚨 What If a Migration Fails?

### Current Behavior
- Migration runner **stops** on first error
- Shows which migration failed
- Error message with PostgreSQL error code

### Recovery Steps

1. **Fix the migration file** (if it's wrong)
2. **Fix the database** (if schema is inconsistent)
3. **Re-run migrations** - `npm run migrate`

### Common Issues

- **Index already exists** → Fixed with `IF NOT EXISTS`
- **Column doesn't exist** → Fixed with defensive checks
- **Trigger already exists** → Fixed with `DROP TRIGGER IF EXISTS`
- **Duplicate key** → Fixed with `ON CONFLICT DO NOTHING`

---

## 📋 Migration Checklist

Before running migrations:

- [ ] Check if new migration files exist
- [ ] Review migration files for changes
- [ ] Backup database (production)
- [ ] Test in development first
- [ ] Ensure database connection works
- [ ] Check disk space
- [ ] Verify permissions

After running migrations:

- [ ] Verify migrations completed successfully
- [ ] Check for errors in logs
- [ ] Verify schema changes applied
- [ ] Test application functionality
- [ ] Check migration tracking (if enabled)

---

## 🎯 Best Practices Summary

1. **Run migrations only when needed** (new files exist)
2. **Use migration tracking** for better performance
3. **Test migrations** in development first
4. **Backup database** before production migrations
5. **Run migrations as part of deployment**
6. **Never modify** executed migrations
7. **Create new migrations** for schema changes

---

## 💡 Quick Reference

```bash
# Run all migrations
npm run migrate

# Check migration status
npx ts-node src/scripts/checkMigrationStatus.ts

# Verify Stripe tables (Phase 8.1)
npx ts-node src/scripts/checkMigrationStatus.ts | grep -i "external_events\|stripe"

# Check executed migrations (if tracking enabled)
psql $DATABASE_URL -c "SELECT * FROM shared.schema_migrations ORDER BY executed_at DESC LIMIT 10;"
```

---

**TL;DR: Run migrations when new migration files exist, not on every app restart.**

