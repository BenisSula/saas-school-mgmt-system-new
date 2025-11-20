# Phase 7 - Migration & Monitoring Complete

**Date:** 2025-01-XX  
**Status:** ✅ **MIGRATION COMPLETE & MONITORING ACTIVE**

---

## ✅ Migration Status

**Migration Executed:** `013_performance_indexes.sql`

**Result:** ✅ **SUCCESS**

```
Migrations completed successfully.
```

---

## 📊 Index Usage Summary

**Total Indexes:** 45  
**Used Indexes:** 17 (37.8%)  
**Unused Indexes:** 17  
**Total Index Scans:** 15,188

### Most Used Indexes

1. `users_pkey` - 5,569 scans (Primary key lookups)
2. `roles_pkey` - 2,532 scans
3. `shared_users_status_idx` - 1,826 scans (Status filtering)
4. `tenants_pkey` - 1,412 scans
5. `users_email_key` - 1,320 scans (Email lookups)

### New Indexes Created (Not Yet Used)

The following indexes were just created and haven't been used yet (expected):

- `shared_users_email_idx` - Will be used for email lookups
- `shared_users_tenant_role_idx` - Will be used for tenant+role queries
- `shared_users_pending_profile_tenant_role_idx` - Will be used for pending user queries
- `shared_users_pending_profile_data_gin_idx` - Will be used for JSONB queries
- `shared_users_tenant_status_role_idx` - Will be used for multi-filter queries
- `shared_tenants_schema_name_idx` - Will be used for tenant resolution
- `shared_tenants_domain_idx` - Will be used for domain lookups
- Token table indexes - Will be used for token verification

**Note:** These indexes will start being used as the application processes queries. The fact that they show 0 scans is normal immediately after creation.

---

## 🔍 Monitoring Commands

### Check Index Usage

```bash
npm run monitor:indexes --prefix backend
```

**Output includes:**
- All indexes sorted by usage
- Unused indexes list
- Summary statistics

### Analyze Query Performance

```bash
npm run analyze:queries --prefix backend
```

**Analyzes:**
- User by email queries
- Tenant+role queries
- Pending user queries
- Token verification queries

---

## 📈 Expected Performance Improvements

Once indexes start being used:

| Query Type | Before | After | Improvement |
|------------|--------|-------|-------------|
| User by email | Sequential scan | Index scan | 10-100x faster |
| Users by tenant+role | Sequential scan | Composite index | 5-50x faster |
| Pending users | Sequential scan | Partial index | 10-100x faster |
| Token verification | Sequential scan | Composite index | 5-20x faster |

---

## 🎯 Next Steps

### Immediate
- ✅ Migration completed
- ✅ Monitoring tools created
- ✅ Index usage baseline established

### Short Term (Next Week)
1. **Monitor index usage** - Run `npm run monitor:indexes` daily
2. **Verify index usage** - Check that new indexes are being used
3. **Analyze slow queries** - Run `npm run analyze:queries` weekly

### Long Term (Monthly)
1. **Review unused indexes** - Consider removing if truly unused
2. **Update statistics** - Run `ANALYZE` on key tables
3. **Rebuild indexes** - If performance degrades

---

## 📋 Monitoring Checklist

### Daily
- [ ] Check application logs for slow queries
- [ ] Monitor database connection pool

### Weekly
- [ ] Run `npm run monitor:indexes`
- [ ] Run `npm run analyze:queries`
- [ ] Update statistics: `ANALYZE shared.users; ANALYZE shared.tenants;`

### Monthly
- [ ] Review unused indexes
- [ ] Check index bloat
- [ ] Rebuild indexes if needed

---

## 🔧 Maintenance Commands

### Update Statistics

```sql
ANALYZE shared.users;
ANALYZE shared.tenants;
ANALYZE shared.refresh_tokens;
ANALYZE shared.email_verification_tokens;
ANALYZE shared.password_reset_tokens;
```

### Rebuild Index (if needed)

```sql
REINDEX INDEX CONCURRENTLY shared_users_tenant_role_idx;
```

### Check Index Sizes

```sql
SELECT 
  indexrelname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS size
FROM pg_stat_user_indexes
WHERE schemaname = 'shared'
ORDER BY pg_relation_size(indexrelid) DESC;
```

---

## ✅ Verification

**Migration:** ✅ Complete  
**Indexes Created:** ✅ 10 new indexes  
**Monitoring Tools:** ✅ Working  
**Baseline Established:** ✅ Yes

---

**Status:** ✅ **PHASE 7 MONITORING ACTIVE**  
**Ready for:** Ongoing performance monitoring

