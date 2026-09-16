'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const coreVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const coreFragmentShader = /* glsl */ `
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
      p = p * 2.05 + vec2(7.3, 11.8);
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec2 p = (vUv - 0.5) * 2.0;
    p.x *= 0.9;

    float r = length(p);
    if (r > 1.0) discard;

    float drift = uTime * 0.002;
    float n = fbm(p * 4.3 + vec2(drift, -drift * 0.55));
    float fine = fbm(p * 9.0 - vec2(drift * 0.4, drift * 0.3));

    float nucleus = exp(-r * r * 13.0);
    float bulge = exp(-r * r * 4.2);
    float rim = exp(-r * 3.4) * (1.0 - smoothstep(0.62, 1.0, r));

    vec3 hot = vec3(1.0, 0.91, 0.74);
    vec3 warm = vec3(0.95, 0.74, 0.52);
    vec3 cool = vec3(0.46, 0.56, 0.78);

    vec3 color = mix(cool, warm, bulge);
    color = mix(color, hot, nucleus * 0.95);
    color *= 0.86 + n * 0.18 + fine * 0.06;

    float alpha = (
      nucleus * 0.34 +
      bulge * 0.24 +
      rim * 0.10
    ) * (0.86 + n * 0.14) * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function GalacticCore({ animate }: { animate: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.62 },
    }),
    [],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
  });

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0.018, 0]}
      scale={[1.12, 0.78, 1]}
      renderOrder={1}
    >
      <planeGeometry args={[5.5, 5.5, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={coreVertexShader}
        fragmentShader={coreFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
