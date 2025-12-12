// Simple script to create a basic icon if needed
// This is a placeholder - in production you'd use a real icon file

const fs = require('fs');
const path = require('path');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, '../assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

console.log('Icon placeholder created. In production, add a real icon.png file to assets/');

