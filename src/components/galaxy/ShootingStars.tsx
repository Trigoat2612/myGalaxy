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
    float r = length(p);

    if (r > 0.5) discard;

    float twinkle = 0.92 + 0.08 * sin(uTime * 3.2 + uPhase);

    float core = 1.0 - smoothstep(0.0, 0.075, r);
    float midGlow = 1.0 - smoothstep(0.045, 0.19, r);
    float halo = 1.0 - smoothstep(0.10, 0.50, r);

    // Destello en cruz muy sutil para que la cabeza se lea como una estrella,
    // sin convertirse en un icono artificial.
    float horizontalSpike = exp(-abs(p.y) * 82.0) * exp(-abs(p.x) * 8.0);
    float verticalSpike = exp(-abs(p.x) * 82.0) * exp(-abs(p.y) * 8.0);
    float spikes = (horizontalSpike + verticalSpike) * 0.13;

    float intensity = core * 1.0 + midGlow * 0.50 + halo * 0.24 + spikes;
    float alpha = intensity * uOpacity * twinkle;

    vec3 color = mix(uHaloColor, uCoreColor, clamp(core + midGlow * 0.42, 0.0, 1.0));
    color *= 0.92 + core * 0.72 + midGlow * 0.14;

    gl_FragColor = vec4(color, alpha);
  }
`;

function createTailTexture() {
  const width = 192;
  const height = 16;
  const data = new Uint8Array(width * height * 4);

  for (let y = 0; y < height; y++) {
    const ny = (y / (height - 1) - 0.5) * 2;
    const verticalFalloff = Math.exp(-(ny * ny) * 7.5);

    for (let x = 0; x < width; x++) {
      const t = x / (width - 1);

      // Casi invisible en el extremo y más concentrada junto a la cabeza.
      const longitudinal = Math.pow(t, 2.15);
      const softBody = Math.pow(t, 0.9) * 0.22;
      const alpha = Math.min(1, (longitudinal * 0.78 + softBody) * verticalFalloff);

      // La cola empieza azul-violeta y termina blanco-azulada junto a la estrella.
      const r = Math.round(112 + t * 126);
      const g = Math.round(138 + t * 105);
      const b = Math.round(200 + t * 55);

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
  head: THREE.Mesh | null,
) {
  const fromUpperBand = random() > 0.26;

  group.position.set(
    -17 - random() * 7,
    fromUpperBand ? 2.8 + random() * 8.2 : -0.5 + random() * 4.0,
    -5.5 + random() * 10.5,
  );

  // Trayectorias diagonales parecidas, pero no idénticas.
  state.angle = -0.20 - random() * 0.33;
  state.speed = 4.4 + random() * 3.5;
  state.scale = 0.72 + random() * 0.62;
  state.tailLength = 1.25 + random() * 1.55;
  state.tailWidth = 0.055 + random() * 0.045;
  state.opacity = 0.72 + random() * 0.22;
  state.delay = 1.8 + random() * 8.5;

  group.rotation.z = state.angle;
  group.scale.setScalar(state.scale);
  group.visible = false;

  if (tail) {
    tail.scale.set(state.tailLength, state.tailWidth, 1);
    tail.position.x = state.tailLength * 0.5;
  }

  if (head) {
    head.position.x = state.tailLength;
  }
}

function ShootingStar({ index, animate }: { index: number; animate: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const tailRef = useRef<THREE.Mesh>(null);
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
      uCoreColor: { value: new THREE.Color('#fff2d8') },
      uHaloColor: { value: new THREE.Color('#a9bee8') },
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
      headRef.current,
    );

    // Escalona la primera aparición para evitar que todas salgan juntas.
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
        headRef.current,
      );
    }
  });

  return (
    <group ref={groupRef} renderOrder={4}>
      {/*
        Cola: una sola textura 2D con caída longitudinal y vertical.
        El plano mide 1x1 y se escala por estrella para variar longitud/ancho.
      */}
      <mesh ref={tailRef} position={[1, 0, 0]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          map={tailTexture}
          transparent
          depthWrite={false}
          depthTest={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          opacity={0.30}
          toneMapped={false}
        />
      </mesh>

      {/*
        Cabeza premium: shader radial con núcleo cálido, halo azul y destello sutil.
        Así utiliza el mismo lenguaje visual que las estrellas de la galaxia.
      */}
      <mesh ref={headRef} position={[2, 0, 0]}>
        <planeGeometry args={[0.19, 0.19]} />
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
