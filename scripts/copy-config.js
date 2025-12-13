const fs = require('fs');
const path = require('path');

const srcPath = path.join(__dirname, '../config.default.json');
const destPath = path.join(__dirname, '../dist/config.default.json');
const destDir = path.dirname(destPath);

// Create dist directory if it doesn't exist
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Copy config.default.json file if it exists
if (fs.existsSync(srcPath)) {
  fs.copyFileSync(srcPath, destPath);
  console.log('Copied config.default.json to dist/');
} else {
  console.log('config.default.json not found, skipping...');
}
