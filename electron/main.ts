import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

let mainWindow: BrowserWindow | null = null;
let overlayVisible = false;
let tray: Tray | null = null;
let appIsQuitting = false;
let showInTaskbar = false; // Whether window appears in taskbar/alt-tab
let isClickthrough = true; // Track clickthrough state
let testShaderPath: string | null = null; // Shader to load for testing

// Parse command line arguments
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--shader' || args[i] === '-s') {
    if (i + 1 < args.length) {
      testShaderPath = args[i + 1];
      console.log('CLI: Will load test shader:', testShaderPath);
    }
  }
}

function createWindow() {
  // Get primary display dimensions
  const { screen } = require('electron');
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: !showInTaskbar, // Controlled by option
    resizable: false,
    movable: false,
    fullscreen: true,
    backgroundColor: '#00000000', // Fully transparent background
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false, // Keep rendering smooth
    },
  });
  
  // On Windows, ensure proper transparency
  if (process.platform === 'win32') {
    mainWindow.setBackgroundColor('#00000000');
  }

  // Set clickthrough initially
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  isClickthrough = true;
  
  // Handle window focus/blur to toggle clickthrough and devtools
  mainWindow.on('focus', () => {
    // When window is focused, disable clickthrough so user can interact
    if (isClickthrough && !overlayVisible) {
      isClickthrough = false;
      mainWindow?.setIgnoreMouseEvents(false);
      console.log('Window focused, clickthrough disabled');
    }
  });
  
  mainWindow.on('blur', () => {
    // When window loses focus, enable clickthrough unless overlay is visible
    if (!overlayVisible && !isClickthrough) {
      isClickthrough = true;
      mainWindow?.setIgnoreMouseEvents(true, { forward: true });
      console.log('Window blurred, clickthrough enabled');
    }
  });
  
  // Register F12 to toggle DevTools (only works when window is focused)
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12') {
      event.preventDefault();
      if (mainWindow) {
        if (mainWindow.webContents.isDevToolsOpened()) {
          mainWindow.webContents.closeDevTools();
        } else {
          mainWindow.webContents.openDevTools();
        }
      }
    }
  });

  // Load the renderer (HTML is copied to dist/src/ during build)
  // __dirname is dist/electron, so we go up one level to dist/, then into src/
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  // Open DevTools if testing a shader
  if (testShaderPath) {
    mainWindow.webContents.openDevTools();
    console.log('CLI: DevTools opened for testing');
  }
  
  // When page loads, send test shader path if provided
  mainWindow.webContents.once('did-finish-load', () => {
    if (testShaderPath && mainWindow) {
      // Resolve relative paths to absolute
      let resolvedPath = testShaderPath;
      if (!path.isAbsolute(testShaderPath)) {
        // If relative, resolve from project root
        const projectRoot = app.isPackaged 
          ? path.join(__dirname, '../../')
          : path.join(__dirname, '../../');
        resolvedPath = path.resolve(projectRoot, testShaderPath);
      }
      console.log('CLI: Original path:', testShaderPath);
      console.log('CLI: Resolved path:', resolvedPath);
      console.log('CLI: File exists:', fs.existsSync(resolvedPath));
      if (fs.existsSync(resolvedPath)) {
        console.log('CLI: Sending test shader path to renderer:', resolvedPath);
        mainWindow.webContents.send('load-test-shader', resolvedPath);
      } else {
        console.error('CLI: Shader file not found:', resolvedPath);
      }
    }
  });
  
  // Log any errors
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Prevent window from being closed - hide it instead (unless showInTaskbar is true)
  mainWindow.on('close', (event) => {
    if (!appIsQuitting && !showInTaskbar) {
      // If not showing in taskbar, prevent close and hide instead
      event.preventDefault();
      mainWindow?.hide();
    }
    // If showInTaskbar is true, allow normal close behavior
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Handle window minimize/restore
  mainWindow.on('minimize', () => {
    // Keep window visible even when "minimized"
    mainWindow?.show();
  });
  
  // Ensure window stays visible
  mainWindow.on('blur', () => {
    // Keep window on top even when it loses focus
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }
  });
}

function registerGlobalShortcut() {
  // Register Ctrl+` (backtick) to toggle overlay
  // Note: On Windows, use 'Ctrl+`', on Mac use 'Command+`'
  const shortcut = process.platform === 'darwin' ? 'Command+`' : 'Ctrl+`';
  const ret = globalShortcut.register(shortcut, () => {
    toggleOverlay();
  });

  if (!ret) {
    console.log('Global shortcut registration failed for:', shortcut);
  } else {
    console.log('Global shortcut registered:', shortcut);
  }
  
  // Register Ctrl+Shift+D to focus window and toggle clickthrough (D for DevTools/debug)
  const focusShortcut = process.platform === 'darwin' ? 'Command+Shift+D' : 'Ctrl+Shift+D';
  const focusRet = globalShortcut.register(focusShortcut, () => {
    if (mainWindow) {
      if (isClickthrough) {
        // Focus window and disable clickthrough
        mainWindow.setIgnoreMouseEvents(false);
        isClickthrough = false;
        mainWindow.focus();
        console.log('Window focused, clickthrough disabled');
      } else {
        // Enable clickthrough and blur
        mainWindow.setIgnoreMouseEvents(true, { forward: true });
        isClickthrough = true;
        console.log('Clickthrough enabled, window blurred');
      }
    }
  });
  
  if (!focusRet) {
    console.log('Focus shortcut registration failed for:', focusShortcut);
  } else {
    console.log('Focus shortcut registered:', focusShortcut);
  }
}

function toggleOverlay() {
  overlayVisible = !overlayVisible;
  
  if (mainWindow) {
    // Ensure window is visible
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }
    
    // Only disable clickthrough when overlay UI is VISIBLE (so user can interact with it)
    // When overlay UI is hidden, enable clickthrough so clicks pass through
    isClickthrough = !overlayVisible;
    mainWindow.setIgnoreMouseEvents(isClickthrough, { forward: true });
    
    // Focus window when overlay is shown so F12 works
    if (overlayVisible) {
      mainWindow.focus();
    }
    
    // When overlay UI is visible, ensure window is at full opacity so UI is readable
    // When hidden, opacity is controlled by canvas CSS opacity
    if (overlayVisible) {
      mainWindow.setOpacity(1.0);
    }
    
    // Send message to renderer to show/hide overlay UI
    mainWindow.webContents.send('toggle-overlay', overlayVisible);
  } else {
    // Window doesn't exist, create it
    createWindow();
  }
}

function showWindow() {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
}

function hideWindow() {
  if (mainWindow) {
    mainWindow.hide();
  }
}

function createTray() {
  // Create a simple programmatic icon
  // Create a 32x32 image with a simple shader-like pattern
  const size = 32;
  const iconData = Buffer.alloc(size * size * 4);
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      // Create a colorful gradient pattern
      const r = Math.floor((x / size) * 255);
      const g = Math.floor((y / size) * 255);
      const b = Math.floor(((x + y) / (size * 2)) * 255);
      iconData[i] = r;     // R
      iconData[i + 1] = g; // G
      iconData[i + 2] = b; // B
      iconData[i + 3] = 255; // A
    }
  }
  
  const trayIcon = nativeImage.createFromBuffer(iconData, { width: size, height: size });
  tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: () => {
        showWindow();
      }
    },
    {
      label: 'Hide Window',
      click: () => {
        hideWindow();
      }
    },
    {
      label: 'Toggle Overlay UI',
      click: () => {
        toggleOverlay();
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Exit',
      click: () => {
        appIsQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('Shadertoy Overlay');
  tray.setContextMenu(contextMenu);
  
  // Also allow single click to show/hide window
  tray.on('click', () => {
    if (mainWindow && mainWindow.isVisible()) {
      hideWindow();
    } else {
      showWindow();
    }
  });
}


app.on('window-all-closed', () => {
  // Don't quit on window close - keep tray icon running
  // User can exit via tray menu
  if (appIsQuitting) {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (tray) {
    tray.destroy();
  }
});

// IPC handlers
ipcMain.handle('get-window-size', () => {
  if (mainWindow) {
    const size = mainWindow.getSize();
    return { width: size[0], height: size[1] };
  }
  return { width: 1920, height: 1080 };
});

ipcMain.handle('set-clickthrough', (_, enabled: boolean) => {
  if (mainWindow) {
    mainWindow.setIgnoreMouseEvents(enabled, { forward: true });
    overlayVisible = !enabled;
  }
});

ipcMain.handle('set-opacity', (_, opacity: number) => {
  // Don't use window-level opacity anymore - opacity is applied via CSS to canvas only
  // This keeps the overlay UI fully opaque
  // The opacity value is handled in the renderer via canvas.style.opacity
});

ipcMain.handle('exit-app', () => {
  appIsQuitting = true;
  app.quit();
});

ipcMain.handle('set-show-in-taskbar', (_, show: boolean) => {
  // Prevent infinite loop - if already set to this value, don't recreate
  if (showInTaskbar === show && mainWindow) {
    return;
  }
  
  showInTaskbar = show;
  savePreferences(); // Save the preference
  if (mainWindow) {
    // On Windows, setSkipTaskbar() doesn't always work reliably
    // We need to recreate the window with the correct setting
    const wasVisible = mainWindow.isVisible();
    const currentOpacity = mainWindow.getOpacity();
    
    // Store current state
    const currentClickthrough = isClickthrough;
    const currentOverlayVisible = overlayVisible;
    
    // Close the old window
    mainWindow.removeAllListeners('close');
    mainWindow.destroy();
    mainWindow = null;
    
    // Recreate window with new taskbar setting
    createWindow();
    
    // Restore state - use setTimeout to ensure window is created
    setTimeout(() => {
      const restoredWindow = mainWindow;
      if (restoredWindow) {
        if (wasVisible) {
          restoredWindow.show();
        }
        restoredWindow.setOpacity(currentOpacity);
        isClickthrough = currentClickthrough;
        overlayVisible = currentOverlayVisible;
        restoredWindow.setIgnoreMouseEvents(isClickthrough, { forward: true });
        
        // Restore overlay visibility state
        if (currentOverlayVisible) {
          restoredWindow.webContents.send('toggle-overlay', true);
        }
        
        // Set up close handler based on taskbar setting
        restoredWindow.removeAllListeners('close');
        if (show) {
          restoredWindow.on('close', () => {
            appIsQuitting = true;
            app.quit();
          });
        } else {
          restoredWindow.on('close', (event: Electron.Event) => {
            if (!appIsQuitting) {
              event.preventDefault();
              restoredWindow.hide();
            }
          });
        }
      }
    }, 100);
  }
});

ipcMain.handle('get-show-in-taskbar', () => {
  return showInTaskbar;
});

// Get shaders directory path (relative to app root)
function getShadersDirectory(): string {
  if (app.isPackaged) {
    // In production/packaged app, shaders are in dist/shaders
    // __dirname is dist/electron, so we go up one level to dist/
    return path.join(__dirname, '../shaders');
  } else {
    // When running from project root (npm start), use project root shaders directory
    // __dirname is dist/electron, so we go up to dist/, then to project root
    const projectRoot = path.join(__dirname, '../../');
    return path.join(projectRoot, 'shaders');
  }
}

// List shader files from shaders directory
ipcMain.handle('list-shader-files', () => {
  try {
    const shadersDir = getShadersDirectory();
    if (!fs.existsSync(shadersDir)) {
      fs.mkdirSync(shadersDir, { recursive: true });
      return [];
    }
    
    const files = fs.readdirSync(shadersDir);
    return files
      .filter(file => /\.(glsl|frag|fragment)$/i.test(file))
      .map(file => path.join(shadersDir, file));
  } catch (error) {
    console.error('Failed to list shader files:', error);
    return [];
  }
});

// Read shader file content
ipcMain.handle('read-shader-file', (_, filePath: string) => {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Failed to read shader file:', error);
    throw error;
  }
});

// Removed Shadertoy URL loading feature

// Fetch shader from Shadertoy (main process can bypass CORS) - REMOVED
/*ipcMain.handle('fetch-shadertoy-shader', async (_, url: string) => {
  try {
    // Extract shader ID from URL
    const match = url.match(/shadertoy\.com\/view\/([A-Za-z0-9]+)/);
    if (!match) {
      throw new Error('Invalid Shadertoy URL format');
    }

    const shaderId = match[1];
    const shaderUrl = `https://www.shadertoy.com/view/${shaderId}`;
    
    console.log('Fetching Shadertoy shader:', shaderUrl);
    
    // Use Node.js https module to fetch (bypasses CORS)
    const https = require('https');
    
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      };
      
      https.get(shaderUrl, options, (res: any) => {
        let html = '';
        res.on('data', (chunk: Buffer) => {
          html += chunk.toString();
        });
        res.on('end', () => {
          try {
            console.log('Received HTML, length:', html.length);
            
            // Try multiple patterns to extract shader code
            let shaderCode: string | null = null;
            let shaderName: string = `Shadertoy ${shaderId}`;
            
            // Pattern 1: Look for JSON data in script tag with id="jsonData"
            const jsonMatch1 = html.match(/<script[^>]*id=["']jsonData["'][^>]*>(.*?)<\/script>/s);
            if (jsonMatch1) {
              try {
                const jsonData = JSON.parse(jsonMatch1[1]);
                console.log('Found jsonData script tag');
                if (jsonData.Shader && jsonData.Shader.renderpass && jsonData.Shader.renderpass[0]) {
                  shaderCode = jsonData.Shader.renderpass[0].code;
                  shaderName = jsonData.Shader.info?.name || shaderName;
                  if (shaderCode) {
                    console.log('Extracted shader code from jsonData, length:', shaderCode.length);
                  }
                }
              } catch (e) {
                console.warn('Failed to parse jsonData:', e);
              }
            }
            
            // Pattern 2: Look for window.shadertoy JSON structure
            if (!shaderCode) {
              const jsonMatch2 = html.match(/window\.shadertoy\s*=\s*({.*?});/s);
              if (jsonMatch2) {
                try {
                  const jsonData = JSON.parse(jsonMatch2[1]);
                  console.log('Found window.shadertoy');
                  if (jsonData.Shader && jsonData.Shader.renderpass && jsonData.Shader.renderpass[0]) {
                    shaderCode = jsonData.Shader.renderpass[0].code;
                    shaderName = jsonData.Shader.info?.name || shaderName;
                    if (shaderCode) {
                      console.log('Extracted shader code from window.shadertoy, length:', shaderCode.length);
                    }
                  }
                } catch (e) {
                  console.warn('Failed to parse window.shadertoy:', e);
                }
              }
            }
            
            // Pattern 3: Look for var shaderData or const shaderData
            if (!shaderCode) {
              const jsonMatch3 = html.match(/(?:var|const|let)\s+shaderData\s*=\s*({.*?});/s);
              if (jsonMatch3) {
                try {
                  const jsonData = JSON.parse(jsonMatch3[1]);
                  console.log('Found shaderData variable');
                  if (jsonData.Shader && jsonData.Shader.renderpass && jsonData.Shader.renderpass[0]) {
                    shaderCode = jsonData.Shader.renderpass[0].code;
                    shaderName = jsonData.Shader.info?.name || shaderName;
                    if (shaderCode) {
                      console.log('Extracted shader code from shaderData, length:', shaderCode.length);
                    }
                  }
                } catch (e) {
                  console.warn('Failed to parse shaderData:', e);
                }
              }
            }
            
            // Pattern 4: Look for renderpass array directly in JSON
            if (!shaderCode) {
              const renderpassMatch = html.match(/"renderpass"\s*:\s*\[\s*\{[^}]*"code"\s*:\s*"((?:[^"\\]|\\.)*)"/s);
              if (renderpassMatch) {
                shaderCode = renderpassMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                console.log('Extracted shader code from renderpass match, length:', shaderCode.length);
              }
            }
            
            // Pattern 5: Fallback to simple code extraction
            if (!shaderCode) {
              // Try to find code in a renderpass object
              const codeMatches = html.matchAll(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/g);
              for (const match of codeMatches) {
                const potentialCode = match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                // Check if it looks like shader code (has mainImage or void main)
                if (potentialCode.includes('mainImage') || potentialCode.includes('void main') || potentialCode.length > 100) {
                  shaderCode = potentialCode;
                  console.log('Extracted shader code from fallback pattern, length:', shaderCode.length);
                  break;
                }
              }
            }
            
            if (!shaderCode) {
              // Log a sample of the HTML for debugging
              console.error('Could not extract shader code. HTML sample (first 2000 chars):');
              console.error(html.substring(0, 2000));
              reject(new Error('Could not extract shader code from Shadertoy page. The page structure may have changed.'));
              return;
            }
            
            // Extract shader name if not already found
            if (shaderName === `Shadertoy ${shaderId}`) {
              const nameMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
              if (nameMatch) {
                shaderName = nameMatch[1];
              }
            }
            
            console.log('Successfully extracted shader:', shaderName, 'Code length:', shaderCode.length);
            resolve({ code: shaderCode, name: shaderName });
          } catch (error) {
            console.error('Error processing Shadertoy page:', error);
            reject(error);
          }
        });
      }).on('error', (error: Error) => {
        console.error('Error fetching Shadertoy page:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('Error in fetch-shadertoy-shader:', error);
    throw error;
  }
});*/

// Save shader to file
ipcMain.handle('save-shader-file', async (_, shaderCode: string, fileName: string) => {
  try {
    const shadersDir = getShadersDirectory();
    if (!fs.existsSync(shadersDir)) {
      fs.mkdirSync(shadersDir, { recursive: true });
    }
    
    // Sanitize filename
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.glsl';
    const filePath = path.join(shadersDir, sanitizedFileName);
    
    fs.writeFileSync(filePath, shaderCode, 'utf-8');
    return filePath;
  } catch (error) {
    console.error('Failed to save shader file:', error);
    throw error;
  }
});

// Delete shader file
ipcMain.handle('delete-shader-file', async (_, filePath: string) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to delete shader file:', error);
    throw error;
  }
});

// Open file dialog for shader files
ipcMain.handle('open-shader-file-dialog', async () => {
  if (!mainWindow) return null;
  
  const shadersDir = getShadersDirectory();
  
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select Shader File',
    defaultPath: shadersDir,
    filters: [
      { name: 'Shader Files', extensions: ['glsl', 'frag', 'fragment'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

// Watch shaders directory for changes
let shaderWatcher: fs.FSWatcher | null = null;

function setupShaderWatcher() {
  const shadersDir = getShadersDirectory();
  
  if (!fs.existsSync(shadersDir)) {
    fs.mkdirSync(shadersDir, { recursive: true });
  }

  // Close existing watcher if any
  if (shaderWatcher) {
    shaderWatcher.close();
  }

  shaderWatcher = fs.watch(shadersDir, (eventType, filename) => {
    if (filename && /\.(glsl|frag|fragment)$/i.test(filename)) {
      // Notify renderer about file changes
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shader-files-changed');
      }
    }
  });
}

// Load saved preferences before creating window
function loadSavedPreferences() {
  try {
    // Read localStorage data from userData directory
    // Electron stores localStorage in: userData/Local Storage/leveldb/
    // We'll use a simpler approach - read from a JSON file in userData
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'preferences.json');
    
    if (fs.existsSync(prefsPath)) {
      const prefsData = fs.readFileSync(prefsPath, 'utf-8');
      const prefs = JSON.parse(prefsData);
      if (prefs.showInTaskbar !== undefined) {
        showInTaskbar = prefs.showInTaskbar === true;
        console.log('Loaded saved preference - showInTaskbar:', showInTaskbar);
      }
    }
  } catch (error) {
    console.log('Could not load saved preferences:', error);
  }
}

// Save preferences
function savePreferences() {
  try {
    const userDataPath = app.getPath('userData');
    const prefsPath = path.join(userDataPath, 'preferences.json');
    const prefs = {
      showInTaskbar: showInTaskbar
    };
    fs.writeFileSync(prefsPath, JSON.stringify(prefs, null, 2));
  } catch (error) {
    console.error('Could not save preferences:', error);
  }
}

// Setup watcher when app is ready
app.whenReady().then(() => {
  loadSavedPreferences();
  createWindow();
  registerGlobalShortcut();
  createTray();
  setupShaderWatcher();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

