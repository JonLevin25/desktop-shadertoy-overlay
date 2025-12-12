// Example Shadertoy-compatible shader
// Simple animated rainbow effect

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    
    // Create animated rainbow colors
    vec3 col = 0.5 + 0.5 * cos(iTime + uv.xyx + vec3(0, 2, 4));
    
    // Add some movement
    float wave = sin(uv.x * 10.0 + iTime) * 0.1;
    col += wave;
    
    fragColor = vec4(col, 1.0);
}

