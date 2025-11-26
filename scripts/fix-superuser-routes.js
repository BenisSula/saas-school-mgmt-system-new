#!/usr/bin/env node
/**
 * Script to fix TS7030 errors in superuser and support routes
 */

const fs = require('fs');
const path = require('path');
const { glob } = require('glob');

const routeFiles = [
  'backend/src/routes/superuser/**/*.ts',
  'backend/src/routes/support/**/*.ts',
];

async function fixFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: res.json(...); followed by } catch or } finally
  const patterns = [
    // res.json() before catch
    [/(\s+res\.json\([^)]+\);\s*)(\n\s+} catch)/g, 'res.json before catch'],
    // res.status().json() before catch
    [/(\s+res\.status\([^)]+\)\.json\([^)]+\);\s*)(\n\s+} catch)/g, 'res.status().json before catch'],
    // res.send() before catch
    [/(\s+res\.send\([^)]+\);\s*)(\n\s+} catch)/g, 'res.send before catch'],
    // res.status().send() before catch
    [/(\s+res\.status\([^)]+\)\.send\(\);\s*)(\n\s+} catch)/g, 'res.status().send before catch'],
    // next(error); before }
    [/(\s+next\(error\);\s*)(\n\s+})/g, 'next(error) before closing brace'],
    // res.json() before } finally
    [/(\s+res\.json\([^)]+\);\s*)(\n\s+} finally)/g, 'res.json before finally'],
    // res.status().json() before } finally
    [/(\s+res\.status\([^)]+\)\.json\([^)]+\);\s*)(\n\s+} finally)/g, 'res.status().json before finally'],
  ];

  for (const [pattern, description] of patterns) {
    content = content.replace(pattern, (match, p1, p2) => {
      // Check if return statement already exists
      if (!p1.trim().endsWith('return;')) {
        modified = true;
        // Determine indentation from the response line
        const indentMatch = p1.match(/^(\s*)/);
        const indent = indentMatch ? indentMatch[1] : '      ';
        return p1 + `\n${indent}return;` + p2;
      }
      return match;
    });
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }

  return false;
}

async function main() {
  const allFiles = [];
  for (const pattern of routeFiles) {
    const files = await glob(pattern, { cwd: process.cwd() });
    allFiles.push(...files);
  }

  let fixedCount = 0;
  for (const file of allFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (await fixFile(fullPath)) {
      fixedCount++;
      console.log(`Fixed ${file}`);
    }
  }

  console.log(`\nFixed ${fixedCount} files`);
}

main().catch(console.error);

