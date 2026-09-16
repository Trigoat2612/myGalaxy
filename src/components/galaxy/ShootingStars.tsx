'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function createRandom(seed = 123456) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function createTailTexture() {
  const width = 96;
  const data = new Uint8Array(width * 4);

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const alpha = Math.round(Math.pow(t, 2.7) * 255);
    const offset = i * 4;

    data[offset] = 225;
    data[offset + 1] = 240;
    data[offset + 2] = 255;
    data[offset + 3] = alpha;
  }

  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function ShootingStar({ index, animate }: { index: number; animate: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(-(2 + index * 3.1));
  const speedRef = useRef(5.3 + index * 0.65);
  const tailTexture = useMemo(() => createTailTexture(), []);
  const tailLength = 2.6 + index * 0.17;

  useEffect(() => () => tailTexture.dispose(), [tailTexture]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.position.set(-14 - index * 2, 6.3 + index * 1.3, -2 + index * 0.8);
    group.rotation.z = -0.34;
    group.visible = false;
  }, [index]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (!animate) {
      group.visible = false;
      return;
    }

    elapsedRef.current += delta;

    if (elapsedRef.current < 0) {
      group.visible = false;
      return;
    }

    group.visible = true;
    const speed = speedRef.current;
    group.position.x += speed * delta;
    group.position.y -= speed * 0.355 * delta;

    if (group.position.x > 17 || group.position.y < -9) {
      const random = createRandom(Math.floor(performance.now()) + index * 97);
      group.position.set(-14 - random() * 9, 5 + random() * 7, -4 + random() * 7);
      elapsedRef.current = -(4 + random() * 12 + index * 0.8);
      speedRef.current = 5 + random() * 4;
    }
  });

  return (
    <group ref={groupRef} renderOrder={3}>
      <mesh>
        <planeGeometry args={[tailLength, 0.035]} />
        <meshBasicMaterial
          map={tailTexture}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          opacity={0.44}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[tailLength / 2, 0, 0]}>
        <circleGeometry args={[0.055, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.76}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default function ShootingStars({ count, animate }: { count: number; animate: boolean }) {
  return (
    <group rotation={[0.04, 0, 0]}>
      {Array.from({ length: count }, (_, index) => (
        <ShootingStar key={index} index={index} animate={animate} />
      ))}
    </group>
  );
}
