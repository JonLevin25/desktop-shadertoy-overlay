import { Tray, Menu, nativeImage } from 'electron';

/**
 * Callbacks for tray menu actions.
 */
export interface TrayCallbacks {
  onShowWindow: () => void;
  onHideWindow: () => void;
  onToggleOverlay: () => void;
  onExit: () => void;
  isWindowVisible: () => boolean;
}

/**
 * Generate a programmatic tray icon with a gradient pattern.
 */
function createTrayIcon(): Electron.NativeImage {
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

  return nativeImage.createFromBuffer(iconData, { width: size, height: size });
}

/**
 * Create the system tray with context menu.
 */
export function createTray(callbacks: TrayCallbacks): Tray {
  const trayIcon = createTrayIcon();
  const tray = new Tray(trayIcon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Window',
      click: callbacks.onShowWindow,
    },
    {
      label: 'Hide Window',
      click: callbacks.onHideWindow,
    },
    {
      label: 'Toggle Overlay UI',
      click: callbacks.onToggleOverlay,
    },
    {
      type: 'separator',
    },
    {
      label: 'Exit',
      click: callbacks.onExit,
    },
  ]);

  tray.setToolTip('Shadertoy Overlay');
  tray.setContextMenu(contextMenu);

  // Single click to toggle window visibility
  tray.on('click', () => {
    if (callbacks.isWindowVisible()) {
      callbacks.onHideWindow();
    } else {
      callbacks.onShowWindow();
    }
  });

  return tray;
}
