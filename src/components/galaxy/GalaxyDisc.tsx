'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { galaxyDiscFragmentShader, galaxyDiscVertexShader } from './shaders';
import type { InteractionState } from './InteractionController';
import type { GalaxyVisualProfileSettings } from './visualProfiles';

export default function GalaxyDisc({
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
      uOpacity: { value: 0.46 },
      uCoreContrast: { value: 0.18 },
      uBrightness: { value: visualProfile.discBrightness },
      uSaturation: { value: visualProfile.discSaturation },
      uWarmth: { value: visualProfile.discWarmth },
    }),
    [visualProfile],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
    const zoom = interactionRef.current?.zoom ?? 21.5;
    const zoomDetail = THREE.MathUtils.clamp((14 - zoom) / 8.5, 0, 1);
    materialRef.current.uniforms.uCoreContrast.value = (0.18 + zoomDetail * 0.36) * visualProfile.discContrast;
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
