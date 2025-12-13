import { globalShortcut } from 'electron';

/**
 * Callbacks for global shortcut actions.
 */
export interface ShortcutCallbacks {
  onToggleOverlay: () => void;
  onToggleClickthrough: () => void;
}

/**
 * Get the platform-specific shortcut key combination.
 */
function getPlatformShortcut(macShortcut: string, defaultShortcut: string): string {
  return process.platform === 'darwin' ? macShortcut : defaultShortcut;
}

/**
 * Register all global shortcuts.
 */
export function registerGlobalShortcuts(callbacks: ShortcutCallbacks): void {
  // Toggle overlay: Ctrl+` (Cmd+` on Mac)
  const toggleOverlayShortcut = getPlatformShortcut('Command+`', 'Ctrl+`');
  const toggleResult = globalShortcut.register(toggleOverlayShortcut, callbacks.onToggleOverlay);

  if (!toggleResult) {
    console.log('Global shortcut registration failed for:', toggleOverlayShortcut);
  } else {
    console.log('Global shortcut registered:', toggleOverlayShortcut);
  }

  // Toggle clickthrough/debug: Ctrl+Shift+D (Cmd+Shift+D on Mac)
  const clickthroughShortcut = getPlatformShortcut('Command+Shift+D', 'Ctrl+Shift+D');
  const clickthroughResult = globalShortcut.register(clickthroughShortcut, callbacks.onToggleClickthrough);

  if (!clickthroughResult) {
    console.log('Focus shortcut registration failed for:', clickthroughShortcut);
  } else {
    console.log('Focus shortcut registered:', clickthroughShortcut);
  }
}

/**
 * Unregister all global shortcuts.
 */
export function unregisterAllShortcuts(): void {
  globalShortcut.unregisterAll();
}
