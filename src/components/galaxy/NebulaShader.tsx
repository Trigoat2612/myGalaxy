'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { nebulaFragmentShader, nebulaVertexShader } from './shaders';
import type { GalaxyVisualProfileSettings } from './visualProfiles';

export default function NebulaShader({
  animate,
  opacity = 0.72,
  visualProfile,
}: {
  animate: boolean;
  opacity?: number;
  visualProfile: GalaxyVisualProfileSettings;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uOpacity: { value: opacity },
      uBrightness: { value: visualProfile.nebulaBrightness },
      uSaturation: { value: visualProfile.nebulaSaturation },
      uTint: { value: visualProfile.nebulaTint },
    }),
    [opacity, visualProfile],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
  });

  return (
    <mesh renderOrder={-10}>
      <sphereGeometry args={[46, 32, 20]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={nebulaVertexShader}
        fragmentShader={nebulaFragmentShader}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </mesh>
  );
}
