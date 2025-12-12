# Transparent Shadertoy Overlay - Implementation Paths

## Overview
Create a transparent overlay that runs Shadertoy shaders fullscreen at configurable opacity.

---

## Option 1: Electron Desktop App (Recommended)

### Pros:
- ✅ Cross-platform (Windows, macOS, Linux)
- ✅ Easy WebGL integration (native browser support)
- ✅ Can use existing Shadertoy shader code with minimal modifications
- ✅ JavaScript/TypeScript ecosystem
- ✅ Good performance for shader rendering
- ✅ Easy to add UI controls for opacity/shader selection

### Cons:
- ❌ Larger app size (~100MB+)
- ❌ Higher memory usage than native apps

### Implementation:
- **Framework**: Electron + TypeScript
- **Rendering**: WebGL via `<canvas>` element
- **Transparency**: Use Electron's `setIgnoreMouseEvents()` and transparent window
- **Shadertoy Compatibility**: Adapt uniforms (iTime, iResolution, iMouse, etc.)
- **Window Management**: Always on top, fullscreen, click-through option

### Key Technologies:
- Electron (v28+)
- WebGL 2.0
- GLSL shader compilation
- Native window transparency APIs

---

## Option 2: Chrome Extension

### Pros:
- ✅ No installation needed (browser-based)
- ✅ Easy distribution via Chrome Web Store
- ✅ Can overlay any webpage
- ✅ WebGL support built-in

### Cons:
- ❌ Limited to Chrome browser
- ❌ More complex overlay implementation (content script + offscreen canvas)
- ❌ Browser security restrictions
- ❌ May interfere with webpage interactions

### Implementation:
- **Type**: Chrome Extension (Manifest V3)
- **Components**:
  - Background service worker
  - Content script for overlay injection
  - Offscreen document for WebGL rendering
- **Overlay Method**: Fixed position `<div>` with canvas, z-index manipulation
- **Transparency**: CSS opacity + pointer-events management

### Key Technologies:
- Chrome Extension API
- OffscreenCanvas API
- WebGL in offscreen context
- Content script injection

---

## Option 3: Native Desktop App (C++/Rust)

### Pros:
- ✅ Best performance
- ✅ Smallest app size
- ✅ Full system control
- ✅ Lowest memory footprint

### Cons:
- ❌ Platform-specific code required
- ❌ More complex development
- ❌ Longer development time
- ❌ Need to port Shadertoy shaders (GLSL → native OpenGL/Vulkan)

### Implementation Options:

#### 3a. C++ with GLFW + OpenGL
- **Framework**: GLFW, OpenGL 3.3+
- **Transparency**: Platform-specific APIs (Windows: WS_EX_LAYERED, macOS: NSWindow alpha)
- **Shaders**: Direct GLSL compilation

#### 3b. Rust with winit + wgpu
- **Framework**: winit (window), wgpu (graphics)
- **Transparency**: Platform-specific window attributes
- **Shaders**: WGSL or GLSL via shaderc

---

## Option 4: Python Desktop App

### Pros:
- ✅ Rapid prototyping
- ✅ Easy to modify
- ✅ Good libraries available

### Cons:
- ❌ Slower performance than native/C++
- ❌ Requires Python runtime
- ❌ Cross-platform transparency is tricky

### Implementation:
- **Framework**: PyQt6/PySide6 or tkinter
- **Rendering**: PyOpenGL or moderngl
- **Transparency**: Platform-specific window flags

---

## Recommendation: Electron Desktop App

### Why Electron?
1. **Shadertoy Compatibility**: Shadertoy shaders are GLSL for WebGL - minimal adaptation needed
2. **Transparency**: Electron supports transparent windows well on all platforms
3. **Development Speed**: Faster to build than native apps
4. **Cross-platform**: One codebase for Windows/macOS/Linux
5. **Performance**: WebGL performance is excellent for shader rendering

### Architecture Overview:

```
┌─────────────────────────────────────┐
│  Electron Main Process              │
│  - Window creation (transparent)    │
│  - Always on top                    │
│  - Click-through toggle             │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Renderer Process (Browser Context) │
│  - WebGL canvas (fullscreen)        │
│  - Shader compilation & execution   │
│  - Uniform updates (iTime, etc.)    │
│  - Opacity control                  │
└─────────────────────────────────────┘
```

### Key Features to Implement:
1. **Shader Management**
   - Load GLSL shaders (from Shadertoy or local files)
   - Parse and adapt Shadertoy uniforms
   - Hot-reload shaders during development

2. **Window Configuration**
   - Transparent background
   - Always on top
   - Fullscreen
   - Click-through mode (optional)
   - Opacity slider (0-100%)

3. **Shadertoy Uniform Mapping**
   - `iTime` → elapsed time since start
   - `iResolution` → window dimensions
   - `iMouse` → mouse position (if not click-through)
   - `iChannel0-3` → texture inputs (optional)

4. **UI Controls** (optional overlay menu)
   - Opacity slider
   - Shader selector
   - Play/pause
   - Click-through toggle

---

## Quick Start: Electron Implementation

### Project Structure:
```
project/
├── package.json
├── tsconfig.json
├── electron/
│   ├── main.ts          # Main process
│   └── preload.ts       # Preload script
├── src/
│   ├── index.html       # Renderer HTML
│   ├── renderer.ts      # Renderer logic
│   ├── shader-loader.ts # Shader management
│   └── webgl-renderer.ts # WebGL rendering
├── shaders/
│   └── example.glsl     # Example shader
└── assets/
```

### Next Steps:
1. Set up Electron project with TypeScript
2. Create transparent, always-on-top window
3. Implement WebGL renderer with shader support
4. Add Shadertoy uniform compatibility
5. Implement opacity control
6. Add shader file loading

---

## Alternative: Chrome Extension (If Browser-Based Preferred)

### Architecture:
- **Background Service Worker**: Manages extension state
- **Content Script**: Injects overlay into pages
- **Offscreen Document**: Renders shaders in WebGL context
- **Options Page**: UI for shader selection and opacity

### Challenges:
- Overlay positioning and z-index management
- Preventing interference with page content
- Performance optimization for continuous rendering

---

## Decision Matrix

| Factor | Electron | Chrome Extension | Native (C++) | Python |
|--------|----------|------------------|--------------|--------|
| **Development Speed** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Cross-Platform** | ⭐⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Shadertoy Compatibility** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐ |
| **App Size** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Transparency Support** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## Recommendation Summary

**Go with Electron Desktop App** if you want:
- Fastest development
- Best Shadertoy compatibility
- Cross-platform support
- Good performance

**Go with Chrome Extension** if you want:
- No installation
- Browser-based distribution
- Overlay on web pages

**Go with Native App** if you want:
- Maximum performance
- Smallest app size
- Full system control

Would you like me to start implementing the Electron desktop app version?

