/**
 * Accessibility Scan Script
 * Runs axe-core tests on key pages and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const reportDir = path.join(__dirname, '../docs/a11y-reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

console.log('🔍 Running accessibility scan...\n');

try {
  // Run accessibility tests
  const output = execSync('cd frontend && npm test -- accessibility', {
    encoding: 'utf-8',
    stdio: 'pipe',
  });

  console.log('✅ Accessibility scan completed');
  console.log(output);

  // Note: Actual report generation will be done in the test file
  console.log('\n📊 Reports will be generated in docs/a11y-reports/');
} catch (error) {
  console.error('❌ Accessibility scan failed:', error.message);
  process.exit(1);
}

