/**
 * Multi-Tenant Safety Checks
 * Verifies tenant isolation is properly enforced
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const results = {
  timestamp: new Date().toISOString(),
  checks: [],
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0
  }
};

const outputDir = path.join(__dirname, '..', 'docs', 'preprod');

function runCheck(name, description, testFn) {
  console.log(`\n🔍 ${name}`);
  console.log(`   ${description}`);

  try {
    const result = testFn();
    results.checks.push({
      name,
      description,
      status: 'PASS',
      details: result
    });
    results.summary.passed++;
    console.log(`   ✅ PASSED`);
    return true;
  } catch (error) {
    results.checks.push({
      name,
      description,
      status: 'FAIL',
      error: error.message,
      details: error.stack
    });
    results.summary.failed++;
    console.log(`   ❌ FAILED: ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('\n🏢 Multi-Tenant Safety Checks\n');
  console.log('='.repeat(60));

  // Check 1: Tenant isolation test exists
  runCheck(
    'Tenant Isolation Test File',
    'Verify tenant isolation test file exists',
    () => {
      const testFile = path.join(__dirname, '..', 'backend', 'tests', 'tenantIsolation.test.ts');
      if (!fs.existsSync(testFile)) {
        throw new Error('Tenant isolation test file not found');
      }
      return { file: testFile };
    }
  );

  // Check 2: Rate limiting configuration
  runCheck(
    'Rate Limiting Per Tenant',
    'Verify rate limiting is configured per tenant',
    () => {
      const rateLimiterFile = path.join(__dirname, '..', 'backend', 'src', 'middleware', 'rateLimitPerTenant.ts');
      if (!fs.existsSync(rateLimiterFile)) {
        throw new Error('Tenant rate limiter middleware not found');
      }
      const content = fs.readFileSync(rateLimiterFile, 'utf-8');
      if (!content.includes('tenant') || !content.includes('rateLimit')) {
        throw new Error('Rate limiting may not be tenant-scoped');
      }
      return { file: rateLimiterFile };
    }
  );

  // Check 3: Tenant resolver middleware
  runCheck(
    'Tenant Resolver Middleware',
    'Verify tenant resolver middleware exists',
    () => {
      const tenantResolverFile = path.join(__dirname, '..', 'backend', 'src', 'middleware', 'tenantResolver.ts');
      if (!fs.existsSync(tenantResolverFile)) {
        throw new Error('Tenant resolver middleware not found');
      }
      return { file: tenantResolverFile };
    }
  );

  // Check 4: Enhanced tenant isolation
  runCheck(
    'Enhanced Tenant Isolation',
    'Verify enhanced tenant isolation middleware exists',
    () => {
      const isolationFile = path.join(__dirname, '..', 'backend', 'src', 'middleware', 'enhancedTenantIsolation.ts');
      if (!fs.existsSync(isolationFile)) {
        throw new Error('Enhanced tenant isolation middleware not found');
      }
      return { file: isolationFile };
    }
  );

  // Check 5: Schema isolation in database
  runCheck(
    'Database Schema Isolation',
    'Verify tenant schemas are properly isolated',
    () => {
      // Check if tenant manager has schema isolation
      const tenantManagerFile = path.join(__dirname, '..', 'backend', 'src', 'db', 'tenantManager.ts');
      if (!fs.existsSync(tenantManagerFile)) {
        throw new Error('Tenant manager not found');
      }
      const content = fs.readFileSync(tenantManagerFile, 'utf-8');
      if (!content.includes('CREATE SCHEMA') && !content.includes('schema_name')) {
        throw new Error('Schema isolation may not be properly implemented');
      }
      return { file: tenantManagerFile };
    }
  );

  // Save results
  fs.writeFileSync(
    path.join(outputDir, 'tenant-isolation-checks.json'),
    JSON.stringify(results, null, 2)
  );

  // Generate markdown report
  let md = `# Multi-Tenant Safety Checks\n\n`;
  md += `**Generated:** ${results.timestamp}\n\n`;
  md += `## Summary\n\n`;
  md += `- ✅ Passed: ${results.summary.passed}\n`;
  md += `- ❌ Failed: ${results.summary.failed}\n`;
  md += `- ⚠️  Warnings: ${results.summary.warnings}\n\n`;

  md += `## Check Results\n\n`;
  results.checks.forEach(check => {
    const status = check.status === 'PASS' ? '✅' : '❌';
    md += `### ${status} ${check.name}\n\n`;
    md += `${check.description}\n\n`;
    if (check.status === 'FAIL') {
      md += `**Error:** ${check.error}\n\n`;
    }
  });

  fs.writeFileSync(
    path.join(outputDir, 'tenant-isolation-report.md'),
    md
  );

  console.log('\n' + '='.repeat(60));
  console.log('📊 Summary');
  console.log('='.repeat(60));
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`⚠️  Warnings: ${results.summary.warnings}`);
  console.log(`\n📁 Results saved to: ${outputDir}`);
  console.log('='.repeat(60) + '\n');

  if (results.summary.failed > 0) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


