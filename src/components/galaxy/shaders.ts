export const galaxyVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPointSize;
  uniform float uZoomDetail;

  attribute vec3 color;
  attribute float aScale;
  attribute float aPhase;
  attribute float aRadius;
  attribute float aOpacity;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vOpacity;
  varying float vScale;

  void main() {
    vec3 transformed = position;

    // Rotación diferencial: el núcleo avanza más rápido y el disco exterior
    // conserva una deriva lenta. No mueve estrellas una por una en CPU.
    float normalizedRadius = clamp(aRadius / 14.5, 0.0, 1.0);
    float speed = mix(0.020, 0.0038, smoothstep(0.05, 1.0, normalizedRadius));
    speed *= 0.94 + 0.06 * sin(aPhase * 1.7);
    float angle = uTime * speed;
    float c = cos(angle);
    float s = sin(angle);

    transformed.xz = mat2(c, -s, s, c) * transformed.xz;
    transformed.y += sin(uTime * 0.14 + aPhase + aRadius * 0.3) * 0.004;

    vec4 mvPosition = modelViewMatrix * vec4(transformed, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float twinkle = 0.9 + 0.1 * sin(uTime * (0.34 + aPhase * 0.012) + aPhase);
    float perspective = clamp(30.0 / max(1.0, -mvPosition.z), 0.34, 2.4);

    gl_PointSize = max(
      0.9,
      aScale * uPointSize * uPixelRatio * perspective * twinkle * mix(1.0, 0.58, uZoomDetail)
    );

    vColor = color;
    vTwinkle = twinkle;
    vOpacity = aOpacity;
    vScale = aScale;
  }
`;

export const galaxyFragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uDust;
  uniform float uZoomDetail;
  uniform float uBrightness;
  uniform float uSaturation;
  uniform float uWarmth;
  uniform float uBloomBoost;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vOpacity;
  varying float vScale;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);

    if (distanceToCenter > 0.5) discard;

    float coreEdge = mix(0.082, 0.044, uZoomDetail);
    float midEdge = mix(0.24, 0.16, uZoomDetail);
    float haloStart = mix(0.16, 0.23, uZoomDetail);

    float core = 1.0 - smoothstep(0.0, coreEdge, distanceToCenter);
    float midGlow = 1.0 - smoothstep(0.02, midEdge, distanceToCenter);
    float halo = 1.0 - smoothstep(haloStart, 0.5, distanceToCenter);

    float haloWeight = mix(0.28, 0.08, uZoomDetail);
    float midWeight = mix(0.40, 0.24, uZoomDetail);
    float coreWeight = mix(0.50, 0.76, uZoomDetail);

    float scaleMask = clamp((vScale - 0.75) / 0.95, 0.0, 1.0);
    float selectiveBloom = halo * scaleMask * mix(0.12, 0.24, uZoomDetail) * uBloomBoost;
    float alpha = (halo * haloWeight + midGlow * midWeight + core * coreWeight + selectiveBloom) * uOpacity * vOpacity;
    vec3 finalColor = vColor *
      (0.94 + core * mix(0.65, 1.06, uZoomDetail) + midGlow * 0.08 + selectiveBloom * 0.42) *
      (0.97 + vTwinkle * 0.03);

    if (uDust > 0.5) {
      alpha *= 0.5;
      finalColor *= vec3(0.40, 0.36, 0.42);
    }

    float luminance = dot(finalColor, vec3(0.2126, 0.7152, 0.0722));
    finalColor = mix(vec3(luminance), finalColor, uSaturation);
    finalColor = mix(finalColor, finalColor * vec3(1.07, 0.995, 0.94), uWarmth);
    finalColor *= uBrightness;

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export const galaxyDiscVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const galaxyDiscFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uCoreContrast;
  uniform float uBrightness;
  uniform float uSaturation;
  uniform float uWarmth;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(9.7, 17.3);
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    vec2 q = vec2(p.x / 1.2, p.y / 0.72);
    float r = length(q);

    if (r > 1.0) discard;

    float angle = atan(q.y, q.x);
    float grain = fbm(q * 4.0 + vec2(uTime * 0.0013, -uTime * 0.0009));
    float grain2 = fbm(q * 7.0 - vec2(uTime * 0.0006, uTime * 0.0004));
    float grain3 = fbm(q * 10.0 + vec2(-uTime * 0.00025, uTime * 0.0002));

    float edge = 1.0 - smoothstep(0.84, 1.02, r);
    float disk = exp(-r * 2.0) * edge;
    float core = exp(-r * r * 14.5);
    float innerGlow = exp(-r * r * 5.2) * 0.6;
    float halo = exp(-pow(max(r - 0.58, 0.0), 2.0) * 4.8) * 0.3;
    float softFill = exp(-pow(max(r - 0.34, 0.0), 2.0) * 1.45) * edge;
    float broadFill = exp(-pow(max(r - 0.52, 0.0), 2.0) * 0.82) * edge;
    float veil = exp(-pow(max(r - 0.60, 0.0), 2.0) * 0.45) * edge;
    float powder = smoothstep(0.12, 0.98, 1.0 - r) * (0.50 + grain * 0.22);

    float spiralWave = 0.5 + 0.5 * sin(angle * 2.0 - r * 13.5 + grain * 1.05);
    float arms = smoothstep(0.56, 0.9, spiralWave) * exp(-r * 1.15) * edge;

    float dustNoise = smoothstep(0.68, 0.88, grain2 * 0.58 + grain3 * 0.42);
    float dustLane = dustNoise * smoothstep(0.20, 0.38, r) * (1.0 - smoothstep(0.90, 1.0, r)) * mix(0.12, 0.18, uCoreContrast);

    vec3 warmCore = vec3(1.0, 0.86, 0.68);
    vec3 coolInner = vec3(0.61, 0.71, 0.92);
    vec3 coolOuter = vec3(0.12, 0.17, 0.32);

    vec3 color = mix(coolOuter, coolInner, clamp(1.0 - r, 0.0, 1.0));
    color = mix(color, warmCore, core * 0.9 + innerGlow * 0.2);
    color *= 0.78 + grain * 0.08 + arms * 0.02 + softFill * 0.03 + broadFill * 0.025 + veil * 0.03;
    color = mix(color * 0.95, color * 1.08, uCoreContrast * (core * 0.55 + innerGlow * 0.2));
    color *= 1.0 - dustLane * 0.06;
    float discLuminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(discLuminance), color, uSaturation);
    color = mix(color, color * vec3(1.06, 0.995, 0.95), uWarmth);
    color *= uBrightness;

    float alpha = (
      disk * 0.11 +
      core * mix(0.15, 0.18, uCoreContrast) +
      innerGlow * mix(0.08, 0.10, uCoreContrast) +
      halo * 0.06 +
      arms * 0.006 +
      softFill * 0.14 +
      broadFill * 0.11 +
      veil * 0.12 +
      powder * 0.09
    ) * (1.0 - dustLane * 0.06) * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

export const starFieldVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPointSize;
  uniform float uZoomDetail;

  attribute float aScale;
  attribute float aPhase;

  varying float vTwinkle;
  varying float vZoomDetail;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float twinkle = 0.84 + 0.16 * sin(uTime * (0.25 + aPhase * 0.014) + aPhase);
    float perspective = clamp(28.0 / max(1.0, -mvPosition.z), 0.22, 1.8);
    float sharpnessScale = mix(1.0, 0.62, uZoomDetail);

    gl_PointSize = max(0.85, aScale * uPointSize * uPixelRatio * perspective * sharpnessScale);
    vTwinkle = twinkle;
    vZoomDetail = uZoomDetail;
  }
`;

export const starFieldFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vTwinkle;
  varying float vZoomDetail;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);

    if (distanceToCenter > 0.5) discard;

    float coreEdge = mix(0.09, 0.05, vZoomDetail);
    float glowEdge = mix(0.18, 0.12, vZoomDetail);
    float haloStart = mix(0.14, 0.21, vZoomDetail);

    float core = 1.0 - smoothstep(0.0, coreEdge, distanceToCenter);
    float glow = 1.0 - smoothstep(0.0, glowEdge, distanceToCenter);
    float halo = 1.0 - smoothstep(haloStart, 0.5, distanceToCenter);

    float alpha = (
      halo * mix(0.30, 0.10, vZoomDetail) +
      glow * mix(0.32, 0.22, vZoomDetail) +
      core * mix(0.28, 0.60, vZoomDetail)
    ) * uOpacity * (0.86 + vTwinkle * 0.14);

    vec3 finalColor = uColor * (0.82 + core * mix(0.28, 0.52, vZoomDetail));
    gl_FragColor = vec4(finalColor, alpha);
  }
`;

export const nebulaVertexShader = /* glsl */ `
  varying vec3 vDirection;

  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

export const nebulaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uBrightness;
  uniform float uSaturation;
  uniform float uTint;

  varying vec3 vDirection;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec2(17.1, 9.2);
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec3 direction = normalize(vDirection);
    float drift = uTime * 0.0025;

    vec2 layerA = direction.xy * 3.0 + vec2(drift, -drift * 0.25);
    vec2 layerB = direction.zy * 4.4 + vec2(-drift * 0.45, drift * 0.16);

    float cloudA = fbm(layerA);
    float cloudB = fbm(layerB + cloudA * 0.62);
    float cloud = smoothstep(0.56, 0.88, cloudA * 0.46 + cloudB * 0.58);

    float equator = pow(max(0.0, 1.0 - abs(direction.y)), 3.0);
    float wisps = smoothstep(0.68, 0.9, fbm(layerA * 1.55 + cloudB));

    vec3 deepBlue = vec3(0.022, 0.04, 0.095);
    vec3 mutedBlue = vec3(0.075, 0.11, 0.22);
    vec3 mutedViolet = vec3(0.105, 0.075, 0.16);

    vec3 color = mix(deepBlue, mutedBlue, cloudB);
    color = mix(color, mutedViolet, wisps * (0.18 + uTint * 0.32));

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, uSaturation);
    color *= uBrightness;

    float alpha = (cloud * 0.14 + wisps * 0.035) * equator * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;
