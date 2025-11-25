/**
 * Pre-Production QA Check Script
 * Runs comprehensive QA checks before production deployment
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const results = {
  timestamp: new Date().toISOString(),
  checks: {},
  summary: {
    passed: 0,
    failed: 0,
    warnings: 0,
    critical: []
  }
};

const outputDir = path.join(__dirname, '..', 'docs', 'preprod');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

function runCommand(name, command, options = {}) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Running: ${name}`);
  console.log(`Command: ${command}`);
  console.log('='.repeat(60));

  try {
    const output = execSync(command, {
      encoding: 'utf-8',
      stdio: options.silent ? 'pipe' : 'inherit',
      cwd: options.cwd || process.cwd(),
      timeout: options.timeout || 300000 // 5 minutes default
    });

    results.checks[name] = {
      status: 'PASS',
      output: options.silent ? output : 'See console',
      timestamp: new Date().toISOString()
    };
    results.summary.passed++;

    if (options.silent && output) {
      fs.writeFileSync(
        path.join(outputDir, `${name.replace(/\s+/g, '-').toLowerCase()}.log`),
        output
      );
    }

    return { success: true, output };
  } catch (error) {
    const isCritical = options.critical !== false;
    const status = isCritical ? 'FAIL' : 'WARN';

    results.checks[name] = {
      status,
      error: error.message,
      output: error.stdout || error.stderr || 'No output',
      timestamp: new Date().toISOString()
    };

    if (isCritical) {
      results.summary.failed++;
      results.summary.critical.push(name);
    } else {
      results.summary.warnings++;
    }

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
  console.log('\n🚀 Starting Pre-Production QA Checks...\n');
  console.log(`Output directory: ${outputDir}\n`);

  // 1. Backend Tests
  console.log('\n📦 Step 1: Backend Tests');
  runCommand('Backend Jest Tests', 'npm run test --prefix backend', {
    cwd: path.join(__dirname, '..'),
    timeout: 600000 // 10 minutes
  });

  // 2. Frontend Tests
  console.log('\n📦 Step 2: Frontend Tests');
  runCommand('Frontend Vitest Tests', 'npm run test --prefix frontend', {
    cwd: path.join(__dirname, '..'),
    timeout: 600000
  });

  // 3. E2E Tests (Playwright)
  console.log('\n📦 Step 3: E2E Tests (Playwright)');
  runCommand('Playwright E2E Tests', 'npm run test:e2e --prefix frontend', {
    cwd: path.join(__dirname, '..'),
    timeout: 900000, // 15 minutes
    critical: false // E2E tests may be flaky
  });

  // 4. Security Audit
  console.log('\n🔒 Step 4: Security Audit');
  const auditResult = runCommand('NPM Audit', 'npm audit --json', {
    cwd: path.join(__dirname, '..'),
    silent: true,
    critical: false
  });

  if (auditResult.success) {
    try {
      const auditData = JSON.parse(auditResult.output);
      fs.writeFileSync(
        path.join(outputDir, 'audit-report.json'),
        JSON.stringify(auditData, null, 2)
      );

      const vulnerabilities = auditData.vulnerabilities || {};
      const vulnCount = Object.keys(vulnerabilities).length;
      if (vulnCount > 0) {
        results.checks['NPM Audit'].vulnerabilityCount = vulnCount;
        results.checks['NPM Audit'].status = vulnCount > 10 ? 'FAIL' : 'WARN';
        if (vulnCount > 10) {
          results.summary.critical.push('NPM Audit - High vulnerability count');
        }
      }
    } catch (e) {
      console.warn('Could not parse audit JSON:', e.message);
    }
  }

  // 5. Backend Build
  console.log('\n🏗️  Step 5: Backend Production Build');
  runCommand('Backend TypeScript Build', 'npm run build --prefix backend', {
    cwd: path.join(__dirname, '..'),
    timeout: 300000
  });

  // 6. Frontend Build
  console.log('\n🏗️  Step 6: Frontend Production Build');
  runCommand('Frontend Production Build', 'npm run build --prefix frontend', {
    cwd: path.join(__dirname, '..'),
    timeout: 300000
  });

  // 7. Type Check
  console.log('\n🔍 Step 7: Type Checking');
  runCommand('Backend Type Check', 'npx tsc --noEmit --project backend/tsconfig.json', {
    cwd: path.join(__dirname, '..'),
    timeout: 180000,
    critical: false
  });

  runCommand('Frontend Type Check', 'npx tsc --noEmit --project frontend/tsconfig.json', {
    cwd: path.join(__dirname, '..'),
    timeout: 180000,
    critical: false
  });

  // 8. Linting
  console.log('\n✨ Step 8: Code Linting');
  runCommand('Backend Lint', 'npm run lint --prefix backend', {
    cwd: path.join(__dirname, '..'),
    timeout: 120000,
    critical: false
  });

  runCommand('Frontend Lint', 'npm run lint --prefix frontend', {
    cwd: path.join(__dirname, '..'),
    timeout: 120000,
    critical: false
  });

  // Generate summary
  console.log('\n📊 Generating Summary...\n');

  const summary = {
    timestamp: results.timestamp,
    totalChecks: Object.keys(results.checks).length,
    passed: results.summary.passed,
    failed: results.summary.failed,
    warnings: results.summary.warnings,
    criticalIssues: results.summary.critical,
    checks: results.checks
  };

  fs.writeFileSync(
    path.join(outputDir, 'qa-results.json'),
    JSON.stringify(summary, null, 2)
  );

  // Generate markdown checklist
  const checklist = generateChecklist(summary);
  fs.writeFileSync(
    path.join(outputDir, 'preprod-checklist.md'),
    checklist
  );

  // Generate remediation tasks if needed
  if (results.summary.failed > 0 || results.summary.critical.length > 0) {
    const remediation = generateRemediation(summary);
    fs.writeFileSync(
      path.join(outputDir, 'remediation-tasks.md'),
      remediation
    );
  }

  // Generate release notes template
  const releaseNotes = generateReleaseNotes(summary);
  fs.writeFileSync(
    path.join(outputDir, 'release-note-template.md'),
    releaseNotes
  );

  // Print final summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 PRE-PRODUCTION QA SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Checks: ${summary.totalChecks}`);
  console.log(`✅ Passed: ${summary.passed}`);
  console.log(`❌ Failed: ${summary.failed}`);
  console.log(`⚠️  Warnings: ${summary.warnings}`);
  
  if (summary.criticalIssues.length > 0) {
    console.log(`\n🚨 CRITICAL ISSUES:`);
    summary.criticalIssues.forEach(issue => {
      console.log(`   - ${issue}`);
    });
  }

  console.log(`\n📁 Results saved to: ${outputDir}`);
  console.log('='.repeat(60) + '\n');

  // Exit with error code if critical issues
  if (results.summary.failed > 0) {
    process.exit(1);
  }
}

function generateChecklist(summary) {
  let md = `# Pre-Production Checklist\n\n`;
  md += `**Generated:** ${summary.timestamp}\n\n`;
  md += `## Summary\n\n`;
  md += `- Total Checks: ${summary.totalChecks}\n`;
  md += `- ✅ Passed: ${summary.passed}\n`;
  md += `- ❌ Failed: ${summary.failed}\n`;
  md += `- ⚠️  Warnings: ${summary.warnings}\n\n`;

  md += `## Test Results\n\n`;
  md += `| Check | Status | Notes |\n`;
  md += `|-------|--------|-------|\n`;

  Object.entries(summary.checks).forEach(([name, check]) => {
    const status = check.status === 'PASS' ? '✅ PASS' : check.status === 'FAIL' ? '❌ FAIL' : '⚠️  WARN';
    const notes = check.error ? check.error.substring(0, 100) : 'OK';
    md += `| ${name} | ${status} | ${notes} |\n`;
  });

  if (summary.criticalIssues.length > 0) {
    md += `\n## 🚨 Critical Issues\n\n`;
    summary.criticalIssues.forEach(issue => {
      md += `- ${issue}\n`;
    });
  }

  return md;
}

function generateRemediation(summary) {
  let md = `# Remediation Tasks\n\n`;
  md += `**Generated:** ${summary.timestamp}\n\n`;
  md += `## Priority: HIGH (Must Fix Before Production)\n\n`;

  const failedChecks = Object.entries(summary.checks)
    .filter(([_, check]) => check.status === 'FAIL');

  if (failedChecks.length === 0) {
    md += `No critical failures found.\n\n`;
  } else {
    failedChecks.forEach(([name, check]) => {
      md += `### ${name}\n\n`;
      md += `**Status:** ❌ FAILED\n\n`;
      md += `**Error:**\n\`\`\`\n${check.error || 'Unknown error'}\n\`\`\`\n\n`;
      md += `**Suggested Fix:**\n`;
      md += `- Review error logs in \`docs/preprod/${name.replace(/\s+/g, '-').toLowerCase()}-error.log\`\n`;
      md += `- Check test output for specific failures\n`;
      md += `- Verify dependencies and environment setup\n\n`;
    });
  }

  md += `## Priority: MEDIUM (Should Fix)\n\n`;
  const warnings = Object.entries(summary.checks)
    .filter(([_, check]) => check.status === 'WARN');

  if (warnings.length === 0) {
    md += `No warnings found.\n\n`;
  } else {
    warnings.forEach(([name, check]) => {
      md += `### ${name}\n\n`;
      md += `**Status:** ⚠️  WARNING\n\n`;
      if (check.vulnerabilityCount) {
        md += `**Issue:** ${check.vulnerabilityCount} vulnerabilities found\n\n`;
        md += `**Action:** Run \`npm audit fix\` to resolve automatically fixable issues\n\n`;
      }
    });
  }

  return md;
}

function generateReleaseNotes(summary) {
  let md = `# Release Notes Template\n\n`;
  md += `**Release Date:** [TO BE FILLED]\n`;
  md += `**Version:** [TO BE FILLED]\n`;
  md += `**QA Status:** ${summary.failed === 0 ? '✅ PASSED' : '❌ FAILED'}\n\n`;

  md += `## Pre-Production QA Results\n\n`;
  md += `- Total Checks: ${summary.totalChecks}\n`;
  md += `- Passed: ${summary.passed}\n`;
  md += `- Failed: ${summary.failed}\n`;
  md += `- Warnings: ${summary.warnings}\n\n`;

  if (summary.criticalIssues.length > 0) {
    md += `## ⚠️  Known Issues\n\n`;
    summary.criticalIssues.forEach(issue => {
      md += `- ${issue}\n`;
    });
    md += `\n`;
  }

  md += `## Features\n\n`;
  md += `[List new features and improvements]\n\n`;

  md += `## Bug Fixes\n\n`;
  md += `[List bug fixes]\n\n`;

  md += `## Security Updates\n\n`;
  md += `[List security patches and updates]\n\n`;

  md += `## Deployment Notes\n\n`;
  md += `[Add deployment instructions and requirements]\n\n`;

  return md;
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});


