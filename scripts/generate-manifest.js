/**
 * Generate manifest file for backend directory
 * Creates a JSON file with file paths, SHA256 hashes, and sizes
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const root = path.join(__dirname, '..', 'backend');
const outputPath = path.join(__dirname, '..', 'backups', 'backend_manifest.json');

function generateManifest() {
  const out = [];

  function walkDir(dirPath) {
    const files = fs.readdirSync(dirPath);

    for (const file of files) {
      const filePath = path.join(dirPath, file);
      const stat = fs.statSync(filePath);

      if (stat.isDirectory()) {
        // Skip node_modules, dist, and other build artifacts
        if (file === 'node_modules' || file === 'dist' || file === '.git') {
          continue;
        }
        walkDir(filePath);
      } else if (stat.isFile()) {
        try {
          const fileContent = fs.readFileSync(filePath);
          const hash = crypto.createHash('sha256').update(fileContent).digest('hex');
          const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
          
          out.push({
            path: relativePath,
            sha256: hash,
            size: stat.size
          });
        } catch (error) {
          const relativePath = path.relative(root, filePath).replace(/\\/g, '/');
          out.push({
            path: relativePath,
            error: error.message
          });
        }
      }
    }
  }

  // Ensure backups directory exists
  const backupsDir = path.dirname(outputPath);
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  // Walk the directory tree
  if (fs.existsSync(root)) {
    walkDir(root);
  } else {
    console.error(`Error: Backend directory not found at ${root}`);
    process.exit(1);
  }

  // Write manifest
  fs.writeFileSync(outputPath, JSON.stringify(out, null, 2), 'utf8');
  console.log(`Manifest written to: ${outputPath}`);
  console.log(`Total files: ${out.length}`);
  
  return out;
}

generateManifest();

