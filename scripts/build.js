// vercel-dashboard/scripts/build.js
import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public');
const dashboardDir = path.join(process.cwd(), 'dashboard');

// Ensure public directory exists
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Copy entire dashboard directory to public
function copyRecursive(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    if (entry.isDirectory()) {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      copyRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

console.log('Building...');
copyRecursive(dashboardDir, publicDir);
console.log('Build completed!');