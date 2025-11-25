/**
 * Script to create dummy files for Node built-in modules
 * This prevents Jest from trying to read them as file paths
 * These files re-export the actual Node.js built-in modules
 * Files are created with .js extension for Jest compatibility
 */
const fs = require('fs');
const path = require('path');
const builtinModules = require('module').builtinModules || [];

// Filter out sub-modules (like 'util/types')
const topLevelModules = builtinModules.filter(m => !m.includes('/'));

let created = 0;
topLevelModules.forEach(mod => {
  // Create both with and without .js extension
  const filePath = path.join(__dirname, `${mod}.js`);
  const filePathNoExt = path.join(__dirname, mod);
  
  // Simply re-export the actual built-in module
  const content = `// Auto-generated file for Node built-in '${mod}'
// This prevents Jest ENOENT errors when Jest tries to resolve built-ins as file paths
// Simply re-exports the actual Node.js built-in module
module.exports = require('${mod}');
`;
  try {
    // Create with .js extension
    fs.writeFileSync(filePath, content);
    // Also create without extension for Jest's requireInternalModule
    fs.writeFileSync(filePathNoExt, content);
    created++;
  } catch (error) {
    console.error(`Failed to create ${mod}:`, error.message);
  }
});

console.log(`Created ${created * 2} files (with and without .js extension) for Node built-in modules`);
