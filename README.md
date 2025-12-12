# Shadertoy Overlay

A transparent, fullscreen overlay application that runs Shadertoy shaders on your desktop. The overlay is clickthrough by default and can be controlled via a hotkey-triggered overlay interface.

## Features

- ✅ **Fullscreen transparent overlay** - Runs shaders over your entire screen
- ✅ **Clickthrough mode** - Doesn't interfere with mouse/keyboard events
- ✅ **Hotkey overlay** - Press `Ctrl+Shift+S` (or `Cmd+Shift+S` on Mac) to open control panel
- ✅ **Shader selection** - Choose from built-in shaders or load your own
- ✅ **Shadertoy integration** - Load shaders directly from Shadertoy URLs
- ✅ **Local file loading** - Load `.glsl`, `.frag`, or `.fragment` files
- ✅ **Opacity control** - Adjust overlay opacity from 0-100%
- ✅ **Shadertoy uniform compatibility** - Supports `iTime`, `iResolution`, `iMouse`

## Installation

1. Install dependencies:
```bash
npm install
```

2. Build the project:
```bash
npm run build
```

3. Start the application:
```bash
npm start
```

## Usage

### Basic Controls

- **`Ctrl+Shift+S`** (or `Cmd+Shift+S` on Mac): Toggle overlay UI
- The overlay is clickthrough by default - it won't capture mouse or keyboard events
- When the overlay UI is open, you can interact with it normally

### Loading Shaders

1. **From Shadertoy:**
   - Press `Ctrl+Shift+S` to open the overlay
   - Paste a Shadertoy URL (e.g., `https://www.shadertoy.com/view/XXXXXX`)
   - Click "Load Shader"

2. **From Local File:**
   - Press `Ctrl+Shift+S` to open the overlay
   - Click "Choose File" and select a `.glsl`, `.frag`, or `.fragment` file
   - The shader will load automatically

3. **Select Existing Shader:**
   - Press `Ctrl+Shift+S` to open the overlay
   - Click on any shader in the list to switch to it

### Adjusting Opacity

- Open the overlay UI (`Ctrl+Shift+S`)
- Use the opacity slider to adjust transparency (0-100%)
- Changes apply immediately

## Shader Format

Shaders should follow Shadertoy's `mainImage` function signature:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    // Your shader code here
    fragColor = vec4(1.0, 0.0, 0.0, 1.0); // Red
}
```

### Available Uniforms

- `iTime` - Elapsed time in seconds (float)
- `iResolution` - Screen resolution (vec3: width, height, aspect)
- `iMouse` - Mouse position (vec4: x, y, clickX, clickY) - currently not implemented

## Development

### Project Structure

```
.
├── electron/          # Electron main process
│   ├── main.ts       # Window creation and IPC
│   └── preload.ts    # Preload script for IPC bridge
├── src/              # Renderer process
│   ├── index.html    # Main HTML
│   └── renderer.ts   # WebGL renderer and UI logic
├── shaders/          # (Optional) Local shader files
└── dist/             # Compiled output
```

### Development Mode

Run in watch mode for development:
```bash
npm run dev
```

This will:
- Watch TypeScript files for changes
- Automatically rebuild on save
- Reload Electron window (manual reload may be needed)

## Known Limitations (MVP)

- ❌ Hot reloading not yet implemented (coming next)
- ❌ Mouse input (`iMouse`) not yet implemented
- ❌ Texture channels (`iChannel0-3`) not yet supported
- ❌ Shadertoy URL loading uses basic scraping (may fail on some shaders)
- ❌ No shader validation/error display in UI

## Troubleshooting

### Overlay doesn't appear
- Make sure the app is running
- Check if another application is blocking the overlay
- Try restarting the app

### Shader doesn't load
- Check browser console (if DevTools are enabled)
- Verify shader code follows Shadertoy format
- For Shadertoy URLs, ensure the URL is correct and accessible

### Hotkey doesn't work
- Make sure no other application is using `Ctrl+Shift+S`
- Try restarting the app
- On some systems, you may need to run with elevated permissions

## Next Steps

- [ ] Hot reloading support
- [ ] Mouse input support (`iMouse`)
- [ ] Texture channel support (`iChannel0-3`)
- [ ] Better Shadertoy API integration
- [ ] Shader error display in UI
- [ ] Shader favorites/presets
- [ ] Multiple shader layers/blending

## License

MIT

