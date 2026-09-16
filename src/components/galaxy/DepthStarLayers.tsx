'use client';

import { useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import StarField from './StarField';

type PointerPosition = {
  x: number;
  y: number;
};

export default function DepthStarLayers({
  count,
  animate,
  pointerRef,
}: {
  count: number;
  animate: boolean;
  pointerRef: RefObject<PointerPosition>;
}) {
  const farRef = useRef<THREE.Group>(null);
  const nearRef = useRef<THREE.Group>(null);

  const farCount = Math.max(1, Math.floor(count * 0.64));
  const nearCount = Math.max(1, count - farCount);

  useFrame((_, delta) => {
    const pointer = pointerRef.current ?? { x: 0, y: 0 };
    const easing = 1 - Math.exp(-delta * 1.8);

    if (farRef.current) {
      const targetX = animate ? pointer.x * 0.055 : 0;
      const targetY = animate ? pointer.y * 0.035 : 0;

      farRef.current.position.x = THREE.MathUtils.lerp(
        farRef.current.position.x,
        targetX,
        easing,
      );
      farRef.current.position.y = THREE.MathUtils.lerp(
        farRef.current.position.y,
        targetY,
        easing,
      );
    }

    if (nearRef.current) {
      const targetX = animate ? pointer.x * 0.19 : 0;
      const targetY = animate ? pointer.y * 0.12 : 0;

      nearRef.current.position.x = THREE.MathUtils.lerp(
        nearRef.current.position.x,
        targetX,
        easing,
      );
      nearRef.current.position.y = THREE.MathUtils.lerp(
        nearRef.current.position.y,
        targetY,
        easing,
      );
    }
  });

  return (
    <>
      <group ref={farRef} renderOrder={-6}>
        <StarField
          count={farCount}
          animate={animate}
          pointSize={1.85}
          opacity={0.31}
          color="#aab9d9"
          radiusMin={29}
          radiusMax={58}
          seedOffset={1103}
        />
      </group>

      <group ref={nearRef} renderOrder={-3}>
        <StarField
          count={nearCount}
          animate={animate}
          pointSize={2.75}
          opacity={0.39}
          color="#d9e4fb"
          radiusMin={17}
          radiusMax={35}
          seedOffset={7411}
        />
      </group>
    </>
  );
}
