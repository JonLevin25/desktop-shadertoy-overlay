// WebGL Renderer for Shadertoy shaders
class ShaderRenderer {
  private gl: WebGL2RenderingContext | null = null;
  private program: WebGLProgram | null = null;
  private startTime: number = 0;
  private animationFrameId: number = 0;
  private currentShader: string = '';
  private opacity: number = 1.0;
  private resolution: [number, number] = [1920, 1080];

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

    // Set up canvas
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());

    // Initial shader (simple test shader)
    console.log('ShaderRenderer: Loading default shader...');
    this.loadDefaultShader();
    console.log('ShaderRenderer: Starting render loop...');
    this.render();
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
    if (!this.gl) return;

    // Wrap Shadertoy shader code in full shader program
    const fullShader = this.wrapShadertoyShader(shaderCode);

    try {
      const program = this.createShaderProgram(fullShader);
      
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
      
      this.program = program;
      this.currentShader = shaderCode;
      this.render();
      
      return true;
    } catch (error) {
      console.error('Shader compilation error:', error);
      return false;
    }
  }

  private wrapShadertoyShader(shaderCode: string): string {
    // Shadertoy uniforms
    const uniforms = `
      uniform float iTime;
      uniform vec3 iResolution;
      uniform vec4 iMouse;
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
      this.gl.deleteShader(shader);
      throw new Error('Shader compilation error: ' + info);
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
    const time = performance.now() / 1000.0 - this.startTime;

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
    const iResolutionLocation = gl.getUniformLocation(this.program, 'iResolution');
    const iMouseLocation = gl.getUniformLocation(this.program, 'iMouse');
    const iOpacityLocation = gl.getUniformLocation(this.program, 'iOpacity');

    if (iTimeLocation !== null) {
      gl.uniform1f(iTimeLocation, time);
    }
    if (iResolutionLocation !== null) {
      gl.uniform3f(iResolutionLocation, this.resolution[0], this.resolution[1], 1.0);
    }
    if (iMouseLocation !== null) {
      gl.uniform4f(iMouseLocation, 0, 0, 0, 0); // No mouse input for now
    }
    // Don't use iOpacity uniform anymore - we use CSS opacity instead
    // if (iOpacityLocation !== null) {
    //   gl.uniform1f(iOpacityLocation, this.opacity);
    // }

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
  }
}

// Shader Manager
class ShaderManager {
  private shaders: Map<string, { code: string; name: string; source: 'local' | 'shadertoy' }> = new Map();
  private currentShaderId: string | null = null;
  private renderer: ShaderRenderer;

  constructor(renderer: ShaderRenderer) {
    this.renderer = renderer;
    this.loadDefaultShaders();
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

  selectShader(id: string) {
    const shader = this.shaders.get(id);
    if (shader) {
      this.currentShaderId = id;
      this.renderer.loadShader(shader.code, shader.name);
      return true;
    }
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
    
    this.setupUI();
    this.setupElectronIPC();
    this.loadWindowOptions();
    
    // Show hint initially, hide after 5 seconds
    const hint = document.getElementById('hint');
    if (hint) {
      hint.classList.add('visible');
      setTimeout(() => {
        hint.classList.remove('visible');
      }, 5000);
    }
  }

  private async loadWindowOptions() {
    if (window.electronAPI) {
      this.showInTaskbar = await window.electronAPI.getShowInTaskbar();
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

    // Opacity control
    opacitySlider.addEventListener('input', (e) => {
      const value = (e.target as HTMLInputElement).value;
      opacityValue.textContent = value + '%';
      this.renderer.setOpacity(parseFloat(value));
    });

    // Show in taskbar checkbox
    const showInTaskbarCheckbox = document.getElementById('show-in-taskbar-checkbox') as HTMLInputElement;
    if (showInTaskbarCheckbox) {
      showInTaskbarCheckbox.addEventListener('change', async (e) => {
        const checked = (e.target as HTMLInputElement).checked;
        this.showInTaskbar = checked;
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
        this.shaderManager.selectShader(newShader.id);
        this.updateShaderList();
      } else {
        alert('Failed to load shader from Shadertoy. Make sure the URL is correct.');
      }
      
      loadShadertoyBtn.textContent = 'Load Shader';
    });

    // Load from file
    shaderFileInput.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const success = await this.shaderManager.loadFromFile(file);
      if (success) {
        this.updateShaderList();
        // Auto-select the newly loaded shader
        const shaders = this.shaderManager.getShaders();
        const newShader = shaders[shaders.length - 1];
        this.shaderManager.selectShader(newShader.id);
        this.updateShaderList();
      } else {
        alert('Failed to load shader file.');
      }
      
      (e.target as HTMLInputElement).value = '';
    });

    // Initial shader list update
    this.updateShaderList();
  }

  private updateShaderList() {
    const shaderList = document.getElementById('shader-list')!;
    const shaders = this.shaderManager.getShaders();
    const currentId = this.shaderManager.getCurrentShaderId();

    shaderList.innerHTML = shaders.map(({ id, name, source }) => {
      const isActive = id === currentId;
      const sourceBadge = source === 'shadertoy' ? '🌐' : '📁';
      return `
        <div class="shader-item ${isActive ? 'active' : ''}" data-shader-id="${id}">
          <h3>${sourceBadge} ${name}</h3>
          <p>${source === 'shadertoy' ? 'From Shadertoy' : 'Local file'}</p>
        </div>
      `;
    }).join('');

    // Add click handlers
    shaderList.querySelectorAll('.shader-item').forEach((item) => {
      item.addEventListener('click', () => {
        const shaderId = (item as HTMLElement).dataset.shaderId;
        if (shaderId) {
          this.shaderManager.selectShader(shaderId);
          this.updateShaderList();
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

