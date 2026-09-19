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

const shootingStarVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const shootingStarFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uPhase;
  uniform float uOpacity;
  uniform vec3 uCoreColor;
  uniform vec3 uHaloColor;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - vec2(0.5);
    float twinkle = 0.93 + 0.07 * sin(uTime * 3.1 + uPhase * 1.7);

    float core = exp(-dot(p, p) * 96.0);
    float coma = exp(-dot(vec2((p.x + 0.06) * 1.1, p.y * 0.9), vec2((p.x + 0.06) * 1.1, p.y * 0.9)) * 18.0);
    float halo = exp(-dot(vec2(p.x * 0.82, p.y * 0.82), vec2(p.x * 0.82, p.y * 0.82)) * 6.0);

    float spikeA = exp(-abs(p.y) * 36.0) * exp(-abs(p.x) * 4.5);
    float spikeB = exp(-abs((p.y - p.x) * 0.7071) * 32.0) * exp(-abs((p.x + p.y) * 0.7071) * 4.2);
    float spikeC = exp(-abs((p.y + p.x) * 0.7071) * 32.0) * exp(-abs((p.x - p.y) * 0.7071) * 4.2);
    float diffraction = max(spikeA * 0.22, max(spikeB, spikeC) * 0.14);

    float intensity = core * 1.32 + coma * 0.9 + halo * 0.34 + diffraction;
    float alpha = clamp(intensity * uOpacity * twinkle, 0.0, 1.0);

    vec3 color = mix(uHaloColor, uCoreColor, clamp(core * 0.95 + coma * 0.5, 0.0, 1.0));
    color *= 0.92 + core * 1.12 + coma * 0.18;

    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
  }
`;

function createTailTexture() {
  const width = 256;
  const height = 24;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const ny = (y / (height - 1) - 0.5) * 2;

    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);
      const verticalBody = Math.exp(-(ny * ny) * (7.0 + t * 2.5));
      const softRim = Math.exp(-(ny * ny) * 2.1);
      const body = Math.pow(t, 2.2) * 0.9;
      const haze = Math.pow(t, 1.2) * 0.18;
      const waviness = 0.92 + 0.08 * Math.sin(t * 18.0 + ny * 6.0);
      const alpha = Math.min(1, (body * verticalBody + haze * softRim) * waviness);

      const r = Math.round(118 + t * 120);
      const g = Math.round(144 + t * 98);
      const b = Math.round(204 + t * 42);

      const offset = (y * width + x) * 4;
      data[offset] = r;
      data[offset + 1] = g;
      data[offset + 2] = b;
      data[offset + 3] = Math.round(alpha * 255);
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;

  return texture;
}

type ShootingStarState = {
  delay: number;
  speed: number;
  scale: number;
  angle: number;
  tailLength: number;
  tailWidth: number;
  opacity: number;
};

function resetStar(
  group: THREE.Group,
  random: () => number,
  state: ShootingStarState,
  tail: THREE.Mesh | null,
  tailGlow: THREE.Mesh | null,
  head: THREE.Mesh | null,
) {
  const fromUpperBand = random() > 0.24;

  group.position.set(
    -17 - random() * 7,
    fromUpperBand ? 2.2 + random() * 8.8 : -0.2 + random() * 4.3,
    -5.5 + random() * 10.5,
  );

  state.angle = -0.18 - random() * 0.28;
  state.speed = 4.0 + random() * 2.8;
  state.scale = 0.75 + random() * 0.56;
  state.tailLength = 1.45 + random() * 1.75;
  state.tailWidth = 0.05 + random() * 0.038;
  state.opacity = 0.74 + random() * 0.22;
  state.delay = 1.5 + random() * 7.5;

  group.rotation.z = state.angle;
  group.scale.setScalar(state.scale);
  group.visible = false;

  if (tail) {
    tail.scale.set(state.tailLength, state.tailWidth, 1);
    tail.position.x = state.tailLength * 0.5;
  }

  if (tailGlow) {
    tailGlow.scale.set(state.tailLength * 1.08, state.tailWidth * 2.2, 1);
    tailGlow.position.x = state.tailLength * 0.48;
  }

  if (head) {
    head.position.x = state.tailLength;
  }
}

function ShootingStar({ index, animate }: { index: number; animate: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
  const tailGlowRef = useRef<THREE.Mesh>(null);
  const headRef = useRef<THREE.Mesh>(null);
  const headMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const randomRef = useRef(createRandom(7349 + index * 131));
  const tailTexture = useMemo(() => createTailTexture(), []);

  const stateRef = useRef<ShootingStarState>({
    delay: 1.5 + index * 1.25,
    speed: 5,
    scale: 1,
    angle: -0.3,
    tailLength: 2,
    tailWidth: 0.075,
    opacity: 0.85,
  });

  const headUniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPhase: { value: index * 1.731 },
      uOpacity: { value: 0.9 },
      uCoreColor: { value: new THREE.Color('#fff6e8') },
      uHaloColor: { value: new THREE.Color('#aebef0') },
    }),
    [index],
  );

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    resetStar(
      group,
      randomRef.current,
      stateRef.current,
      tailRef.current,
      tailGlowRef.current,
      headRef.current,
    );

    stateRef.current.delay += index * 1.15;
  }, [index]);

  useEffect(() => {
    return () => {
      tailTexture.dispose();
      headMaterialRef.current?.dispose();
    };
  }, [tailTexture]);

  useFrame((frameState, delta) => {
    const group = groupRef.current;
    const material = headMaterialRef.current;

    if (!group) return;

    if (material) {
      material.uniforms.uTime.value = animate ? frameState.clock.elapsedTime : 0;
      material.uniforms.uOpacity.value = stateRef.current.opacity;
    }

    if (!animate) {
      group.visible = false;
      return;
    }

    const state = stateRef.current;
    state.delay -= delta;

    if (state.delay > 0) {
      group.visible = false;
      return;
    }

    group.visible = true;

    const dx = Math.cos(state.angle) * state.speed * delta;
    const dy = Math.sin(state.angle) * state.speed * delta;

    group.position.x += dx;
    group.position.y += dy;

    if (group.position.x > 18.5 || group.position.y < -8.5) {
      resetStar(
        group,
        randomRef.current,
        state,
        tailRef.current,
        tailGlowRef.current,
        headRef.current,
      );
    }
  });

  return (
    <group ref={groupRef} renderOrder={4}>
      <mesh ref={tailGlowRef} position={[1, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={tailTexture}
          transparent
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          opacity={0.14}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={tailRef} position={[1, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={tailTexture}
          transparent
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          opacity={0.34}
          toneMapped={false}
        />
      </mesh>

      <mesh ref={headRef} position={[2, 0, 0]}>
        <planeGeometry args={[0.24, 0.24]} />
        <shaderMaterial
          ref={headMaterialRef}
          uniforms={headUniforms}
          vertexShader={shootingStarVertexShader}
          fragmentShader={shootingStarFragmentShader}
          transparent
          depthWrite={false}
          depthTest={false}
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
    <group rotation={[0.035, 0, 0]}>
      {Array.from({ length: count }, (_, index) => (
        <ShootingStar key={index} index={index} animate={animate} />
      ))}
    </group>
  );
}
