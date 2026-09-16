'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { galaxyFragmentShader, galaxyVertexShader } from './shaders';

function createRandom(seed = 44017) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function signedNoise(random: () => number) {
  return (random() + random() + random() - 1.5) / 1.5;
}

export default function StarClusters({
  count,
  animate,
}: {
  count: number;
  animate: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((state) => state.gl);

  const data = useMemo(() => {
    const random = createRandom(44017 + count);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const scales = new Float32Array(count);
    const phases = new Float32Array(count);
    const radii = new Float32Array(count);
    const opacities = new Float32Array(count);

    const clusterCount = 9;
    const centers = Array.from({ length: clusterCount }, () => {
      const radius = 2.8 + random() * 8.8;
      const angle = random() * Math.PI * 2.3;
      return {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
        spread: 0.22 + random() * 0.48,
      };
    });

    const hotBlue = new THREE.Color('#b7d7ff');
    const neutralWhite = new THREE.Color('#f4f6ff');
    const warmWhite = new THREE.Color('#ffe3b5');
    const redGiant = new THREE.Color('#ffb39e');

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const center = centers[i % clusterCount];
      const spread = center.spread * (0.38 + Math.pow(random(), 1.8));
      const localAngle = random() * Math.PI * 2;
      const localRadius = spread * Math.sqrt(random());

      const x = center.x + Math.cos(localAngle) * localRadius;
      const z = center.z + Math.sin(localAngle) * localRadius;
      const y = signedNoise(random) * (0.035 + spread * 0.08);
      const radius = Math.sqrt(x * x + z * z);

      positions[i3] = x;
      positions[i3 + 1] = y;
      positions[i3 + 2] = z;

      const roll = random();
      const source = roll < 0.25
        ? hotBlue
        : roll < 0.83
          ? neutralWhite
          : roll < 0.975
            ? warmWhite
            : redGiant;

      colors[i3] = source.r;
      colors[i3 + 1] = source.g;
      colors[i3 + 2] = source.b;

      const rareBright = random() > 0.982;
      scales[i] = rareBright
        ? 1.05 + random() * 0.75
        : 0.24 + Math.pow(random(), 2.4) * 0.72;
      phases[i] = random() * Math.PI * 2;
      radii[i] = radius;
      opacities[i] = 0.38 + random() * 0.38;
    }

    return { positions, colors, scales, phases, radii, opacities };
  }, [count]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uPointSize: { value: 4.15 },
      uOpacity: { value: 0.72 },
      uDust: { value: 0 },
    }),
    [],
  );

  useEffect(() => () => materialRef.current?.dispose(), []);

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
    materialRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return (
    <points renderOrder={3}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
        <bufferAttribute attach="attributes-aRadius" args={[data.radii, 1]} />
        <bufferAttribute attach="attributes-aOpacity" args={[data.opacities, 1]} />
      </bufferGeometry>

      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={galaxyVertexShader}
        fragmentShader={galaxyFragmentShader}
        transparent
        depthWrite={false}
        depthTest
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}
