'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { starFieldFragmentShader, starFieldVertexShader } from './shaders';
import type { InteractionState } from './InteractionController';

function createRandom(seed = 92837) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type StarFieldProps = {
  count: number;
  animate: boolean;
  pointSize?: number;
  opacity?: number;
  color?: string;
  radiusMin?: number;
  radiusMax?: number;
  seedOffset?: number;
  distribution?: 'halo' | 'disc';
  verticalScale?: number;
  radialBias?: number;
  interactionRef?: RefObject<InteractionState>;
};

export default function StarField({
  count,
  animate,
  pointSize = 2.5,
  opacity = 0.46,
  color = '#cbd7ef',
  radiusMin = 22,
  radiusMax = 53,
  seedOffset = 0,
  distribution = 'halo',
  verticalScale = 1,
  radialBias = 1,
  interactionRef,
}: StarFieldProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((state) => state.gl);

  const data = useMemo(() => {
    const random = createRandom(92837 + count + seedOffset);
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const theta = random() * Math.PI * 2;
      const radiusSample = distribution === 'disc'
        ? Math.pow(random(), radialBias)
        : 1 - Math.pow(random(), radialBias);
      const radius = radiusMin + radiusSample * (radiusMax - radiusMin);

      if (distribution === 'disc') {
        const ellipseTightness = 0.76 + random() * 0.18;
        positions[i3] = radius * Math.cos(theta);
        positions[i3 + 1] = (random() * 2 - 1) * verticalScale * (0.28 + random() * 0.72) * (1 + radius * 0.012);
        positions[i3 + 2] = radius * Math.sin(theta) * ellipseTightness;
      } else {
        const cosPhi = random() * 2 - 1;
        const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
        positions[i3] = radius * sinPhi * Math.cos(theta);
        positions[i3 + 1] = radius * cosPhi * verticalScale;
        positions[i3 + 2] = radius * sinPhi * Math.sin(theta);
      }

      scales[i] = random() > 0.989
        ? 1.45 + random() * 1.0
        : 0.28 + Math.pow(random(), 2.2) * 0.72;
      phases[i] = random() * Math.PI * 2;
    }

    return { positions, scales, phases };
  }, [count, distribution, radialBias, radiusMin, radiusMax, seedOffset, verticalScale]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uPointSize: { value: pointSize },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uZoomDetail: { value: 0 },
    }),
    [color, opacity, pointSize],
  );

  const groupRef = useRef<THREE.Points>(null);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();

    const zoom = interactionRef?.current?.zoom ?? 21.5;
    const zoomDetail = THREE.MathUtils.clamp((14 - zoom) / 8.5, 0, 1);
    material.uniforms.uZoomDetail.value = zoomDetail;

    const points = groupRef.current;
    if (points && animate) {
      const direction = distribution === 'disc' ? 1 : -1;
      points.rotation.y = state.clock.elapsedTime * 0.01 * direction;
    }
  });

  return (
    <points ref={groupRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
      </bufferGeometry>

      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={starFieldVertexShader}
        fragmentShader={starFieldFragmentShader}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
