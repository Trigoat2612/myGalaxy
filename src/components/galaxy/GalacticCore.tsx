'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import type { InteractionState } from './InteractionController';
import type { GalaxyVisualProfileSettings } from './visualProfiles';

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
  uniform float uZoomDetail;
  uniform float uSelectiveBloom;
  uniform float uLocalContrast;
  uniform float uBrightness;
  uniform float uSaturation;
  uniform float uWarmth;
  uniform float uCoreBloomBoost;

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

    float nucleus = exp(-r * r * mix(13.0, 18.0, uZoomDetail));
    float bulge = exp(-r * r * mix(4.2, 5.2, uLocalContrast));
    float rim = exp(-r * 3.4) * (1.0 - smoothstep(0.62, 1.0, r));
    float selectiveBloom = exp(-pow(max(r - 0.06, 0.0), 2.0) * mix(5.6, 8.8, uSelectiveBloom)) * 0.34 * uCoreBloomBoost;
    float outerBloom = exp(-pow(max(r - 0.22, 0.0), 2.0) * 2.8) * 0.18 * mix(0.95, 1.08, uCoreBloomBoost - 0.84);

    vec3 hot = vec3(1.0, 0.91, 0.74);
    vec3 warm = vec3(0.95, 0.74, 0.52);
    vec3 cool = vec3(0.46, 0.56, 0.78);

    vec3 color = mix(cool, warm, bulge);
    color = mix(color, hot, nucleus * 0.95);
    color *= 0.84 + n * 0.16 + fine * 0.06;
    color += hot * selectiveBloom * 0.58;
    color += warm * outerBloom * 0.16;

    float luminance = dot(color, vec3(0.2126, 0.7152, 0.0722));
    color = mix(vec3(luminance), color, uSaturation);
    color = mix(color, color * vec3(1.07, 0.995, 0.94), uWarmth);
    color = mix(color * 0.96, color * 1.10, uLocalContrast * 0.45);
    color *= uBrightness;

    float alpha = (
      nucleus * 0.36 +
      bulge * 0.25 +
      rim * 0.10 +
      selectiveBloom * 0.24 +
      outerBloom * 0.12
    ) * (0.86 + n * 0.14) * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

export default function GalacticCore({
  animate,
  interactionRef,
  visualProfile,
}: {
  animate: boolean;
  interactionRef: RefObject<InteractionState>;
  visualProfile: GalaxyVisualProfileSettings;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.62 },
      uZoomDetail: { value: 0 },
      uSelectiveBloom: { value: 0.28 },
      uLocalContrast: { value: 0.28 },
      uBrightness: { value: visualProfile.coreBrightness },
      uSaturation: { value: visualProfile.coreSaturation },
      uWarmth: { value: visualProfile.coreWarmth },
      uCoreBloomBoost: { value: visualProfile.coreBloom },
    }),
    [visualProfile],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
    const zoom = interactionRef.current?.zoom ?? 21.5;
    const zoomDetail = THREE.MathUtils.clamp((14 - zoom) / 8.5, 0, 1);
    materialRef.current.uniforms.uZoomDetail.value = zoomDetail;
    materialRef.current.uniforms.uSelectiveBloom.value = 0.28 + zoomDetail * 0.44;
    materialRef.current.uniforms.uLocalContrast.value = 0.28 + zoomDetail * 0.58;
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
