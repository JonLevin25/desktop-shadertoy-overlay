import { app, BrowserWindow, ipcMain, screen } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { AppConfig, getConfig, saveConfig } from './config';
import { getProjectRoot } from './paths';

// Window state
let mainWindow: BrowserWindow | null = null;
let overlayVisible = false;
let isClickthrough = true;
let isAppQuitting = false;

/**
 * Set the app quitting state.
 */
export function setAppQuitting(quitting: boolean): void {
  isAppQuitting = quitting;
}

/**
 * Get the main window instance.
 */
export function getMainWindow(): BrowserWindow | null {
  return mainWindow;
}

/**
 * Get current window state.
 */
export function getWindowState(): { overlayVisible: boolean; isClickthrough: boolean } {
  return { overlayVisible, isClickthrough };
}

/**
 * Check if the main window is visible.
 */
export function isWindowVisible(): boolean {
  return mainWindow?.isVisible() ?? false;
}

/**
 * Create the main overlay window.
 */
export function createMainWindow(testShaderPath: string | null): BrowserWindow {
  const config = getConfig();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  mainWindow = new BrowserWindow({
    width,
    height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: !config.showWindowInTaskbar,
    resizable: false,
    movable: false,
    fullscreen: true,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  // On Windows, ensure proper transparency
  if (process.platform === 'win32') {
    mainWindow.setBackgroundColor('#00000000');
  }

  // Set clickthrough initially
  mainWindow.setIgnoreMouseEvents(true, { forward: true });
  isClickthrough = true;

  // Blur window after creation to prevent keyboard event capture
  // (only when not in taskbar mode - taskbar mode needs focus for Alt+F4)
  const initialConfig = getConfig();
  if (!initialConfig.showWindowInTaskbar) {
    setTimeout(() => {
      if (mainWindow && !overlayVisible) {
        mainWindow.blur();
      }
    }, 100);

    mainWindow.once('ready-to-show', () => {
      if (mainWindow && !overlayVisible) {
        mainWindow.blur();
      }
    });
  }

  // Handle window focus
  mainWindow.on('focus', () => {
    const config = getConfig();
    
    // If showWindowInTaskbar and showSettingsOnWindowFocused are both enabled,
    // automatically show the overlay when window is focused
    if (config.showWindowInTaskbar && config.showSettingsOnWindowFocused && !overlayVisible) {
      // Show the overlay automatically
      overlayVisible = true;
      isClickthrough = false;
      mainWindow?.setIgnoreMouseEvents(false);
      mainWindow?.setOpacity(1.0);
      mainWindow?.webContents.send('toggle-overlay', true);
      console.log('Window focused, auto-showing settings overlay');
      return;
    }
    
    // When showWindowInTaskbar is enabled, allow window to maintain focus
    // so Alt+F4 and other keyboard shortcuts work
    if (config.showWindowInTaskbar) {
      // Disable clickthrough when focused so we can receive keyboard events
      if (isClickthrough) {
        isClickthrough = false;
        mainWindow?.setIgnoreMouseEvents(false);
        console.log('Window focused (taskbar mode), clickthrough disabled for keyboard input');
      }
      return;
    }
    
    if (!overlayVisible) {
      // Blur immediately if overlay is not visible (non-taskbar mode)
      setTimeout(() => {
        if (mainWindow && !overlayVisible) {
          mainWindow.blur();
        }
      }, 0);
      return;
    }

    // Overlay is visible, disable clickthrough for interaction
    if (isClickthrough && overlayVisible) {
      isClickthrough = false;
      mainWindow?.setIgnoreMouseEvents(false);
      console.log('Window focused, clickthrough disabled');
    }
  });

  // Handle window blur - combined handler for clickthrough and always-on-top
  mainWindow.on('blur', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Enable clickthrough when window loses focus (if overlay not visible)
    if (!overlayVisible && !isClickthrough) {
      isClickthrough = true;
      mainWindow.setIgnoreMouseEvents(true, { forward: true });
      console.log('Window blurred, clickthrough enabled');
    }

    // Keep window on top even when it loses focus
    mainWindow.setAlwaysOnTop(true, 'screen-saver');
  });

  // F12 to toggle DevTools
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

  // Load the renderer HTML
  mainWindow.loadFile(path.join(__dirname, '../src/index.html'));

  // Open DevTools if testing a shader
  if (testShaderPath) {
    mainWindow.webContents.openDevTools();
    console.log('CLI: DevTools opened for testing');
  }

  // Send test shader path when page loads
  mainWindow.webContents.once('did-finish-load', () => {
    if (testShaderPath && mainWindow) {
      const resolvedPath = resolveShaderPath(testShaderPath);
      if (resolvedPath && fs.existsSync(resolvedPath)) {
        console.log('CLI: Sending test shader path to renderer:', resolvedPath);
        mainWindow.webContents.send('load-test-shader', resolvedPath);
      } else {
        console.error('CLI: Shader file not found:', resolvedPath || testShaderPath);
      }
    }
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('Failed to load:', errorCode, errorDescription);
  });

  // Handle close behavior based on taskbar setting
  setupCloseHandler(config.showWindowInTaskbar);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Keep window visible even when "minimized"
  mainWindow.on('minimize', () => {
    mainWindow?.show();
  });

  return mainWindow;
}

/**
 * Resolve a shader path (relative to project root if not absolute).
 */
function resolveShaderPath(shaderPath: string): string | null {
  if (path.isAbsolute(shaderPath)) {
    return shaderPath;
  }
  const projectRoot = getProjectRoot();
  const resolved = path.resolve(projectRoot, shaderPath);
  console.log('CLI: Original path:', shaderPath);
  console.log('CLI: Resolved path:', resolved);
  console.log('CLI: File exists:', fs.existsSync(resolved));
  return resolved;
}

/**
 * Setup the close handler based on taskbar setting.
 */
function setupCloseHandler(showWindowInTaskbar: boolean): void {
  if (!mainWindow) return;

  mainWindow.removeAllListeners('close');

  if (showWindowInTaskbar) {
    // If showing in taskbar, closing window quits the app
    mainWindow.on('close', () => {
      app.quit();
    });
  } else {
    // If not showing in taskbar, hide instead of close
    mainWindow.on('close', (event: Electron.Event) => {
      if (!isAppQuitting) {
        event.preventDefault();
        mainWindow?.hide();
      }
    });
  }
}

/**
 * Toggle the overlay UI visibility.
 */
export function toggleOverlay(): void {
  overlayVisible = !overlayVisible;

  if (mainWindow) {
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }

    // Toggle clickthrough based on overlay visibility
    isClickthrough = !overlayVisible;
    mainWindow.setIgnoreMouseEvents(isClickthrough, { forward: true });

    // Focus/blur based on overlay state
    if (overlayVisible) {
      mainWindow.focus();
      mainWindow.setOpacity(1.0);
    } else {
      mainWindow.blur();
    }

    mainWindow.webContents.send('toggle-overlay', overlayVisible);
  } else {
    createMainWindow(null);
  }
}

/**
 * Toggle clickthrough mode (for debug).
 */
export function toggleClickthrough(): void {
  if (!mainWindow) return;

  if (isClickthrough) {
    mainWindow.setIgnoreMouseEvents(false);
    isClickthrough = false;
    mainWindow.focus();
    console.log('Window focused, clickthrough disabled');
  } else {
    mainWindow.setIgnoreMouseEvents(true, { forward: true });
    isClickthrough = true;
    console.log('Clickthrough enabled, window blurred');
  }
}

/**
 * Show the window.
 */
export function showWindow(): void {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createMainWindow(null);
  }
}

/**
 * Hide the window.
 */
export function hideWindow(): void {
  mainWindow?.hide();
}

/**
 * Handle changing the showWindowInTaskbar setting (requires window recreation).
 */
export function setShowWindowInTaskbar(show: boolean): void {
  const config = getConfig();

  // Prevent unnecessary recreation
  if (config.showWindowInTaskbar === show && mainWindow) {
    return;
  }

  saveConfig({ showWindowInTaskbar: show });

  if (!mainWindow) return;

  // Store current state
  const wasVisible = mainWindow.isVisible();
  const currentOpacity = mainWindow.getOpacity();
  const currentClickthrough = isClickthrough;
  const currentOverlayVisible = overlayVisible;

  // Close old window
  mainWindow.removeAllListeners('close');
  mainWindow.destroy();
  mainWindow = null;

  // Recreate with new taskbar setting
  createMainWindow(null);

  // Restore state
  setTimeout(() => {
    if (!mainWindow) return;

    if (wasVisible) {
      mainWindow.show();
    }
    mainWindow.setOpacity(currentOpacity);
    isClickthrough = currentClickthrough;
    overlayVisible = currentOverlayVisible;
    mainWindow.setIgnoreMouseEvents(isClickthrough, { forward: true });

    if (currentOverlayVisible) {
      mainWindow.webContents.send('toggle-overlay', true);
    }

    setupCloseHandler(show);
  }, 100);
}

/**
 * Register IPC handlers for window operations.
 */
export function registerWindowIpcHandlers(): void {
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
    // Opacity is now applied via CSS to canvas only, not window-level
    // This keeps the overlay UI fully opaque
  });

  ipcMain.handle('set-show-in-taskbar', (_, show: boolean) => {
    setShowWindowInTaskbar(show);
  });
}
