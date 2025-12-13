import { app } from 'electron';
import * as path from 'path';

/**
 * Get the project root directory.
 * In development: the actual project root
 * In production: the app's resource directory
 */
export function getProjectRoot(): string {
  if (app.isPackaged) {
    // In production, __dirname is dist/electron
    return path.join(__dirname, '../../');
  } else {
    // In development, __dirname is dist/electron, go up to project root
    return path.join(__dirname, '../../');
  }
}

/**
 * Get a path within the user data directory (for per-user persistent data).
 */
export function getUserDataPath(filename: string): string {
  return path.join(app.getPath('userData'), filename);
}

/**
 * Resolve a path relative to the dist directory.
 * In development: dist/ folder in project
 * In production: dist/ folder in packaged app
 */
export function getDistPath(relativePath: string): string {
  // __dirname is dist/electron, go up one level to dist/
  return path.join(__dirname, '..', relativePath);
}

/**
 * Get the shaders directory path.
 */
export function getShadersDirectory(): string {
  // Shaders are in dist/shaders (copied during build)
  return getDistPath('shaders');
}

/**
 * Get the config file path.
 * Uses userData in production for per-user settings.
 */
export function getConfigPath(): string {
  if (app.isPackaged) {
    return getUserDataPath('config.json');
  } else {
    return path.join(getProjectRoot(), 'config.json');
  }
}

/**
 * Get the default config file path (bundled with the app).
 */
export function getDefaultConfigPath(): string {
  return getDistPath('config.default.json');
}
