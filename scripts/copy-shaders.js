const fs = require('fs');
const path = require('path');

const shadersSrcPath = path.join(__dirname, '../shaders');
const shadersDestPath = path.join(__dirname, '../dist/shaders');

// Create dist/shaders directory if it doesn't exist
if (!fs.existsSync(shadersDestPath)) {
  fs.mkdirSync(shadersDestPath, { recursive: true });
}

// Copy all shader files
if (fs.existsSync(shadersSrcPath)) {
  const files = fs.readdirSync(shadersSrcPath);
  let copiedCount = 0;
  
  files.forEach(file => {
    if (/\.(glsl|frag|fragment)$/i.test(file)) {
      const srcFile = path.join(shadersSrcPath, file);
      const destFile = path.join(shadersDestPath, file);
      fs.copyFileSync(srcFile, destFile);
      copiedCount++;
    }
  });
  
  console.log(`Copied ${copiedCount} shader file(s) to dist/shaders/`);
} else {
  console.log('No shaders directory found, skipping...');
}
