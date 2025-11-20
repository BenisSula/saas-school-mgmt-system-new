#!/usr/bin/env ts-node
/**
 * Index Usage Monitor
 * 
 * Monitors index usage statistics to verify indexes are being used
 * and identifies unused indexes that could be removed.
 * 
 * Usage:
 *   npm run monitor:indexes
 *   or
 *   ts-node src/scripts/monitorIndexUsage.ts
 */

import { getPool, closePool } from '../db/connection';

interface IndexStats {
  schemaname: string;
  tablename: string;
  indexname: string;
  idx_scan: number;
  idx_tup_read: number;
  idx_tup_fetch: number;
  index_size: string;
  table_size: string;
  index_usage_ratio: number;
}

async function getIndexStats(): Promise<IndexStats[]> {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      i.schemaname,
      i.relname AS tablename,
      i.indexrelname AS indexname,
      i.idx_scan,
      i.idx_tup_read,
      i.idx_tup_fetch,
      pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size,
      pg_size_pretty(pg_relation_size(i.relid)) AS table_size,
      CASE 
        WHEN pg_relation_size(i.relid) > 0 
        THEN ROUND((pg_relation_size(i.indexrelid)::numeric / pg_relation_size(i.relid)::numeric) * 100, 2)
        ELSE 0
      END AS index_usage_ratio
    FROM pg_stat_user_indexes i
    WHERE i.schemaname = 'shared'
    ORDER BY i.idx_scan DESC, i.relname, i.indexrelname
  `);

  return result.rows.map((row) => ({
    schemaname: row.schemaname,
    tablename: row.tablename,
    indexname: row.indexname,
    idx_scan: parseInt(row.idx_scan, 10),
    idx_tup_read: parseInt(row.idx_tup_read, 10),
    idx_tup_fetch: parseInt(row.idx_tup_fetch, 10),
    index_size: row.index_size,
    table_size: row.table_size,
    index_usage_ratio: parseFloat(row.index_usage_ratio)
  }));
}

async function getUnusedIndexes(): Promise<IndexStats[]> {
  const pool = getPool();
  
  const result = await pool.query(`
    SELECT 
      i.schemaname,
      i.relname AS tablename,
      i.indexrelname AS indexname,
      i.idx_scan,
      pg_size_pretty(pg_relation_size(i.indexrelid)) AS index_size
    FROM pg_stat_user_indexes i
    WHERE i.schemaname = 'shared'
      AND i.idx_scan = 0
      AND i.indexrelname NOT LIKE '%_pkey'
      AND i.indexrelname NOT LIKE '%_key'
    ORDER BY pg_relation_size(i.indexrelid) DESC
  `);

  return result.rows.map((row) => ({
    schemaname: row.schemaname,
    tablename: row.tablename,
    indexname: row.indexname,
    idx_scan: parseInt(row.idx_scan, 10),
    idx_tup_read: 0,
    idx_tup_fetch: 0,
    index_size: row.index_size,
    table_size: '',
    index_usage_ratio: 0
  }));
}

function formatTable(stats: IndexStats[]): void {
  if (stats.length === 0) {
    console.log('No indexes found.\n');
    return;
  }

  console.log('\n' + '='.repeat(120));
  console.log('INDEX USAGE STATISTICS');
  console.log('='.repeat(120));
  console.log(
    'Table'.padEnd(25) +
    'Index'.padEnd(40) +
    'Scans'.padStart(10) +
    'Tuples Read'.padStart(15) +
    'Size'.padStart(15) +
    'Ratio %'.padStart(10)
  );
  console.log('-'.repeat(120));

  for (const stat of stats) {
    const tableName = `${stat.schemaname}.${stat.tablename}`.padEnd(25);
    const indexName = stat.indexname.padEnd(40);
    const scans = stat.idx_scan.toString().padStart(10);
    const tuplesRead = stat.idx_tup_read.toString().padStart(15);
    const size = stat.index_size.padStart(15);
    const ratio = stat.index_usage_ratio.toFixed(2).padStart(10);

    console.log(`${tableName}${indexName}${scans}${tuplesRead}${size}${ratio}`);
  }

  console.log('='.repeat(120) + '\n');
}

async function main() {
  try {
    console.log('📊 Fetching index usage statistics...\n');

    const allStats = await getIndexStats();
    const unusedIndexes = await getUnusedIndexes();

    // Show all indexes sorted by usage
    console.log('📈 ALL INDEXES (sorted by scan count):');
    formatTable(allStats);

    // Show unused indexes
    if (unusedIndexes.length > 0) {
      console.log('⚠️  UNUSED INDEXES (consider removing if not needed):');
      formatTable(unusedIndexes);
      console.log(`Found ${unusedIndexes.length} unused index(es).\n`);
    } else {
      console.log('✅ No unused indexes found.\n');
    }

    // Summary
    const totalIndexes = allStats.length;
    const usedIndexes = allStats.filter((s) => s.idx_scan > 0).length;
    const totalScans = allStats.reduce((sum, s) => sum + s.idx_scan, 0);

    console.log('📊 SUMMARY:');
    console.log(`  Total indexes: ${totalIndexes}`);
    console.log(`  Used indexes: ${usedIndexes} (${((usedIndexes / totalIndexes) * 100).toFixed(1)}%)`);
    console.log(`  Unused indexes: ${unusedIndexes.length}`);
    console.log(`  Total index scans: ${totalScans.toLocaleString()}\n`);

  } catch (error) {
    console.error('❌ Error fetching index statistics:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}

export { getIndexStats, getUnusedIndexes };

