#!/usr/bin/env ts-node
/**
 * Query Performance Analyzer
 * 
 * Analyzes common queries using EXPLAIN ANALYZE to verify indexes are being used
 * and identifies slow queries that need optimization.
 * 
 * Usage:
 *   npm run analyze:queries
 *   or
 *   ts-node src/scripts/analyzeQueryPerformance.ts
 */

import { getPool, closePool } from '../db/connection';

interface QueryAnalysis {
  query: string;
  plan: string;
  executionTime: number;
  usesIndex: boolean;
  indexName?: string;
  rowsExamined: number;
  rowsReturned: number;
}

async function analyzeQuery(query: string, params: unknown[] = []): Promise<QueryAnalysis> {
  const pool = getPool();
  
  // Get execution plan
  const explainResult = await pool.query(`EXPLAIN (ANALYZE, BUFFERS, VERBOSE) ${query}`, params);
  const plan = explainResult.rows.map((r) => r['QUERY PLAN']).join('\n');
  
  // Extract execution time
  const executionTimeMatch = plan.match(/Execution Time: ([\d.]+) ms/);
  const executionTime = executionTimeMatch ? parseFloat(executionTimeMatch[1]) : 0;
  
  // Check if index is used
  const usesIndex = /Index (Scan|Only)/i.test(plan);
  const indexMatch = plan.match(/Index (?:Scan|Only) using (\w+)/i);
  const indexName = indexMatch ? indexMatch[1] : undefined;
  
  // Extract rows examined and returned
  const rowsExaminedMatch = plan.match(/rows=(\d+)/);
  const rowsExamined = rowsExaminedMatch ? parseInt(rowsExaminedMatch[1], 10) : 0;
  
  const rowsReturnedMatch = plan.match(/\(actual rows=(\d+)\)/);
  const rowsReturned = rowsReturnedMatch ? parseInt(rowsReturnedMatch[1], 10) : 0;
  
  return {
    query,
    plan,
    executionTime,
    usesIndex,
    indexName,
    rowsExamined,
    rowsReturned
  };
}

const COMMON_QUERIES = [
  {
    name: 'User by Email',
    query: 'SELECT * FROM shared.users WHERE email = $1',
    params: ['test@example.com'],
    expectedIndex: 'shared_users_email_idx'
  },
  {
    name: 'Users by Tenant and Role',
    query: 'SELECT * FROM shared.users WHERE tenant_id = $1 AND role = $2',
    params: ['00000000-0000-0000-0000-000000000000', 'admin'],
    expectedIndex: 'shared_users_tenant_role_idx'
  },
  {
    name: 'Pending Users with Profile Data',
    query: `SELECT * FROM shared.users 
            WHERE tenant_id = $1 
              AND status = $2 
              AND pending_profile_data IS NOT NULL`,
    params: ['00000000-0000-0000-0000-000000000000', 'pending'],
    expectedIndex: 'shared_users_pending_profile_tenant_role_idx'
  },
  {
    name: 'Tenant by Schema Name',
    query: 'SELECT * FROM shared.tenants WHERE schema_name = $1',
    params: ['tenant_test'],
    expectedIndex: 'shared_tenants_schema_name_idx'
  },
  {
    name: 'Refresh Token Verification',
    query: `SELECT rt.user_id, u.tenant_id, u.email, u.role
            FROM shared.refresh_tokens rt
            JOIN shared.users u ON u.id = rt.user_id
            WHERE rt.token_hash = $1 AND rt.expires_at > NOW()`,
    params: ['test_hash'],
    expectedIndex: 'shared_refresh_tokens_user_id_expires_idx'
  },
  {
    name: 'Users by Tenant, Status, and Role',
    query: 'SELECT * FROM shared.users WHERE tenant_id = $1 AND status = $2 AND role = $3',
    params: ['00000000-0000-0000-0000-000000000000', 'active', 'teacher'],
    expectedIndex: 'shared_users_tenant_status_role_idx'
  }
];

function formatAnalysis(analysis: QueryAnalysis, queryName: string, expectedIndex?: string): void {
  console.log('\n' + '='.repeat(100));
  console.log(`Query: ${queryName}`);
  console.log('='.repeat(100));
  console.log(`Query: ${analysis.query.substring(0, 80)}${analysis.query.length > 80 ? '...' : ''}`);
  console.log(`Execution Time: ${analysis.executionTime.toFixed(2)} ms`);
  console.log(`Uses Index: ${analysis.usesIndex ? '✅ YES' : '❌ NO'}`);
  if (analysis.indexName) {
    console.log(`Index Used: ${analysis.indexName}`);
    if (expectedIndex && analysis.indexName !== expectedIndex) {
      console.log(`⚠️  Expected: ${expectedIndex}`);
    }
  }
  console.log(`Rows Examined: ${analysis.rowsExamined.toLocaleString()}`);
  console.log(`Rows Returned: ${analysis.rowsReturned.toLocaleString()}`);
  
  if (analysis.executionTime > 100) {
    console.log('⚠️  SLOW QUERY: Execution time exceeds 100ms');
  }
  
  if (!analysis.usesIndex && analysis.rowsExamined > 100) {
    console.log('⚠️  WARNING: Query not using index and examining many rows');
  }
  
  console.log('\nExecution Plan:');
  console.log(analysis.plan);
}

async function main() {
  try {
    console.log('🔍 Analyzing query performance...\n');
    console.log('This will analyze common queries to verify indexes are being used.\n');

    const results: Array<{ name: string; analysis: QueryAnalysis; expectedIndex?: string }> = [];

    for (const testQuery of COMMON_QUERIES) {
      try {
        const analysis = await analyzeQuery(testQuery.query, testQuery.params);
        results.push({
          name: testQuery.name,
          analysis,
          expectedIndex: testQuery.expectedIndex
        });
      } catch (error) {
        console.error(`❌ Error analyzing "${testQuery.name}":`, error);
      }
    }

    // Display results
    for (const result of results) {
      formatAnalysis(result.analysis, result.name, result.expectedIndex);
    }

    // Summary
    console.log('\n' + '='.repeat(100));
    console.log('SUMMARY');
    console.log('='.repeat(100));
    
    const usingIndexes = results.filter((r) => r.analysis.usesIndex).length;
    const slowQueries = results.filter((r) => r.analysis.executionTime > 100).length;
    const avgExecutionTime = results.reduce((sum, r) => sum + r.analysis.executionTime, 0) / results.length;

    console.log(`Total Queries Analyzed: ${results.length}`);
    console.log(`Queries Using Indexes: ${usingIndexes} (${((usingIndexes / results.length) * 100).toFixed(1)}%)`);
    console.log(`Slow Queries (>100ms): ${slowQueries}`);
    console.log(`Average Execution Time: ${avgExecutionTime.toFixed(2)} ms`);

    if (usingIndexes === results.length) {
      console.log('\n✅ All queries are using indexes!');
    } else {
      console.log(`\n⚠️  ${results.length - usingIndexes} query(ies) not using indexes. Review execution plans above.`);
    }

    console.log('='.repeat(100) + '\n');

  } catch (error) {
    console.error('❌ Error analyzing queries:', error);
    process.exit(1);
  } finally {
    await closePool();
  }
}

if (require.main === module) {
  main();
}

export { analyzeQuery, COMMON_QUERIES };

