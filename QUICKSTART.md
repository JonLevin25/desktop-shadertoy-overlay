# Quick Start Guide

## Installation & Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Build the project:**
   ```bash
   npm run build
   ```

3. **Run the application:**
   ```bash
   npm start
   ```

## First Run

When you start the app:
1. A transparent overlay will appear fullscreen
2. You'll see a hint in the bottom-right corner (disappears after 5 seconds)
3. Press **`Ctrl+Shift+S`** (or `Cmd+Shift+S` on Mac) to open the control overlay

## Basic Usage

### Opening the Overlay
- Press **`Ctrl+Shift+S`** to toggle the overlay UI
- When overlay is open, you can interact with it normally
- When overlay is closed, the window is clickthrough (mouse events pass through)

### Loading Shaders

**Option 1: Load from Shadertoy**
1. Open overlay (`Ctrl+Shift+S`)
2. Paste a Shadertoy URL: `https://www.shadertoy.com/view/XXXXXX`
3. Click "Load Shader"
4. The shader will appear in your list and load automatically

**Option 2: Load from File**
1. Open overlay (`Ctrl+Shift+S`)
2. Click "Choose File"
3. Select a `.glsl`, `.frag`, or `.fragment` file
4. The shader loads automatically

**Option 3: Use Built-in Shaders**
- Open overlay (`Ctrl+Shift+S`)
- Click on any shader in the list to switch to it
- Built-in shaders include:
  - Default Rainbow
  - Plasma

### Adjusting Opacity

1. Open overlay (`Ctrl+Shift+S`)
2. Use the opacity slider (0-100%)
3. Changes apply immediately

## Example Shader

Try loading `shaders/example-rainbow.glsl` to see a simple animated rainbow effect.

## Shader Format

Your shaders should follow Shadertoy's format:

```glsl
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Your shader code here
    vec3 col = vec3(uv.x, uv.y, 0.5);
    
    fragColor = vec4(col, 1.0);
}
```

### Available Uniforms

- `iTime` - Elapsed time in seconds (float)
- `iResolution` - Screen resolution (vec3: width, height, aspect ratio)
- `iMouse` - Mouse position (vec4) - *Not yet implemented in MVP*

## Troubleshooting

**App doesn't start:**
- Make sure you ran `npm install` and `npm run build`
- Check console for errors

**Overlay doesn't appear:**
- Check if window is minimized or behind other windows
- Try restarting the app

**Hotkey doesn't work:**
- Make sure no other app is using `Ctrl+Shift+S`
- Try restarting the app

**Shader doesn't load:**
- Check browser console (if DevTools enabled)
- Verify shader follows Shadertoy format
- For Shadertoy URLs, ensure URL is correct and shader is public

**Shadertoy loading fails:**
- Some shaders may be private or the page structure may have changed
- Try loading the shader code manually as a file instead

## Development

**Watch mode (auto-rebuild):**
```bash
npm run dev
```

**Manual rebuild:**
```bash
npm run build
```

## Next Steps

After MVP, planned features:
- Hot reloading (auto-reload shaders on file change)
- Mouse input support
- Texture channels
- Better error messages

