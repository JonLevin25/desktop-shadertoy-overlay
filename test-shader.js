const { spawn } = require('child_process');
const path = require('path');

const shaderFiles = [
  'shaders/synthwave-sunset.glsl',
  'shaders/universe-ball.glsl'
];

function testShader(shaderFile) {
  return new Promise((resolve) => {
    console.log(`\n=== Testing ${shaderFile} ===\n`);
    
    const electron = spawn('electron', ['.', '--shader', shaderFile], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    });

    // Wait 10 seconds then kill the process
    setTimeout(() => {
      electron.kill();
      console.log(`\n=== Finished testing ${shaderFile} ===\n`);
      resolve();
    }, 10000);
  });
}

async function runTests() {
  for (const shader of shaderFiles) {
    await testShader(shader);
    // Wait a bit between tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

runTests().catch(console.error);
