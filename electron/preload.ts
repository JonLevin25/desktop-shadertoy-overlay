import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  getWindowSize: () => ipcRenderer.invoke('get-window-size'),
  setClickthrough: (enabled: boolean) => ipcRenderer.invoke('set-clickthrough', enabled),
  setOpacity: (opacity: number) => ipcRenderer.invoke('set-opacity', opacity),
  exitApp: () => ipcRenderer.invoke('exit-app'),
  setShowInTaskbar: (show: boolean) => ipcRenderer.invoke('set-show-in-taskbar', show),
  getShowInTaskbar: () => ipcRenderer.invoke('get-show-in-taskbar'),
  onToggleOverlay: (callback: (visible: boolean) => void) => {
    ipcRenderer.on('toggle-overlay', (_event, visible) => callback(visible));
  },
});

// Type declaration for TypeScript
declare global {
  interface Window {
    electronAPI: {
      getWindowSize: () => Promise<{ width: number; height: number }>;
      setClickthrough: (enabled: boolean) => Promise<void>;
      setOpacity: (opacity: number) => Promise<void>;
      exitApp: () => Promise<void>;
      setShowInTaskbar: (show: boolean) => Promise<void>;
      getShowInTaskbar: () => Promise<boolean>;
      onToggleOverlay: (callback: (visible: boolean) => void) => void;
    };
  }
}

