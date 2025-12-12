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
  listShaderFiles: () => ipcRenderer.invoke('list-shader-files'),
  readShaderFile: (filePath: string) => ipcRenderer.invoke('read-shader-file', filePath),
  openShaderFileDialog: () => ipcRenderer.invoke('open-shader-file-dialog'),
  onShaderFilesChanged: (callback: () => void) => {
    ipcRenderer.on('shader-files-changed', () => callback());
  },
  onLoadTestShader: (callback: (filePath: string) => void) => {
    ipcRenderer.on('load-test-shader', (_event, filePath) => callback(filePath));
  },
  fetchShadertoyShader: (url: string) => ipcRenderer.invoke('fetch-shadertoy-shader', url),
  saveShaderFile: (code: string, fileName: string) => ipcRenderer.invoke('save-shader-file', code, fileName),
  deleteShaderFile: (filePath: string) => ipcRenderer.invoke('delete-shader-file', filePath),
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
      listShaderFiles: () => Promise<string[]>;
      readShaderFile: (filePath: string) => Promise<string>;
      openShaderFileDialog: () => Promise<string | null>;
      onShaderFilesChanged: (callback: () => void) => void;
      onLoadTestShader: (callback: (filePath: string) => void) => void;
      fetchShadertoyShader: (url: string) => Promise<{ code: string; name: string }>;
      saveShaderFile: (code: string, fileName: string) => Promise<string>;
      deleteShaderFile: (filePath: string) => Promise<boolean>;
    };
  }
}

