#!/usr/bin/env node

/**
 * Scan admin pages for mock data, placeholders, and hardcoded arrays
 * Outputs a report of findings for fixing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const adminPagesDir = path.join(__dirname, '../frontend/src/pages/admin');
const report = {
  mockData: [],
  placeholders: [],
  hardcodedArrays: [],
  todos: [],
  files: [],
};

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(process.cwd(), filePath);
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;

    // Check for mock data patterns
    if (
      /mock|dummy|fake|sample/i.test(line) &&
      /data|array|object/i.test(line)
    ) {
      report.mockData.push({
        file: relativePath,
        line: lineNum,
        content: line.trim(),
      });
    }

    // Check for placeholder patterns
    if (
      /placeholder|coming soon|to be implemented|not implemented/i.test(line)
    ) {
      report.placeholders.push({
        file: relativePath,
        line: lineNum,
        content: line.trim(),
      });
    }

    // Check for hardcoded arrays (potential mock data)
    if (
      /const\s+\w+\s*=\s*\[.*\{/s.test(line) ||
      /const\s+\w+Data\s*=\s*\[/i.test(line)
    ) {
      // Skip if it's clearly a hook or API call
      if (
        !/use[A-Z]|api\.|fetch|query/i.test(line) &&
        line.includes('[') &&
        line.includes('{')
      ) {
        report.hardcodedArrays.push({
          file: relativePath,
          line: lineNum,
          content: line.trim().substring(0, 100),
        });
      }
    }

    // Check for TODOs related to data
    if (/TODO.*data|TODO.*api|TODO.*fetch/i.test(line)) {
      report.todos.push({
        file: relativePath,
        line: lineNum,
        content: line.trim(),
      });
    }
  });
}

function scanDirectory(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && entry.name.endsWith('.tsx')) {
      report.files.push(fullPath);
      scanFile(fullPath);
    }
  }
}

// Scan admin pages
if (fs.existsSync(adminPagesDir)) {
  scanDirectory(adminPagesDir);
} else {
  console.error(`Directory not found: ${adminPagesDir}`);
  process.exit(1);
}

// Generate report
const reportPath = path.join(__dirname, '../MOCK_DATA_SCAN_REPORT.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log('📊 Mock Data Scan Report');
console.log('='.repeat(50));
console.log(`Files scanned: ${report.files.length}`);
console.log(`Mock data found: ${report.mockData.length}`);
console.log(`Placeholders found: ${report.placeholders.length}`);
console.log(`Hardcoded arrays found: ${report.hardcodedArrays.length}`);
console.log(`TODOs found: ${report.todos.length}`);
console.log(`\nFull report saved to: ${reportPath}`);

if (report.mockData.length > 0) {
  console.log('\n⚠️  Mock Data Issues:');
  report.mockData.forEach((item) => {
    console.log(`  ${item.file}:${item.line} - ${item.content.substring(0, 60)}...`);
  });
}

if (report.placeholders.length > 0) {
  console.log('\n⚠️  Placeholder Issues:');
  report.placeholders.forEach((item) => {
    console.log(`  ${item.file}:${item.line} - ${item.content.substring(0, 60)}...`);
  });
}

