'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { galaxyDiscFragmentShader, galaxyDiscVertexShader } from './shaders';

export default function GalaxyDisc({ animate }: { animate: boolean }) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: 0.46 },
    }),
    [],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
  });

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1.24, 0.92, 1]} renderOrder={-1}>
      <planeGeometry args={[27.5, 25.5, 1, 1]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={galaxyDiscVertexShader}
        fragmentShader={galaxyDiscFragmentShader}
        transparent
        depthWrite={false}
        depthTest={false}
        blending={THREE.NormalBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
