// vercel-dashboard/scripts/build.js
// Cross-platform build script for Vercel (runs on Linux)

import fs from 'fs';
import path from 'path';

const cwd = process.cwd();
const dashboardDir = path.join(cwd, 'vercel-dashboard', 'dashboard');
const publicDir = path.join(cwd, 'vercel-dashboard', 'public');

console.log('🔨 Building Chaos C2 Dashboard...');
console.log(`Dashboard: ${dashboardDir}`);
console.log(`Public: ${publicDir}`);
console.log(`CWD: ${cwd}`);

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
  console.log('📁 Created public/ directory');
}

// Copy function
function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.log(`⚠️  Source not found: ${src}`);
    return 0;
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  let copied = 0;

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copied += copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      copied++;
    }
  }
  return copied;
}

// Copy dashboard/* to public/
console.log('📂 Copying dashboard/ to public/...');
const count = copyRecursive(dashboardDir, publicDir);
console.log(`✅ Copied ${count} files`);

// Verify key files
const requiredFiles = [
  'index.html',
  'dashboard-main.js',
  'affiliate-index.html',
  'affiliate-app.js',
  'admin-index.html',
  'admin-app.js',
  'negotiation-victim.html',
  'negotiation-victim.js',
  'negotiation-admin.html',
  'negotiation-admin.js'
];

console.log('\n🔍 Verifying required files:');
for (const file of requiredFiles) {
  const filePath = path.join(publicDir, file);
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`  ✅ ${file} (${(stats.size / 1024).toFixed(1)} KB)`);
  } else {
    console.log(`  ❌ ${file} - MISSING!`);
  }
}

console.log('\n🎉 Build completed successfully!');