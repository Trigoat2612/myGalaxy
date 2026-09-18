'use client';

import { useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import StarField from './StarField';

type PointerPosition = {
  x: number;
  y: number;
};

type DepthLayer = {
  count: number;
  pointSize: number;
  opacity: number;
  color: string;
  radiusMin: number;
  radiusMax: number;
  offsetY: number;
  driftX: number;
  driftY: number;
  seedOffset: number;
};

export default function DepthStarLayers({
  layers,
  animate,
  pointerRef,
}: {
  layers: DepthLayer[];
  animate: boolean;
  pointerRef: RefObject<PointerPosition>;
}) {
  const layerRefs = useRef<Array<THREE.Group | null>>([]);
  const safeLayers = useMemo(() => layers.filter((layer) => layer.count > 0), [layers]);

  useFrame((_, delta) => {
    const pointer = pointerRef.current ?? { x: 0, y: 0 };
    const easing = 1 - Math.exp(-delta * 1.8);

    layerRefs.current.forEach((group, index) => {
      if (!group) return;
      const layer = safeLayers[index];
      if (!layer) return;

      const targetX = animate ? pointer.x * layer.driftX : 0;
      const targetY = layer.offsetY + (animate ? pointer.y * layer.driftY : 0);

      group.position.x = THREE.MathUtils.lerp(group.position.x, targetX, easing);
      group.position.y = THREE.MathUtils.lerp(group.position.y, targetY, easing);
    });
  });

  return (
    <>
      {safeLayers.map((layer, index) => (
        <group
          key={`${layer.seedOffset}-${index}`}
          ref={(node) => {
            layerRefs.current[index] = node;
          }}
          position={[0, layer.offsetY, 0]}
          renderOrder={-6 + index}
        >
          <StarField
            count={layer.count}
            animate={animate}
            pointSize={layer.pointSize}
            opacity={layer.opacity}
            color={layer.color}
            radiusMin={layer.radiusMin}
            radiusMax={layer.radiusMax}
            seedOffset={layer.seedOffset}
          />
        </group>
      ))}
    </>
  );
}
