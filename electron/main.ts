import { app, BrowserWindow, ipcMain, Tray } from 'electron';

// Import modules
import { parseCliArgs } from './cli';
import { loadConfig, registerConfigIpcHandlers } from './config';
import {
  createMainWindow,
  getMainWindow,
  isWindowVisible,
  toggleOverlay,
  toggleClickthrough,
  showWindow,
  hideWindow,
  registerWindowIpcHandlers,
  setAppQuitting,
} from './window';
import { createTray } from './tray';
import { registerGlobalShortcuts, unregisterAllShortcuts } from './shortcuts';
import { setupShaderWatcher, closeShaderWatcher, registerShaderIpcHandlers } from './shaders';

// App state
let tray: Tray | null = null;

// Track if app is quitting (for clean shutdown)
let appIsQuitting = false;

/**
 * Exit the application.
 */
function exitApp(): void {
  appIsQuitting = true;
  setAppQuitting(true);
  app.quit();
}

/**
 * Register app-level IPC handlers.
 */
function registerAppIpcHandlers(): void {
  ipcMain.handle('exit-app', () => {
    exitApp();
  });
}

// App lifecycle events
app.on('window-all-closed', () => {
  // Don't quit on window close - keep tray icon running
  if (appIsQuitting) {
    app.quit();
  }
});

app.on('will-quit', () => {
  unregisterAllShortcuts();
  closeShaderWatcher();
  if (tray) {
    tray.destroy();
    tray = null;
  }
});

// Initialize app when ready
app.whenReady().then(() => {
  // Parse CLI arguments
  const cliOptions = parseCliArgs();

  // Load configuration
  loadConfig();

  // Create main window
  createMainWindow(cliOptions.testShaderPath);

  // Register IPC handlers
  registerAppIpcHandlers();
  registerConfigIpcHandlers();
  registerWindowIpcHandlers();
  registerShaderIpcHandlers(getMainWindow);

  // Register global shortcuts
  registerGlobalShortcuts({
    onToggleOverlay: toggleOverlay,
    onToggleClickthrough: toggleClickthrough,
  });

  // Create system tray
  tray = createTray({
    onShowWindow: showWindow,
    onHideWindow: hideWindow,
    onToggleOverlay: toggleOverlay,
    onExit: exitApp,
    isWindowVisible,
  });

  // Setup shader file watcher
  setupShaderWatcher(getMainWindow);

  // macOS: re-create window on activate
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(null);
    }
  });
});
