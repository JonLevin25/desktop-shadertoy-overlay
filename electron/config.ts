import { ipcMain } from 'electron';
import * as fs from 'fs';
import { getConfigPath, getDefaultConfigPath } from './paths';

/**
 * Application configuration structure.
 */
export interface AppConfig {
  opacityPercent: number;
  timeScale: number;
  frameRate: number | null;
  /** Whether to show the overlay window in the taskbar/alt-tab (not the tray icon) */
  showWindowInTaskbar: boolean;
}

const DEFAULT_CONFIG: AppConfig = {
  opacityPercent: 10,
  timeScale: 1.0,
  frameRate: null,
  showWindowInTaskbar: false,
};

// Cached config instance
let cachedConfig: AppConfig | null = null;

/**
 * Load configuration from file, creating default if needed.
 */
export function loadConfig(): AppConfig {
  const configPath = getConfigPath();
  const defaultConfigPath = getDefaultConfigPath();

  try {
    // If config.json doesn't exist, try to copy from config.default.json
    if (!fs.existsSync(configPath)) {
      if (fs.existsSync(defaultConfigPath)) {
        try {
          fs.copyFileSync(defaultConfigPath, configPath);
          console.log('Copied config.default.json to config.json');
        } catch (error) {
          console.error('Failed to copy default config:', error);
        }
      }
    }

    // Load config if it exists
    if (fs.existsSync(configPath)) {
      const configData = fs.readFileSync(configPath, 'utf-8');
      const fileConfig = JSON.parse(configData);
      
      // Handle migration from old 'showInTaskbar' to 'showWindowInTaskbar'
      if ('showInTaskbar' in fileConfig && !('showWindowInTaskbar' in fileConfig)) {
        fileConfig.showWindowInTaskbar = fileConfig.showInTaskbar;
        delete fileConfig.showInTaskbar;
      }
      
      const mergedConfig: AppConfig = { ...DEFAULT_CONFIG, ...fileConfig };
      cachedConfig = mergedConfig;
      return mergedConfig;
    }
  } catch (error) {
    console.error('Failed to load config:', error);
  }

  // Return defaults and create config file if copying failed
  try {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to create default config:', error);
  }

  cachedConfig = { ...DEFAULT_CONFIG };
  return cachedConfig;
}

/**
 * Get the current config (uses cache if available).
 */
export function getConfig(): AppConfig {
  if (!cachedConfig) {
    return loadConfig();
  }
  return cachedConfig;
}

/**
 * Save configuration updates to file.
 */
export function saveConfig(updates: Partial<AppConfig>): void {
  const configPath = getConfigPath();
  const currentConfig = getConfig();
  const updatedConfig = { ...currentConfig, ...updates };

  try {
    fs.writeFileSync(configPath, JSON.stringify(updatedConfig, null, 2), 'utf-8');
    cachedConfig = updatedConfig;
  } catch (error) {
    console.error('Failed to save config:', error);
    throw error;
  }
}

/**
 * Update a single config value.
 */
export function updateConfig<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
  saveConfig({ [key]: value } as Partial<AppConfig>);
}

/**
 * Register IPC handlers for config operations.
 */
export function registerConfigIpcHandlers(): void {
  ipcMain.handle('get-config', () => {
    return getConfig();
  });

  ipcMain.handle('update-config', (_, updates: Partial<AppConfig>) => {
    saveConfig(updates);
    return getConfig();
  });

  ipcMain.handle('get-show-in-taskbar', () => {
    return getConfig().showWindowInTaskbar;
  });
}
