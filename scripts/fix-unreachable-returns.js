const fs = require('fs');
const path = require('path');

const files = [
  'backend/src/routes/superuser/users.ts',
  'backend/src/routes/support/tickets.ts',
  'backend/src/routes/teacher.ts',
  'backend/src/routes/teachers.ts',
  'backend/src/routes/users.ts',
];

files.forEach(file => {
  const filePath = path.join(process.cwd(), file);
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} - not found`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  
  // Remove return; statements that come after return res.status().json() or return res.json()
  // Pattern: return res.status(...).json(...);\n return;
  content = content.replace(/return res\.(status\([^)]+\)\.)?json\([^)]+\);\s*\n\s*return;/g, (match) => {
    return match.replace(/\s*\n\s*return;/, '');
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed ${file}`);
  } else {
    console.log(`No changes needed in ${file}`);
  }
});

console.log('Done!');

