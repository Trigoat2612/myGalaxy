'use client';

import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { starFieldFragmentShader, starFieldVertexShader } from './shaders';

function createRandom(seed = 92837) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function StarField({ count, animate }: { count: number; animate: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((state) => state.gl);

  const data = useMemo(() => {
    const random = createRandom(92837 + count);
    const positions = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const radius = 22 + random() * 31;

      positions[i3] = radius * sinPhi * Math.cos(theta);
      positions[i3 + 1] = radius * cosPhi;
      positions[i3 + 2] = radius * sinPhi * Math.sin(theta);

      scales[i] = random() > 0.987 ? 1.65 + random() * 1.15 : 0.32 + Math.pow(random(), 2.1) * 0.78;
      phases[i] = random() * Math.PI * 2;
    }

    return { positions, scales, phases };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uPointSize: { value: 2.5 },
      uColor: { value: new THREE.Color('#cbd7ef') },
      uOpacity: { value: 0.46 },
    }),
    [],
  );

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return (
    <points renderOrder={-4}>
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
