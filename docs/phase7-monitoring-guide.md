# Phase 7 - Database Performance Monitoring Guide

**Date:** 2025-01-XX  
**Purpose:** Guide for monitoring database indexes and query performance

---

## Overview

This guide provides tools and procedures for monitoring database performance after Phase 7 index optimization.

---

## 🚀 Quick Start

### 1. Run Migration

```bash
npm run migrate --prefix backend
```

### 2. Monitor Index Usage

```bash
npm run monitor:indexes --prefix backend
```

### 3. Analyze Query Performance

```bash
npm run analyze:queries --prefix backend
```

---

## 📊 Monitoring Tools

### Index Usage Monitor

**Command:** `npm run monitor:indexes`

**What it does:**
- Shows all indexes in the `shared` schema
- Displays scan counts, tuple reads, and index sizes
- Identifies unused indexes
- Provides summary statistics

**Output includes:**
- Index name and table
- Number of scans (how often index is used)
- Tuples read/fetched
- Index size vs table size ratio
- List of unused indexes

**Example Output:**
```
📊 INDEX USAGE STATISTICS
================================================================================
Table                    Index                                  Scans    Tuples Read         Size    Ratio %
--------------------------------------------------------------------------------
shared.users             shared_users_email_idx                   150          150        128 kB    0.05
shared.users             shared_users_tenant_role_idx              45           90        256 kB    0.10
...
```

### Query Performance Analyzer

**Command:** `npm run analyze:queries`

**What it does:**
- Analyzes common queries using `EXPLAIN ANALYZE`
- Verifies indexes are being used
- Identifies slow queries (>100ms)
- Shows execution plans

**Queries Analyzed:**
1. User by Email
2. Users by Tenant and Role
3. Pending Users with Profile Data
4. Tenant by Schema Name
5. Refresh Token Verification
6. Users by Tenant, Status, and Role

**Example Output:**
```
Query: User by Email
================================================================================
Execution Time: 0.25 ms
Uses Index: ✅ YES
Index Used: shared_users_email_idx
Rows Examined: 1
Rows Returned: 1
```

---

## 🔍 Manual Monitoring

### Check Index Usage (PostgreSQL)

```sql
-- View all index statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'shared'
ORDER BY idx_scan DESC;
```

### Find Unused Indexes

```sql
-- Indexes that have never been scanned
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'shared'
  AND idx_scan = 0
  AND indexname NOT LIKE '%_pkey'
  AND indexname NOT LIKE '%_key'
ORDER BY pg_relation_size(indexrelid) DESC;
```

### Analyze Specific Query

```sql
-- Analyze a query to see if it uses indexes
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM shared.users 
WHERE tenant_id = '...' AND role = 'admin';
```

**Key things to look for:**
- `Index Scan` or `Index Only Scan` - ✅ Good (using index)
- `Seq Scan` - ❌ Bad (full table scan, not using index)
- `Execution Time` - Should be < 10ms for indexed queries

### Check Index Sizes

```sql
-- Index sizes and usage
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  pg_size_pretty(pg_relation_size(indrelid)) AS table_size,
  idx_scan,
  CASE 
    WHEN pg_relation_size(indrelid) > 0 
    THEN ROUND((pg_relation_size(indexrelid)::numeric / pg_relation_size(indrelid)::numeric) * 100, 2)
    ELSE 0
  END AS index_to_table_ratio
FROM pg_stat_user_indexes
WHERE schemaname = 'shared'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 📈 Performance Benchmarks

### Expected Performance

| Query Type | Expected Time | Index Used |
|------------|---------------|------------|
| User by email | < 1ms | `shared_users_email_idx` |
| Users by tenant+role | < 5ms | `shared_users_tenant_role_idx` |
| Pending users | < 5ms | `shared_users_pending_profile_tenant_role_idx` |
| Tenant resolution | < 1ms | `shared_tenants_schema_name_idx` |
| Token verification | < 2ms | `shared_refresh_tokens_user_id_expires_idx` |

### Warning Signs

**⚠️ Slow Queries:**
- Execution time > 100ms
- Sequential scan instead of index scan
- High number of rows examined vs returned

**⚠️ Unused Indexes:**
- Indexes with `idx_scan = 0` after significant usage
- Large indexes that are never used
- Consider removing if not needed (saves space and write performance)

---

## 🔧 Maintenance Tasks

### Update Statistics

PostgreSQL uses statistics to plan queries. Update them regularly:

```sql
ANALYZE shared.users;
ANALYZE shared.tenants;
ANALYZE shared.refresh_tokens;
```

**When to run:**
- After bulk data changes
- Weekly in production
- After migrations

### Rebuild Indexes

If indexes become bloated or fragmented:

```sql
-- Rebuild index concurrently (non-blocking)
REINDEX INDEX CONCURRENTLY shared_users_tenant_role_idx;
```

**When to rebuild:**
- After heavy write operations
- If query performance degrades
- Monthly maintenance window

### Monitor Index Bloat

```sql
-- Check for index bloat
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'shared'
  AND pg_relation_size(indexrelid) > 1048576  -- > 1MB
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## 📋 Monitoring Checklist

### Daily
- [ ] Check for slow queries in application logs
- [ ] Monitor database connection pool usage

### Weekly
- [ ] Run `npm run monitor:indexes` to check index usage
- [ ] Run `npm run analyze:queries` to verify performance
- [ ] Update statistics: `ANALYZE` on key tables

### Monthly
- [ ] Review unused indexes
- [ ] Check index sizes and bloat
- [ ] Rebuild indexes if needed
- [ ] Review query performance trends

---

## 🐛 Troubleshooting

### Index Not Being Used

**Possible causes:**
1. Statistics are outdated - Run `ANALYZE`
2. Query doesn't match index columns - Check query filters
3. Index is less efficient than sequential scan - Check table size
4. Query uses functions on indexed columns - Avoid `LOWER()`, `UPPER()`, etc.

**Solution:**
```sql
-- Force index usage (for testing)
SET enable_seqscan = OFF;
EXPLAIN ANALYZE SELECT ...;
SET enable_seqscan = ON;
```

### Slow Query Performance

**Check:**
1. Is index being used? (`EXPLAIN ANALYZE`)
2. Are statistics up to date? (`ANALYZE`)
3. Is index fragmented? (`REINDEX`)
4. Are there too many indexes? (slows writes)

### High Index Size

**Consider:**
- Partial indexes for filtered queries
- GIN indexes for JSONB (smaller than B-tree for large JSON)
- Remove unused indexes

---

## 📚 Additional Resources

### PostgreSQL Documentation
- [Index Types](https://www.postgresql.org/docs/current/indexes-types.html)
- [Index Maintenance](https://www.postgresql.org/docs/current/maintenance.html)
- [EXPLAIN](https://www.postgresql.org/docs/current/sql-explain.html)

### Tools
- `pg_stat_statements` - Track query performance
- `pgAdmin` - Visual query planner
- `pgBadger` - Log analysis

---

## ✅ Verification Steps

After running migration:

1. **Verify indexes exist:**
   ```sql
   SELECT indexname FROM pg_indexes WHERE schemaname = 'shared' ORDER BY indexname;
   ```

2. **Check index usage:**
   ```bash
   npm run monitor:indexes --prefix backend
   ```

3. **Analyze query performance:**
   ```bash
   npm run analyze:queries --prefix backend
   ```

4. **Verify no unused indexes:**
   - Review output from `monitor:indexes`
   - Remove any truly unused indexes

---

**Status:** ✅ **Monitoring Tools Ready**  
**Next:** Run monitoring commands regularly to track performance

