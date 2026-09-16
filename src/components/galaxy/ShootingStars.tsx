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
  const width = 128;
  const data = new Uint8Array(width * 4);

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);

    /*
     * La punta debe ser más brillante
     * y la cola más suave.
     */
    const alpha = Math.round(Math.pow(t, 2.2) * 210);

    const r = Math.round(156 + t * 99);   // 156 → 255
    const g = Math.round(181 + t * 59);   // 181 → 240
    const b = Math.round(230 + t * 25);   // 230 → 255

    const offset = i * 4;

    data[offset] = r;
    data[offset + 1] = g;
    data[offset + 2] = b;
    data[offset + 3] = alpha;
  }

  const texture = new THREE.DataTexture(
    data,
    width,
    1,
    THREE.RGBAFormat
  );

  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function resetStar(
  group: THREE.Group,
  random: () => number,
  state: {
    delay: number;
    speed: number;
    scale: number;
  }
) {
  /*
   * Las lanzamos desde distintas zonas
   * para que decoren alrededor del disco.
   */
  group.position.set(
    -16 - random() * 8,
    3 + random() * 8,
    -6 + random() * 10
  );

  group.rotation.z =
    -0.22 - random() * 0.34;

  state.delay =
    1.5 + random() * 7.5;

  state.speed =
    4.2 + random() * 3.2;

  state.scale =
    0.8 + random() * 0.7;

  group.scale.setScalar(state.scale);
  group.visible = false;
}

function ShootingStar({
  index,
  animate,
}: {
  index: number;
  animate: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  const starStateRef = useRef({
    delay: 2 + index * 0.9,
    speed: 5,
    scale: 1,
  });

  const tailTexture = useMemo(
    () => createTailTexture(),
    []
  );

  const randomRef = useRef(
    createRandom(5000 + index * 97)
  );

  useEffect(() => {
    return () => {
      tailTexture.dispose();
    };
  }, [tailTexture]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    resetStar(
      group,
      randomRef.current,
      starStateRef.current
    );
  }, []);

  useFrame((_, delta) => {
    const group = groupRef.current;
    if (!group) return;

    if (!animate) {
      group.visible = false;
      return;
    }

    const state = starStateRef.current;

    state.delay -= delta;

    if (state.delay > 0) {
      group.visible = false;
      return;
    }

    group.visible = true;

    const speed = state.speed;

    group.position.x += speed * delta;
    group.position.y -= speed * (0.22 + state.scale * 0.08) * delta;

    if (
      group.position.x > 18 ||
      group.position.y < -8
    ) {
      resetStar(
        group,
        randomRef.current,
        state
      );
    }
  });

  const tailLength =
    1.6 + index * 0.16;

  return (
    <group
      ref={groupRef}
      renderOrder={3}
    >
      <mesh>
        <planeGeometry
          args={[
            tailLength,
            0.028,
          ]}
        />
        <meshBasicMaterial
          map={tailTexture}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          opacity={0.28}
          toneMapped={false}
        />
      </mesh>

      <mesh
        position={[
          tailLength / 2,
          0,
          0,
        ]}
      >
        <circleGeometry
          args={[0.04, 16]}
        />
        <meshBasicMaterial
          color="#fff2d8"
          transparent
          opacity={0.82}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh
        position={[
          tailLength / 2 - 0.02,
          0,
          -0.001,
        ]}
      >
        <circleGeometry
          args={[0.07, 16]}
        />
        <meshBasicMaterial
          color="#d8e4ff"
          transparent
          opacity={0.22}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

export default function ShootingStars({
  count,
  animate,
}: {
  count: number;
  animate: boolean;
}) {
  return (
    <group rotation={[0.04, 0, 0]}>
      {Array.from(
        { length: count },
        (_, index) => (
          <ShootingStar
            key={index}
            index={index}
            animate={animate}
          />
        )
      )}
    </group>
  );
}