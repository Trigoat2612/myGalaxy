export const galaxyVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uPointSize;

  attribute vec3 color;
  attribute float aScale;
  attribute float aPhase;
  attribute float aRadius;
  attribute float aOpacity;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vOpacity;

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
      aScale * uPointSize * uPixelRatio * perspective * twinkle
    );

    vColor = color;
    vTwinkle = twinkle;
    vOpacity = aOpacity;
  }
`;

export const galaxyFragmentShader = /* glsl */ `
  uniform float uOpacity;
  uniform float uDust;

  varying vec3 vColor;
  varying float vTwinkle;
  varying float vOpacity;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);

    if (distanceToCenter > 0.5) discard;

    float core = 1.0 - smoothstep(0.0, 0.082, distanceToCenter);
    float midGlow = 1.0 - smoothstep(0.02, 0.24, distanceToCenter);
    float halo = 1.0 - smoothstep(0.16, 0.5, distanceToCenter);

    float alpha = (halo * 0.28 + midGlow * 0.4 + core * 0.5) * uOpacity * vOpacity;
    vec3 finalColor = vColor * (0.94 + core * 0.65 + midGlow * 0.1) * (0.97 + vTwinkle * 0.03);

    if (uDust > 0.5) {
      alpha *= 0.5;
      finalColor *= vec3(0.40, 0.36, 0.42);
    }

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
    float dustLane = dustNoise * smoothstep(0.20, 0.38, r) * (1.0 - smoothstep(0.90, 1.0, r)) * 0.12;

    vec3 warmCore = vec3(1.0, 0.86, 0.68);
    vec3 coolInner = vec3(0.61, 0.71, 0.92);
    vec3 coolOuter = vec3(0.12, 0.17, 0.32);

    vec3 color = mix(coolOuter, coolInner, clamp(1.0 - r, 0.0, 1.0));
    color = mix(color, warmCore, core * 0.9 + innerGlow * 0.2);
    color *= 0.78 + grain * 0.08 + arms * 0.02 + softFill * 0.03 + broadFill * 0.025 + veil * 0.03;
    color *= 1.0 - dustLane * 0.06;

    float alpha = (
      disk * 0.11 +
      core * 0.15 +
      innerGlow * 0.08 +
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

  attribute float aScale;
  attribute float aPhase;

  varying float vTwinkle;

  void main() {
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;

    float twinkle = 0.8 + 0.2 * sin(uTime * (0.25 + aPhase * 0.014) + aPhase);
    float perspective = clamp(28.0 / max(1.0, -mvPosition.z), 0.22, 1.8);

    gl_PointSize = max(0.9, aScale * uPointSize * uPixelRatio * perspective);
    vTwinkle = twinkle;
  }
`;

export const starFieldFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;

  varying float vTwinkle;

  void main() {
    vec2 point = gl_PointCoord - 0.5;
    float distanceToCenter = length(point);

    if (distanceToCenter > 0.5) discard;

    float glow = 1.0 - smoothstep(0.16, 0.5, distanceToCenter);
    float core = 1.0 - smoothstep(0.0, 0.09, distanceToCenter);
    float alpha = (glow * 0.42 + core * 0.24) * uOpacity * (0.84 + vTwinkle * 0.16);

    gl_FragColor = vec4(uColor * (0.82 + core * 0.34), alpha);
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
    color = mix(color, mutedViolet, wisps * 0.18);

    float alpha = (cloud * 0.14 + wisps * 0.035) * equator * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;
