const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../src/index.html');
const destPath = path.join(__dirname, '../dist/src/index.html');
const destDir = path.dirname(destPath);

// Create dist/src directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy HTML file
fs.copyFileSync(srcPath, destPath);
console.log('Copied index.html to dist/src/');

