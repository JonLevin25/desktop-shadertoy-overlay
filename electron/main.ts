import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;
let overlayVisible = false;
let tray: Tray | null = null;
let appIsQuitting = false;
let showInTaskbar = false; // Whether window appears in taskbar/alt-tab

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

  // Load the renderer (HTML is copied to dist/src/ during build)
  // __dirname is dist/electron, so we go up one level to dist/, then into src/
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  // DevTools closed by default - can be opened with Ctrl+Shift+I if needed
  // mainWindow.webContents.openDevTools();
  
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
  // Register Ctrl+Shift+S to toggle overlay
  const ret = globalShortcut.register('CommandOrControl+Shift+S', () => {
    toggleOverlay();
  });

  if (!ret) {
    console.log('Global shortcut registration failed');
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
    mainWindow.setIgnoreMouseEvents(!overlayVisible, { forward: true });
    
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

app.whenReady().then(() => {
  createWindow();
  registerGlobalShortcut();
  createTray();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

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
  showInTaskbar = show;
  if (mainWindow) {
    // Set skipTaskbar - this controls if window appears in taskbar/alt-tab
    mainWindow.setSkipTaskbar(!show);
    
    // Remove existing close handlers
    mainWindow.removeAllListeners('close');
    
    // If showing in taskbar, allow window to be closed normally with Alt+F4
    if (show) {
      mainWindow.on('close', () => {
        appIsQuitting = true;
        app.quit();
      });
    } else {
      // If not showing in taskbar, prevent close and hide instead
      mainWindow.on('close', (event) => {
        if (!appIsQuitting) {
          event.preventDefault();
          mainWindow?.hide();
        }
      });
    }
    
    // Force window to refresh its taskbar state
    // Sometimes we need to hide/show to make the change take effect
    const wasVisible = mainWindow.isVisible();
    if (wasVisible) {
      mainWindow.hide();
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.show();
        }
      }, 100);
    }
  }
});

ipcMain.handle('get-show-in-taskbar', () => {
  return showInTaskbar;
});

