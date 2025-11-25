/**
 * Comprehensive Test Runner
 * Runs all test suites and generates a comprehensive report
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const results = {
  timestamp: new Date().toISOString(),
  tests: {},
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    warnings: 0
  }
};

const outputDir = path.join(__dirname, '..', 'docs', 'preprod', 'test-results');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function runTestSuite(name, command, options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log(`Command: ${command}`);
  console.log('='.repeat(60));

  const startTime = Date.now();
  
  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout || 300000,
      env: { ...process.env, CI: 'true' }
    });

    const duration = Date.now() - startTime;
    
    // Try to parse test results from output
    const passedMatch = output.match(/(\d+)\s+passed/i);
    const failedMatch = output.match(/(\d+)\s+failed/i);
    const skippedMatch = output.match(/(\d+)\s+skipped/i);
    
    const passed = passedMatch ? parseInt(passedMatch[1], 10) : 0;
    const failed = failedMatch ? parseInt(failedMatch[1], 10) : 0;
    const skipped = skippedMatch ? parseInt(skippedMatch[1], 10) : 0;

    results.tests[name] = {
      status: failed === 0 ? 'PASS' : 'FAIL',
      passed,
      failed,
      skipped,
      duration: `${(duration / 1000).toFixed(2)}s`,
      output: options.silent ? output : 'See console',
      timestamp: new Date().toISOString()
    };

    results.summary.total += (passed + failed + skipped);
    results.summary.passed += passed;
    results.summary.failed += failed;
    results.summary.skipped += skipped;

    if (options.silent && output) {
      fs.writeFileSync(
        path.join(outputDir, `${name.replace(/\s+/g, '-').toLowerCase()}.log`),
        output
      );
    }

    return { success: failed === 0, passed, failed, skipped, output };
  } catch (error) {
    const duration = Date.now() - startTime;
    
    results.tests[name] = {
      status: 'FAIL',
      error: error.message,
      output: error.stdout || error.stderr || 'No output',
      duration: `${(duration / 1000).toFixed(2)}s`,
      timestamp: new Date().toISOString()
    };

    results.summary.failed++;
    
    if (error.stdout || error.stderr) {
      fs.writeFileSync(
        path.join(outputDir, `${name.replace(/\s+/g, '-').toLowerCase()}-error.log`),
        error.stdout || error.stderr
      );
    }

    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('\n🧪 Starting Comprehensive Application Testing...\n');
  console.log(`Output directory: ${outputDir}\n`);

  const rootDir = path.join(__dirname, '..');

  // 1. Backend Tests
  console.log('\n📦 Step 1: Backend Unit Tests');
  runTestSuite(
    'Backend Jest Tests',
    'npm test',
    {
      cwd: path.join(rootDir, 'backend'),
      timeout: 600000
    }
  );

  // 2. Frontend Tests
  console.log('\n📦 Step 2: Frontend Unit Tests');
  runTestSuite(
    'Frontend Vitest Tests',
    'npm test',
    {
      cwd: path.join(rootDir, 'frontend'),
      timeout: 600000
    }
  );

  // 3. Type Checking
  console.log('\n📦 Step 3: Type Checking');
  runTestSuite(
    'Backend Type Check',
    'npx tsc --noEmit',
    {
      cwd: path.join(rootDir, 'backend'),
      timeout: 180000,
      silent: true
    }
  );

  runTestSuite(
    'Frontend Type Check',
    'npx tsc --noEmit',
    {
      cwd: path.join(rootDir, 'frontend'),
      timeout: 180000,
      silent: true
    }
  );

  // 4. Linting
  console.log('\n📦 Step 4: Code Quality (Linting)');
  runTestSuite(
    'Backend Lint',
    'npm run lint',
    {
      cwd: path.join(rootDir, 'backend'),
      timeout: 120000,
      silent: true
    }
  );

  runTestSuite(
    'Frontend Lint',
    'npm run lint',
    {
      cwd: path.join(rootDir, 'frontend'),
      timeout: 120000,
      silent: true
    }
  );

  // 5. Build Verification
  console.log('\n📦 Step 5: Production Build Verification');
  runTestSuite(
    'Backend Build',
    'npm run build',
    {
      cwd: path.join(rootDir, 'backend'),
      timeout: 300000,
      silent: true
    }
  );

  runTestSuite(
    'Frontend Build',
    'npm run build',
    {
      cwd: path.join(rootDir, 'frontend'),
      timeout: 300000,
      silent: true
    }
  );

  // Generate comprehensive report
  console.log('\n📊 Generating Comprehensive Test Report...\n');

  fs.writeFileSync(
    path.join(outputDir, 'test-results.json'),
    JSON.stringify(results, null, 2)
  );

  // Generate markdown report
  const report = generateTestReport(results);
  fs.writeFileSync(
    path.join(outputDir, 'test-report.md'),
    report
  );

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 COMPREHENSIVE TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${results.summary.total}`);
  console.log(`✅ Passed: ${results.summary.passed}`);
  console.log(`❌ Failed: ${results.summary.failed}`);
  console.log(`⏭️  Skipped: ${results.summary.skipped}`);
  console.log(`⚠️  Warnings: ${results.summary.warnings}`);
  
  if (results.summary.failed > 0) {
    console.log(`\n🚨 FAILING TESTS:`);
    Object.entries(results.tests).forEach(([name, test]) => {
      if (test.status === 'FAIL') {
        console.log(`   - ${name}`);
      }
    });
  }

  console.log(`\n📁 Results saved to: ${outputDir}`);
  console.log('='.repeat(60) + '\n');

  // Exit with error code if tests failed
  if (results.summary.failed > 0) {
    process.exit(1);
  }
}

function generateTestReport(results) {
  let md = `# Comprehensive Test Report\n\n`;
  md += `**Generated:** ${results.timestamp}\n\n`;
  md += `## Summary\n\n`;
  md += `- Total Tests: ${results.summary.total}\n`;
  md += `- ✅ Passed: ${results.summary.passed}\n`;
  md += `- ❌ Failed: ${results.summary.failed}\n`;
  md += `- ⏭️  Skipped: ${results.summary.skipped}\n`;
  md += `- ⚠️  Warnings: ${results.summary.warnings}\n\n`;

  md += `## Test Results\n\n`;
  md += `| Test Suite | Status | Passed | Failed | Skipped | Duration |\n`;
  md += `|------------|--------|--------|--------|---------|----------|\n`;

  Object.entries(results.tests).forEach(([name, test]) => {
    const status = test.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    const passed = test.passed || 0;
    const failed = test.failed || 0;
    const skipped = test.skipped || 0;
    const duration = test.duration || 'N/A';
    md += `| ${name} | ${status} | ${passed} | ${failed} | ${skipped} | ${duration} |\n`;
  });

  if (results.summary.failed > 0) {
    md += `\n## Failed Tests\n\n`;
    Object.entries(results.tests).forEach(([name, test]) => {
      if (test.status === 'FAIL') {
        md += `### ${name}\n\n`;
        md += `**Status:** ❌ FAILED\n\n`;
        if (test.error) {
          md += `**Error:**\n\`\`\`\n${test.error}\n\`\`\`\n\n`;
        }
        md += `**Details:** See \`${name.replace(/\s+/g, '-').toLowerCase()}-error.log\`\n\n`;
      }
    });
  }

  return md;
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

