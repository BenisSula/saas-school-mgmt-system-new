#!/usr/bin/env node

/**
 * Script to fix remaining TS7030 errors by adding return statements
 * This script uses regex to find and fix common patterns
 */

const fs = require('fs');
const path = require('path');

const routeFiles = [
  'backend/src/routes/exams.ts',
  'backend/src/routes/hod.ts',
  'backend/src/routes/invoices.ts',
  'backend/src/routes/metrics.ts',
  'backend/src/routes/notifications.ts',
  'backend/src/routes/notifications/email.ts',
  'backend/src/routes/payments.ts',
  'backend/src/routes/reports.ts',
];

function fixReturns(content) {
  // Pattern 1: res.json(...) or res.status(...).json(...) followed by } catch
  content = content.replace(
    /(res\.(json|status\([^)]+\)\.json|status\([^)]+\)\.send)\([^)]*\));\s*\n\s*(\})\s*\n\s*catch/g,
    '$1;\n      return;\n    $3\n    catch'
  );

  // Pattern 2: next(error) in catch block without return
  content = content.replace(
    /(next\(error\));\s*\n\s*(\})\s*\n\s*(\}\)|\))/g,
    '$1;\n      return;\n    $2\n    $3'
  );

  return content;
}

routeFiles.forEach((filePath) => {
  const fullPath = path.join(__dirname, '..', filePath);
  if (fs.existsSync(fullPath)) {
    const content = fs.readFileSync(fullPath, 'utf8');
    const fixed = fixReturns(content);
    if (content !== fixed) {
      fs.writeFileSync(fullPath, fixed, 'utf8');
      console.log(`Fixed: ${filePath}`);
    }
  }
});

console.log('Done fixing return statements');

