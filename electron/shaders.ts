import { BrowserWindow, ipcMain, dialog } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { getShadersDirectory } from './paths';

let shaderWatcher: fs.FSWatcher | null = null;

/**
 * Ensure the shaders directory exists.
 */
export function ensureShadersDirectory(): void {
  const shadersDir = getShadersDirectory();
  if (!fs.existsSync(shadersDir)) {
    fs.mkdirSync(shadersDir, { recursive: true });
  }
}

/**
 * List all shader files in the shaders directory.
 */
export function listShaderFiles(): string[] {
  try {
    const shadersDir = getShadersDirectory();
    ensureShadersDirectory();

    const files = fs.readdirSync(shadersDir);
    return files
      .filter(file => /\.(glsl|frag|fragment)$/i.test(file))
      .map(file => path.join(shadersDir, file));
  } catch (error) {
    console.error('Failed to list shader files:', error);
    return [];
  }
}

/**
 * Read a shader file's contents.
 */
export function readShaderFile(filePath: string): string {
  try {
    return fs.readFileSync(filePath, 'utf-8');
  } catch (error) {
    console.error('Failed to read shader file:', error);
    throw error;
  }
}

/**
 * Save shader code to a file.
 */
export function saveShaderFile(shaderCode: string, fileName: string): string {
  try {
    ensureShadersDirectory();

    // Sanitize filename
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_') + '.glsl';
    const filePath = path.join(getShadersDirectory(), sanitizedFileName);

    fs.writeFileSync(filePath, shaderCode, 'utf-8');
    return filePath;
  } catch (error) {
    console.error('Failed to save shader file:', error);
    throw error;
  }
}

/**
 * Delete a shader file.
 */
export function deleteShaderFile(filePath: string): boolean {
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
}

/**
 * Setup file watcher for shaders directory.
 * Notifies the main window when shader files change.
 */
export function setupShaderWatcher(getMainWindow: () => BrowserWindow | null): void {
  ensureShadersDirectory();

  // Close existing watcher if any
  if (shaderWatcher) {
    shaderWatcher.close();
  }

  const shadersDir = getShadersDirectory();
  shaderWatcher = fs.watch(shadersDir, (eventType, filename) => {
    if (filename && /\.(glsl|frag|fragment)$/i.test(filename)) {
      const mainWindow = getMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('shader-files-changed');
      }
    }
  });
}

/**
 * Close the shader watcher.
 */
export function closeShaderWatcher(): void {
  if (shaderWatcher) {
    shaderWatcher.close();
    shaderWatcher = null;
  }
}

/**
 * Register IPC handlers for shader operations.
 */
export function registerShaderIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('list-shader-files', () => {
    return listShaderFiles();
  });

  ipcMain.handle('read-shader-file', (_, filePath: string) => {
    return readShaderFile(filePath);
  });

  ipcMain.handle('save-shader-file', async (_, shaderCode: string, fileName: string) => {
    return saveShaderFile(shaderCode, fileName);
  });

  ipcMain.handle('delete-shader-file', async (_, filePath: string) => {
    return deleteShaderFile(filePath);
  });

  ipcMain.handle('open-shader-file-dialog', async () => {
    const mainWindow = getMainWindow();
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
}
