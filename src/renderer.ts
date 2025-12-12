// WebGL Renderer for Shadertoy shaders
class ShaderRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private startTime: number = 0;
  private lastFrameTime: number = 0;
  private animationFrameId: number = 0;
  private currentShader: string = '';
  private opacity: number = 1.0;
  private resolution: [number, number] = [1920, 1080];
  private dummyTexture: WebGLTexture | null = null;

  constructor(canvas: HTMLCanvasElement) {
    console.log('ShaderRenderer: Initializing...', canvas);
    
    if (!canvas) {
      console.error('ShaderRenderer: Canvas element not found!');
      return;
    }

    const gl = canvas.getContext('webgl2', {
      alpha: true,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      antialias: false, // Disable antialiasing for better performance
      depth: false, // We don't need depth buffer
      stencil: false, // We don't need stencil buffer
    }) as WebGL2RenderingContext | null;

    if (!gl) {
      console.error('ShaderRenderer: WebGL2 not supported, trying WebGL1...');
      const gl1 = canvas.getContext('webgl', {
        alpha: true,
        premultipliedAlpha: false,
        preserveDrawingBuffer: false,
      });
      if (!gl1) {
        throw new Error('WebGL not supported');
      }
      // For MVP, we'll need to adapt for WebGL1, but let's try WebGL2 first
      throw new Error('WebGL2 not supported - please update your graphics drivers');
    }

    console.log('ShaderRenderer: WebGL2 context created successfully');
    this.gl = gl;
    this.startTime = performance.now() / 1000.0;
    this.lastFrameTime = this.startTime;
    this.createDummyTextures();

    // Set up canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initial shader (simple test shader)
    console.log('ShaderRenderer: Loading default shader...');
    this.loadDefaultShader();
    console.log('ShaderRenderer: Starting render loop...');
    this.render();
  }

  private createDummyTextures() {
    if (!this.gl) return;

    // Create a 1x1 black texture for iChannel0-3 (when not used)
    const gl = this.gl;
    this.dummyTexture = gl.createTexture();
    if (!this.dummyTexture) {
      console.error('Failed to create dummy texture');
      return;
    }
    gl.bindTexture(gl.TEXTURE_2D, this.dummyTexture);
    // Create a black pixel
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.bindTexture(gl.TEXTURE_2D, null); // Unbind
    console.log('Dummy textures created');
  }

  private resizeCanvas() {
    if (!this.gl) return;

    const canvas = this.gl.canvas as HTMLCanvasElement;
    const dpr = window.devicePixelRatio || 1;
    
    // Get actual window size
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    
    this.resolution = [canvas.width, canvas.height];
    this.gl.viewport(0, 0, canvas.width, canvas.height);
    
    // Set CSS size
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
  }

  private loadDefaultShader() {
    const defaultShader = `
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = fragCoord / iResolution.xy;
        vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
        fragColor = vec4(col, 1.0);
      }
    `;
    this.loadShader(defaultShader, 'Default Shader');
  }

  async loadShader(shaderCode: string, name: string = 'Custom Shader') {
    if (!this.gl) {
      console.error('loadShader: WebGL context not available');
      return false;
    }

    console.log('Loading shader:', name);
    console.log('Shader code length:', shaderCode.length);

    // Wrap Shadertoy shader code in full shader program
    const fullShader = this.wrapShadertoyShader(shaderCode);

    try {
      const program = this.createShaderProgram(fullShader);
      
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
      
      this.program = program;
      this.currentShader = shaderCode;
      console.log('Shader compiled successfully');
      this.render();
      
      return true;
    } catch (error) {
      console.error('Shader compilation error:', error);
      console.error('Shader name:', name);
      // Log the first 500 chars of shader code for debugging
      console.error('Shader code preview:', shaderCode.substring(0, 500));
      return false;
    }
  }

  private wrapShadertoyShader(shaderCode: string): string {
    // Shadertoy uniforms
    const uniforms = `
      uniform float iTime;
      uniform float iTimeDelta;
      uniform vec3 iResolution;
      uniform vec4 iMouse;
      uniform sampler2D iChannel0;
      uniform sampler2D iChannel1;
      uniform sampler2D iChannel2;
      uniform sampler2D iChannel3;
      uniform vec3 iChannelResolution[4];
    `;

    // Vertex shader (simple fullscreen quad)
    const vertexShader = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader wrapper - apply opacity to alpha channel
    const fragmentShader = `
      precision highp float;
      ${uniforms}
      
      ${shaderCode}
      
      void main() {
        vec4 color;
        mainImage(color, gl_FragCoord.xy);
        // Don't modify alpha here - we'll use CSS opacity instead
        // This works better with Electron's transparent windows on Windows
        gl_FragColor = color;
      }
    `;

    return JSON.stringify({ vertex: vertexShader, fragment: fragmentShader });
  }

  private createShaderProgram(shaderJson: string): WebGLProgram {
    if (!this.gl) throw new Error('WebGL context not available');

    const { vertex, fragment } = JSON.parse(shaderJson);
    const gl = this.gl;

    const vertexShader = this.compileShader(gl.VERTEX_SHADER, vertex);
    const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, fragment);

    const program = gl.createProgram();
    if (!program) throw new Error('Failed to create program');

    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      const info = gl.getProgramInfoLog(program);
      gl.deleteProgram(program);
      throw new Error('Program link error: ' + info);
    }

    // Clean up shaders
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);

    return program;
  }

  private compileShader(type: number, source: string): WebGLShader {
    if (!this.gl) throw new Error('WebGL context not available');

    const shader = this.gl.createShader(type);
    if (!shader) throw new Error('Failed to create shader');

    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      const info = this.gl.getShaderInfoLog(shader);
      const shaderType = type === this.gl.VERTEX_SHADER ? 'VERTEX' : 'FRAGMENT';
      console.error(`${shaderType} SHADER COMPILATION ERROR:`);
      console.error('Info log:', info);
      // Log shader source with line numbers for easier debugging
      const lines = source.split('\n');
      console.error('Shader source (first 50 lines):');
      lines.slice(0, 50).forEach((line, i) => {
        console.error(`${i + 1}: ${line}`);
      });
      this.gl.deleteShader(shader);
      throw new Error(`Shader compilation error (${shaderType}): ${info}`);
    }

    return shader;
  }

  setOpacity(opacity: number) {
    this.opacity = opacity / 100.0;
    // Apply opacity ONLY to the canvas element, not the entire window
    // This way the overlay UI stays fully opaque
    const canvas = this.gl?.canvas as HTMLCanvasElement;
    if (canvas) {
      canvas.style.opacity = this.opacity.toString();
    }
  }

  private render() {
    if (!this.gl || !this.program) return;

    const gl = this.gl;
    const currentTime = performance.now() / 1000.0;
    const time = currentTime - this.startTime;
    const timeDelta = currentTime - this.lastFrameTime;
    this.lastFrameTime = currentTime;

    // Set up fullscreen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = [
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    // Use shader program
    gl.useProgram(this.program);

    // Set up attributes
    const positionLocation = gl.getAttribLocation(this.program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Set uniforms
    const iTimeLocation = gl.getUniformLocation(this.program, 'iTime');
    const iTimeDeltaLocation = gl.getUniformLocation(this.program, 'iTimeDelta');
    const iResolutionLocation = gl.getUniformLocation(this.program, 'iResolution');
    const iMouseLocation = gl.getUniformLocation(this.program, 'iMouse');
    const iChannel0Location = gl.getUniformLocation(this.program, 'iChannel0');
    const iChannel1Location = gl.getUniformLocation(this.program, 'iChannel1');
    const iChannel2Location = gl.getUniformLocation(this.program, 'iChannel2');
    const iChannel3Location = gl.getUniformLocation(this.program, 'iChannel3');
    const iChannelResolutionLocation = gl.getUniformLocation(this.program, 'iChannelResolution');

    if (iTimeLocation !== null) {
      gl.uniform1f(iTimeLocation, time);
    }
    if (iTimeDeltaLocation !== null) {
      gl.uniform1f(iTimeDeltaLocation, timeDelta);
    }
    if (iResolutionLocation !== null) {
      gl.uniform3f(iResolutionLocation, this.resolution[0], this.resolution[1], 1.0);
    }
    if (iMouseLocation !== null) {
      gl.uniform4f(iMouseLocation, 0, 0, 0, 0); // No mouse input for now
    }
    
    // Bind dummy textures for iChannel0-3 (black texture)
    // Only bind if the uniform exists (shader uses it)
    if (this.dummyTexture) {
      if (iChannel0Location !== null) {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.dummyTexture);
        gl.uniform1i(iChannel0Location, 0);
      }
      
      if (iChannel1Location !== null) {
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.dummyTexture);
        gl.uniform1i(iChannel1Location, 1);
      }
      
      if (iChannel2Location !== null) {
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, this.dummyTexture);
        gl.uniform1i(iChannel2Location, 2);
      }
      
      if (iChannel3Location !== null) {
        gl.activeTexture(gl.TEXTURE3);
        gl.bindTexture(gl.TEXTURE_2D, this.dummyTexture);
        gl.uniform1i(iChannel3Location, 3);
      }
    }
    
    // Set iChannelResolution array (all channels default to screen resolution)
    // In WebGL, uniform arrays must be set element by element
    if (iChannelResolutionLocation !== null) {
      const res = [this.resolution[0], this.resolution[1], 1.0];
      for (let i = 0; i < 4; i++) {
        const location = gl.getUniformLocation(this.program, `iChannelResolution[${i}]`);
        if (location !== null) {
          gl.uniform3fv(location, res);
        }
      }
    }

    // Clear with full transparency - critical for transparent windows
    // Must clear to transparent (0,0,0,0) so window compositor can see through
    gl.clearColor(0, 0, 0, 0);
    gl.colorMask(true, true, true, true); // Ensure we're writing to all channels including alpha
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for proper alpha transparency
    gl.enable(gl.BLEND);
    // Use standard alpha blending
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.blendEquation(gl.FUNC_ADD);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // Clean up
    gl.deleteBuffer(positionBuffer);

    // Continue animation
    this.animationFrameId = requestAnimationFrame(() => this.render());
  }

  destroy() {
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.program && this.gl) {
      this.gl.deleteProgram(this.program);
    }
    if (this.dummyTexture && this.gl) {
      this.gl.deleteTexture(this.dummyTexture);
    }
  }
}

// Shader Manager
class ShaderManager {
  private shaders: Map<string, { code: string; name: string; source: 'local' | 'shadertoy' }> = new Map();
  private currentShaderId: string | null = null;
  private renderer: ShaderRenderer;
  private onShaderListChanged: (() => void) | null = null;

  constructor(renderer: ShaderRenderer) {
    this.renderer = renderer;
    this.loadDefaultShaders();
    // Load shaders from directory asynchronously after a short delay
    // to ensure electronAPI is available
    setTimeout(async () => {
      console.log('Attempting to load shaders from directory...');
      console.log('electronAPI available:', !!window.electronAPI);
      console.log('listShaderFiles available:', !!(window.electronAPI && window.electronAPI.listShaderFiles));
      await this.loadShadersFromDirectory();
      this.setupShaderDirectoryWatcher();
      console.log('Total shaders loaded:', this.shaders.size);
      console.log('Shader IDs:', Array.from(this.shaders.keys()));
    }, 500); // Increased delay to ensure electronAPI is ready
  }

  private loadDefaultShaders() {
    // Add some default example shaders
    this.addShader('default', `
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = fragCoord / iResolution.xy;
        vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
        fragColor = vec4(col, 1.0);
      }
    `, 'Default Rainbow', 'local');

    this.addShader('plasma', `
      void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = (fragCoord * 2.0 - iResolution.xy) / iResolution.y;
        float d = length(uv);
        float col = sin(d * 8.0 - iTime * 2.0) * 0.5 + 0.5;
        col += sin(atan(uv.y, uv.x) * 5.0 + iTime) * 0.3;
        fragColor = vec4(col * 0.5, col * 0.7, col, 1.0);
      }
    `, 'Plasma', 'local');

    this.currentShaderId = 'default';
    this.renderer.loadShader(this.shaders.get('default')!.code, 'Default Rainbow');
  }

  addShader(id: string, code: string, name: string, source: 'local' | 'shadertoy') {
    this.shaders.set(id, { code, name, source });
    this.notifyShaderListChanged();
  }

  async loadFromShadertoy(url: string): Promise<boolean> {
    try {
      // Extract shader ID from URL (supports various formats)
      const match = url.match(/shadertoy\.com\/view\/([A-Za-z0-9]+)/);
      if (!match) {
        throw new Error('Invalid Shadertoy URL format. Expected: https://www.shadertoy.com/view/XXXXXX');
      }

      const shaderId = match[1];
      
      // Fetch shader page
      // Note: Shadertoy doesn't have a public API, so we scrape the page
      // This may fail due to CORS or page structure changes
      const response = await fetch(`https://www.shadertoy.com/view/${shaderId}`, {
        mode: 'cors',
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch shader: ${response.status} ${response.statusText}`);
      }
      
      const html = await response.text();
      
      // Try multiple patterns to extract shader code
      // Shadertoy embeds shader data in JSON within script tags
      let shaderCode: string | null = null;
      let shaderName: string = `Shadertoy ${shaderId}`;
      
      // Pattern 1: Look for JSON data in script tag
      const jsonMatch = html.match(/<script[^>]*id="jsonData"[^>]*>(.*?)<\/script>/s);
      if (jsonMatch) {
        try {
          const jsonData = JSON.parse(jsonMatch[1]);
          if (jsonData.Shader && jsonData.Shader.renderpass && jsonData.Shader.renderpass[0]) {
            shaderCode = jsonData.Shader.renderpass[0].code;
            shaderName = jsonData.Shader.info?.name || shaderName;
          }
        } catch (e) {
          console.warn('Failed to parse JSON data:', e);
        }
      }
      
      // Pattern 2: Fallback to regex extraction
      if (!shaderCode) {
        const codeMatch = html.match(/"code"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (codeMatch) {
          shaderCode = codeMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
      
      // Pattern 3: Try to find shader code in various formats
      if (!shaderCode) {
        const altMatch = html.match(/code["\s]*:["\s]*"([^"]*(?:\\.[^"]*)*)"/);
        if (altMatch) {
          shaderCode = altMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
        }
      }
      
      if (!shaderCode) {
        throw new Error('Could not extract shader code from Shadertoy page. The page structure may have changed or the shader may be private.');
      }
      
      // Extract shader name if not already found
      if (shaderName === `Shadertoy ${shaderId}`) {
        const nameMatch = html.match(/"name"\s*:\s*"([^"]+)"/);
        if (nameMatch) {
          shaderName = nameMatch[1];
        }
      }

      this.addShader(`shadertoy-${shaderId}`, shaderCode, shaderName, 'shadertoy');
      return true;
    } catch (error) {
      console.error('Failed to load from Shadertoy:', error);
      return false;
    }
  }

  async loadFromFile(file: File): Promise<boolean> {
    try {
      const code = await file.text();
      const id = `file-${Date.now()}`;
      const name = file.name.replace(/\.[^/.]+$/, '');
      
      this.addShader(id, code, name, 'local');
      return true;
    } catch (error) {
      console.error('Failed to load file:', error);
      return false;
    }
  }

  async loadFromFilePath(filePath: string): Promise<boolean> {
    try {
      if (window.electronAPI && window.electronAPI.readShaderFile) {
        console.log('Loading shader from file path:', filePath);
        const code = await window.electronAPI.readShaderFile(filePath);
        console.log('Shader file read, length:', code.length, 'chars');
        const fileName = filePath.split(/[/\\]/).pop() || 'shader';
        const name = fileName.replace(/\.[^/.]+$/, '');
        const id = `file-${filePath}`;
        
        console.log('Adding shader:', name, 'with ID:', id);
        this.addShader(id, code, name, 'local');
        console.log('Shader added successfully');
        return true;
      }
      console.error('electronAPI.readShaderFile not available');
      return false;
    } catch (error) {
      console.error('Failed to load file from path:', filePath, error);
      return false;
    }
  }

  private async loadShadersFromDirectory() {
    if (!window.electronAPI) {
      console.error('electronAPI not available, cannot load shaders from directory');
      return;
    }
    
    if (!window.electronAPI.listShaderFiles) {
      console.error('listShaderFiles not available');
      return;
    }
    
    try {
      console.log('Calling listShaderFiles...');
      const shaderFiles = await window.electronAPI.listShaderFiles();
      console.log('Found shader files:', shaderFiles);
      const loadedPaths = new Set<string>();
        
        // Track which shaders are from directory
        for (const [id, shader] of this.shaders.entries()) {
          if (id.startsWith('file-') && !id.includes('shadertoy-')) {
            // Check if this shader file still exists
            const filePath = id.replace('file-', '');
            if (!shaderFiles.includes(filePath)) {
              // File was deleted, remove shader
              this.shaders.delete(id);
              if (this.currentShaderId === id) {
                this.currentShaderId = null;
              }
            } else {
              loadedPaths.add(filePath);
            }
          }
        }
        
        // Load new shaders
        let loadedNewShader = false;
        console.log('Loading new shaders, found', shaderFiles.length, 'files');
        for (const filePath of shaderFiles) {
          if (!loadedPaths.has(filePath)) {
            console.log('Loading shader from:', filePath);
            const success = await this.loadFromFilePath(filePath);
            console.log('Load result:', success);
            if (success) {
              loadedNewShader = true;
            }
          } else {
            console.log('Shader already loaded:', filePath);
          }
        }
        
        // Remove deleted shaders
        const removedShader = Array.from(this.shaders.keys()).some(id => {
          if (id.startsWith('file-') && !id.includes('shadertoy-')) {
            const filePath = id.replace('file-', '');
            return !shaderFiles.includes(filePath);
          }
          return false;
        });
        
        if (loadedNewShader || removedShader) {
          this.notifyShaderListChanged();
        }
        
        // Select first shader if none selected
        if (!this.currentShaderId && this.shaders.size > 0) {
          const firstShader = Array.from(this.shaders.keys())[0];
          await this.selectShader(firstShader);
        }
    } catch (error) {
      console.error('Failed to load shaders from directory:', error);
    }
  }

  private setupShaderDirectoryWatcher() {
    if (window.electronAPI && window.electronAPI.onShaderFilesChanged) {
      window.electronAPI.onShaderFilesChanged(async () => {
        // Reload shaders from directory when files change
        await this.loadShadersFromDirectory();
        // Trigger UI update
        if (window.dispatchEvent) {
          window.dispatchEvent(new CustomEvent('shader-list-updated'));
        }
      });
    }
  }

  async selectShader(id: string) {
    const shader = this.shaders.get(id);
    if (shader) {
      this.currentShaderId = id;
      const success = await this.renderer.loadShader(shader.code, shader.name);
      this.notifyShaderListChanged();
      return success;
    }
    console.warn('Shader not found:', id);
    return false;
  }

  getShaders() {
    return Array.from(this.shaders.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      source: data.source,
    }));
  }

  getCurrentShaderId() {
    return this.currentShaderId;
  }

  setOnShaderListChanged(callback: () => void) {
    this.onShaderListChanged = callback;
  }

  private notifyShaderListChanged() {
    if (this.onShaderListChanged) {
      this.onShaderListChanged();
    }
  }
}

// Main application
class App {
  private renderer: ShaderRenderer;
  private shaderManager: ShaderManager;
  private overlayVisible = false;
  private showInTaskbar = false;

  constructor() {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    this.renderer = new ShaderRenderer(canvas);
    this.shaderManager = new ShaderManager(this.renderer);
    
    // Set up callback to update UI when shader list changes
    this.shaderManager.setOnShaderListChanged(() => {
      this.updateShaderList();
    });
    
    this.setupUI();
    this.setupElectronIPC();
    this.loadWindowOptions();
    
    // Show hint initially, hide after 5 seconds
    const hint = document.getElementById('hint');
    if (hint) {
      // Update hint text
      hint.textContent = "Press Ctrl+` to open overlay";
      hint.classList.add('visible');
      setTimeout(() => {
        hint.classList.remove('visible');
      }, 5000);
    }
  }

  private async loadWindowOptions() {
    if (window.electronAPI) {
      // Load saved taskbar preference
      const savedTaskbar = localStorage.getItem('showInTaskbar');
      if (savedTaskbar !== null) {
        this.showInTaskbar = savedTaskbar === 'true';
        await window.electronAPI.setShowInTaskbar(this.showInTaskbar);
      } else {
        this.showInTaskbar = await window.electronAPI.getShowInTaskbar();
      }
      const checkbox = document.getElementById('show-in-taskbar-checkbox') as HTMLInputElement;
      if (checkbox) {
        checkbox.checked = this.showInTaskbar;
      }
    }
  }

  private setupUI() {
    const overlayUI = document.getElementById('overlay-ui')!;
    const opacitySlider = document.getElementById('opacity-slider') as HTMLInputElement;
    const opacityValue = document.getElementById('opacity-value')!;
    const shaderList = document.getElementById('shader-list')!;
    const shadertoyUrlInput = document.getElementById('shadertoy-url') as HTMLInputElement;
    const loadShadertoyBtn = document.getElementById('load-shadertoy-btn')!;
    const shaderFileInput = document.getElementById('shader-file-input') as HTMLInputElement;

    // Load saved opacity
    const savedOpacity = localStorage.getItem('opacity');
    if (savedOpacity !== null) {
      const opacity = parseFloat(savedOpacity);
      opacitySlider.value = opacity.toString();
      opacityValue.textContent = opacity + '%';
      this.renderer.setOpacity(opacity);
    }

    // Opacity control
    opacitySlider.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      opacityValue.textContent = value + '%';
      const opacityNum = parseFloat(value);
      this.renderer.setOpacity(opacityNum);
      // Save to localStorage
      localStorage.setItem('opacity', opacityNum.toString());
    });

    // Show in taskbar checkbox
    const showInTaskbarCheckbox = document.getElementById('show-in-taskbar-checkbox') as HTMLInputElement;
    if (showInTaskbarCheckbox) {
      showInTaskbarCheckbox.addEventListener('change', async (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.showInTaskbar = checked;
        // Save to localStorage
        localStorage.setItem('showInTaskbar', checked.toString());
        if (window.electronAPI) {
          await window.electronAPI.setShowInTaskbar(checked);
        }
      });
    }

    // Exit button
    const exitBtn = document.getElementById('exit-btn');
    if (exitBtn) {
      exitBtn.addEventListener('click', () => {
        if (window.electronAPI) {
          window.electronAPI.exitApp();
        }
      });
    }

    // Load from Shadertoy
    loadShadertoyBtn.addEventListener('click', async () => {
      const url = shadertoyUrlInput.value.trim();
      if (!url) return;

      loadShadertoyBtn.textContent = 'Loading...';
      const success = await this.shaderManager.loadFromShadertoy(url);
      
      if (success) {
        shadertoyUrlInput.value = '';
        this.updateShaderList();
        // Auto-select the newly loaded shader
        const shaders = this.shaderManager.getShaders();
        const newShader = shaders[shaders.length - 1];
        await this.shaderManager.selectShader(newShader.id);
        this.updateShaderList();
      } else {
        alert('Failed to load shader from Shadertoy. Make sure the URL is correct.');
      }
      
      loadShadertoyBtn.textContent = 'Load Shader';
    });

    // Load from file - use Electron dialog
    const loadFileBtn = document.getElementById('load-file-btn');
    if (loadFileBtn) {
      loadFileBtn.addEventListener('click', async () => {
        if (window.electronAPI && window.electronAPI.openShaderFileDialog) {
          const filePath = await window.electronAPI.openShaderFileDialog();
          if (filePath) {
            const success = await this.shaderManager.loadFromFilePath(filePath);
            if (success) {
              this.updateShaderList();
              // Auto-select the newly loaded shader
              const shaders = this.shaderManager.getShaders();
              const newShader = shaders[shaders.length - 1];
              await this.shaderManager.selectShader(newShader.id);
              this.updateShaderList();
            } else {
              alert('Failed to load shader file.');
            }
          }
        }
      });
    }

    // Also support direct file input for compatibility
    shaderFileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const success = await this.shaderManager.loadFromFile(file);
      if (success) {
        this.updateShaderList();
        // Auto-select the newly loaded shader
        const shaders = this.shaderManager.getShaders();
        const newShader = shaders[shaders.length - 1];
        await this.shaderManager.selectShader(newShader.id);
        this.updateShaderList();
      } else {
        alert('Failed to load shader file.');
      }
      
      (e.target as HTMLInputElement).value = '';
    });

    // Initial shader list update
    this.updateShaderList();

    // Listen for shader list updates
    window.addEventListener('shader-list-updated', () => {
      this.updateShaderList();
    });

    // Periodically refresh shader list (fallback if events don't work)
    setInterval(() => {
      if (this.overlayVisible) {
        this.updateShaderList();
      }
    }, 2000);
  }

  private updateShaderList() {
    const shaderList = document.getElementById('shader-list')!;
    const shaders = this.shaderManager.getShaders();
    const currentId = this.shaderManager.getCurrentShaderId();

    console.log('Updating shader list UI. Shaders:', shaders.length, 'Current ID:', currentId);

    shaderList.innerHTML = shaders.map(({ id, name, source }) => {
      const isActive = id === currentId;
      const sourceBadge = source === 'shadertoy' ? '🌐' : '📁';
      // Escape HTML in name to prevent XSS
      const escapedName = name.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `
        <div class="shader-item ${isActive ? 'active' : ''}" data-shader-id="${id}">
          <h3>${sourceBadge} ${escapedName}</h3>
          <p>${source === 'shadertoy' ? 'From Shadertoy' : 'Local file'}</p>
        </div>
      `;
    }).join('');

    // Add click handlers
    shaderList.querySelectorAll('.shader-item').forEach((item) => {
      item.addEventListener('click', async () => {
        const shaderId = (item as HTMLElement).dataset.shaderId;
        if (shaderId) {
          const success = await this.shaderManager.selectShader(shaderId);
          if (success) {
            this.updateShaderList();
          } else {
            console.error('Failed to select shader:', shaderId);
          }
        }
      });
    });
  }

  private setupElectronIPC() {
    if (window.electronAPI) {
      window.electronAPI.onToggleOverlay((visible: boolean) => {
        this.toggleOverlay(visible);
      });
    }
  }

  private toggleOverlay(visible: boolean) {
    this.overlayVisible = visible;
    const overlayUI = document.getElementById('overlay-ui')!;
    
    if (visible) {
      overlayUI.classList.add('visible');
      this.updateShaderList();
    } else {
      overlayUI.classList.remove('visible');
    }
  }
}

// Initialize app when DOM is ready
console.log('Renderer script loaded, DOM ready state:', document.readyState);

function initApp() {
  console.log('Initializing App...');
  try {
    const canvas = document.getElementById('canvas') as HTMLCanvasElement;
    console.log('Canvas element:', canvas);
    if (!canvas) {
      console.error('Canvas element not found in DOM!');
      return;
    }
    new App();
    console.log('App initialized successfully');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

