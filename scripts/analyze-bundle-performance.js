/**
 * Bundle Performance Analysis Script
 * Analyzes bundle sizes and identifies optimization opportunities
 */

const fs = require('fs');
const path = require('path');

const distDir = path.join(__dirname, '..', 'frontend', 'dist', 'assets');
const reportPath = path.join(__dirname, '..', 'performance_report.json');

// Analyze bundle files
function analyzeBundle() {
  if (!fs.existsSync(distDir)) {
    console.error('dist/assets directory not found. Run npm run build first.');
    return null;
  }

  const files = fs.readdirSync(distDir).filter(f => f.endsWith('.js') && !f.endsWith('.map'));
  const chunks = [];

  for (const file of files) {
    const filePath = path.join(distDir, file);
    const stats = fs.statSync(filePath);
    const sizeKB = Math.round((stats.size / 1024) * 100) / 100;
    const sizeMB = Math.round((stats.size / (1024 * 1024)) * 100) / 100;

    // Categorize chunks
    let category = 'other';
    if (file.includes('vendor')) {
      category = 'vendor';
    } else if (file.includes('index')) {
      category = 'main';
    } else if (file.includes('Page') || file.includes('page')) {
      category = 'page';
    } else if (file.includes('Component') || file.includes('Modal') || file.includes('Table')) {
      category = 'component';
    } else if (file.includes('use') || file.includes('hook')) {
      category = 'hook';
    }

    chunks.push({
      name: file,
      size: stats.size,
      sizeKB,
      sizeMB,
      category,
    });
  }

  // Sort by size
  chunks.sort((a, b) => b.size - a.size);

  // Calculate totals
  const totalSize = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
  const totalSizeKB = Math.round((totalSize / 1024) * 100) / 100;
  const totalSizeMB = Math.round((totalSize / (1024 * 1024)) * 100) / 100;

  // Group by category
  const byCategory = chunks.reduce((acc, chunk) => {
    if (!acc[chunk.category]) {
      acc[chunk.category] = [];
    }
    acc[chunk.category].push(chunk);
    return acc;
  }, {});

  // Find large chunks (>100KB)
  const largeChunks = chunks.filter(c => c.sizeKB > 100);

  // Find potential duplicates (similar names)
  const potentialDuplicates = [];
  const nameMap = {};
  chunks.forEach(chunk => {
    const baseName = chunk.name.replace(/-\w+\.js$/, '');
    if (!nameMap[baseName]) {
      nameMap[baseName] = [];
    }
    nameMap[baseName].push(chunk);
  });

  Object.entries(nameMap).forEach(([baseName, files]) => {
    if (files.length > 1) {
      potentialDuplicates.push({
        baseName,
        files: files.map(f => ({ name: f.name, sizeKB: f.sizeKB })),
      });
    }
  });

  return {
    timestamp: new Date().toISOString(),
    summary: {
      totalChunks: chunks.length,
      totalSize,
      totalSizeKB,
      totalSizeMB,
      largeChunks: largeChunks.length,
    },
    chunks: chunks.map(c => ({
      name: c.name,
      sizeKB: c.sizeKB,
      sizeMB: c.sizeMB,
      category: c.category,
    })),
    byCategory: Object.entries(byCategory).reduce((acc, [category, files]) => {
      const total = files.reduce((sum, f) => sum + f.size, 0);
      acc[category] = {
        count: files.length,
        totalSizeKB: Math.round((total / 1024) * 100) / 100,
        chunks: files.map(f => ({ name: f.name, sizeKB: f.sizeKB })),
      };
      return acc;
    }, {}),
    largeChunks: largeChunks.map(c => ({
      name: c.name,
      sizeKB: c.sizeKB,
      category: c.category,
      recommendation: c.sizeKB > 500 ? 'Consider code splitting' : 'Review for optimization',
    })),
    potentialDuplicates,
    recommendations: [
      {
        priority: 'high',
        issue: 'Large vendor chunks detected',
        action: 'Review vendor chunk sizes and consider further splitting',
        chunks: largeChunks.filter(c => c.category === 'vendor').map(c => c.name),
      },
      {
        priority: 'medium',
        issue: 'Large page chunks detected',
        action: 'Ensure all pages are lazy-loaded and consider route-based code splitting',
        chunks: largeChunks.filter(c => c.category === 'page').map(c => c.name),
      },
      {
        priority: 'low',
        issue: 'Potential duplicate chunks',
        action: 'Review for duplicate dependencies or code',
        duplicates: potentialDuplicates,
      },
    ],
  };
}

// Generate report
const report = analyzeBundle();

if (report) {
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('Bundle Performance Analysis Complete');
  console.log(`Report written to: ${reportPath}`);
  console.log(`\nSummary:`);
  console.log(`  Total Chunks: ${report.summary.totalChunks}`);
  console.log(`  Total Size: ${report.summary.totalSizeMB} MB (${report.summary.totalSizeKB} KB)`);
  console.log(`  Large Chunks (>100KB): ${report.summary.largeChunks}`);
  console.log(`\nBy Category:`);
  Object.entries(report.byCategory).forEach(([category, data]) => {
    console.log(`  ${category}: ${data.count} chunks, ${data.totalSizeKB} KB`);
  });
  console.log(`\nTop 10 Largest Chunks:`);
  report.chunks.slice(0, 10).forEach((chunk, i) => {
    console.log(`  ${i + 1}. ${chunk.name}: ${chunk.sizeKB} KB`);
  });
} else {
  console.error('Failed to analyze bundle. Run npm run build first.');
  process.exit(1);
}

