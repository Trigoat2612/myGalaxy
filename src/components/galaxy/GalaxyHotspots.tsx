'use client';

import { Billboard, Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';

import { GALAXY_HOTSPOTS, type GalaxyHotspotId } from './galaxyConfig';
import styles from './GalaxyBackground.module.css';

const starVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const starFragmentShader = /* glsl */ `
  uniform vec3 uCoreColor;
  uniform vec3 uHaloColor;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSeed;
  uniform float uSelected;

  varying vec2 vUv;

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p);

    if (r > 0.5) discard;

    float twinkle = 0.92 + 0.08 * sin(uTime * (2.0 + uSeed * 0.3) + uSeed * 3.1);
    float core = 1.0 - smoothstep(0.0, 0.1, r);
    float innerGlow = 1.0 - smoothstep(0.03, 0.23, r);
    float halo = 1.0 - smoothstep(0.08, 0.5, r);

    float streakX = smoothstep(0.07, 0.0, abs(p.x)) * smoothstep(0.48, 0.02, abs(p.y));
    float streakY = smoothstep(0.07, 0.0, abs(p.y)) * smoothstep(0.48, 0.02, abs(p.x));
    float cross = max(streakX, streakY) * (0.22 + uSelected * 0.18);

    vec3 color = mix(uHaloColor, uCoreColor, core * 0.95 + innerGlow * 0.25);
    color *= 0.9 + twinkle * 0.1;

    float alpha = (
      halo * 0.32 +
      innerGlow * 0.38 +
      core * 0.48 +
      cross
    ) * uOpacity * (0.96 + uSelected * 0.14);

    gl_FragColor = vec4(color, alpha);
  }
`;

const nebulaVertexShader = /* glsl */ `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragmentShader = /* glsl */ `
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform float uOpacity;
  uniform float uTime;
  uniform float uSeed;

  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 345.45));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));

    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;

    for (int i = 0; i < 4; i++) {
      value += amplitude * noise(p);
      p = p * 2.0 + vec2(12.4, 7.3);
      amplitude *= 0.5;
    }

    return value;
  }

  void main() {
    vec2 p = vUv - 0.5;
    float r = length(p * vec2(1.0, 0.86));
    if (r > 0.5) discard;

    vec2 flow = p * 4.4 + vec2(uTime * 0.05 + uSeed, -uTime * 0.03 + uSeed * 0.4);
    float n = fbm(flow);
    float cloud = smoothstep(0.26, 0.88, n);
    float mask = (1.0 - smoothstep(0.16, 0.5, r));
    vec3 color = mix(uColorA, uColorB, cloud);
    float alpha = mask * (0.08 + cloud * 0.18) * uOpacity;

    gl_FragColor = vec4(color, alpha);
  }
`;

function StarBillboard({
  size,
  coreColor,
  haloColor,
  opacity,
  seed,
  selected,
  position = [0, 0, 0],
}: {
  size: number;
  coreColor: string;
  haloColor: string;
  opacity: number;
  seed: number;
  selected: boolean;
  position?: [number, number, number];
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uCoreColor: { value: new THREE.Color(coreColor) },
      uHaloColor: { value: new THREE.Color(haloColor) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uSeed: { value: seed },
      uSelected: { value: selected ? 1 : 0 },
    }),
    [coreColor, haloColor, opacity, seed, selected],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    materialRef.current.uniforms.uSelected.value = selected ? 1 : 0;
  });

  return (
    <group position={position}>
      <mesh>
        <planeGeometry args={[size, size]} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={starVertexShader}
          fragmentShader={starFragmentShader}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function NebulaPuff({
  size,
  colorA,
  colorB,
  opacity,
  seed,
  position = [0, 0, 0],
  rotation = 0,
}: {
  size: [number, number];
  colorA: string;
  colorB: string;
  opacity: number;
  seed: number;
  position?: [number, number, number];
  rotation?: number;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(
    () => ({
      uColorA: { value: new THREE.Color(colorA) },
      uColorB: { value: new THREE.Color(colorB) },
      uOpacity: { value: opacity },
      uTime: { value: 0 },
      uSeed: { value: seed },
    }),
    [colorA, colorB, opacity, seed],
  );

  useFrame((state) => {
    if (!materialRef.current) return;
    materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <group position={position}>
      <mesh rotation={[0, 0, rotation]}>
        <planeGeometry args={size} />
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={nebulaVertexShader}
          fragmentShader={nebulaFragmentShader}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function CoreMarker({ selected }: { selected: boolean }) {
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!ringRef.current) return;
    ringRef.current.rotation.z += 0.0025;
  });

  return (
    <>
      <StarBillboard
        size={0.42}
        coreColor={selected ? '#fff0c7' : '#fff2d8'}
        haloColor={selected ? '#d8e4ff' : '#9cb5e6'}
        opacity={selected ? 0.96 : 0.84}
        seed={1.1}
        selected={selected}
      />
      <StarBillboard size={0.19} coreColor="#ffffff" haloColor="#d8e4ff" opacity={0.72} seed={1.7} position={[0.05, -0.02, 0.01]} selected={selected} />
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.21, 0.235, 40]} />
        <meshBasicMaterial
          color={selected ? '#ffe0a8' : '#9cb5e6'}
          transparent
          opacity={selected ? 0.58 : 0.28}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </>
  );
}

function StellarStreamMarker({ selected }: { selected: boolean }) {
  const points = useMemo(
    () => [
      { pos: [-0.22, -0.08, 0.0] as [number, number, number], size: 0.11, core: '#b9ceff', halo: '#7fa1ff', opacity: 0.52, seed: 2.0 },
      { pos: [-0.12, -0.03, 0.01] as [number, number, number], size: 0.13, core: '#d9e5ff', halo: '#88a9ff', opacity: 0.58, seed: 2.4 },
      { pos: [0.0, 0.0, 0.02] as [number, number, number], size: 0.18, core: '#fff2d8', halo: '#d8e4ff', opacity: 0.82, seed: 2.8 },
      { pos: [0.13, 0.05, 0.03] as [number, number, number], size: 0.12, core: '#ffffff', halo: '#bfd2ff', opacity: 0.64, seed: 3.2 },
      { pos: [0.24, 0.09, 0.04] as [number, number, number], size: 0.09, core: '#c7d8ff', halo: '#7b9eff', opacity: 0.46, seed: 3.6 },
    ],
    [],
  );


  return (
    <group rotation={[0, 0, -0.35]}>
      <NebulaPuff size={[0.9, 0.26]} colorA="#5573d1" colorB="#9ab0ff" opacity={selected ? 0.26 : 0.18} seed={2.3} rotation={-0.18} />
      <NebulaPuff size={[0.54, 0.18]} colorA="#8aa5ff" colorB="#d8e4ff" opacity={selected ? 0.22 : 0.14} seed={3.1} position={[0.04, 0.01, 0.0]} rotation={-0.18} />
      {points.map((point) => (
        <StarBillboard
          key={`${point.seed}`}
          size={selected ? point.size * 1.08 : point.size}
          coreColor={point.core}
          haloColor={point.halo}
          opacity={selected ? Math.min(0.95, point.opacity + 0.08) : point.opacity}
          seed={point.seed}
          position={point.pos}
          selected={selected}
        />
      ))}
    </group>
  );
}

function StellarNurseryMarker({ selected }: { selected: boolean }) {
  const sparks = useMemo(
    () => [
      { pos: [0.0, 0.0, 0.03] as [number, number, number], size: 0.17, core: '#fff2d8', halo: '#d8e4ff', opacity: 0.78, seed: 4.0 },
      { pos: [-0.16, 0.08, 0.01] as [number, number, number], size: 0.11, core: '#d8e4ff', halo: '#8aa5ff', opacity: 0.52, seed: 4.5 },
      { pos: [0.15, -0.04, 0.02] as [number, number, number], size: 0.1, core: '#ffffff', halo: '#aac1ff', opacity: 0.5, seed: 5.0 },
      { pos: [0.07, 0.14, 0.01] as [number, number, number], size: 0.08, core: '#bfd1ff', halo: '#7998f8', opacity: 0.42, seed: 5.5 },
      { pos: [-0.08, -0.13, 0.02] as [number, number, number], size: 0.07, core: '#e6eeff', halo: '#90adff', opacity: 0.38, seed: 6.0 },
    ],
    [],
  );


  return (
    <group rotation={[0, 0, -0.35]}>
      <NebulaPuff size={[0.72, 0.54]} colorA="#596fc9" colorB="#a6b7ff" opacity={selected ? 0.26 : 0.18} seed={4.2} />
      <NebulaPuff size={[0.52, 0.42]} colorA="#7086dd" colorB="#d8e4ff" opacity={selected ? 0.18 : 0.11} seed={5.1} position={[0.06, 0.02, 0.01]} rotation={0.4} />
      {sparks.map((spark) => (
        <StarBillboard
          key={`${spark.seed}`}
          size={selected ? spark.size * 1.1 : spark.size}
          coreColor={spark.core}
          haloColor={spark.halo}
          opacity={selected ? Math.min(0.94, spark.opacity + 0.1) : spark.opacity}
          seed={spark.seed}
          position={spark.pos}
          selected={selected}
        />
      ))}
    </group>
  );
}

function Marker({ id, selected }: { id: GalaxyHotspotId; selected: boolean }) {
  if (id === 'inner-arm') return <StellarStreamMarker selected={selected} />;
  if (id === 'cluster') return <StellarNurseryMarker selected={selected} />;
  return <CoreMarker selected={selected} />;
}

function Hotspot({
  id,
  label,
  position,
  selected,
  onSelect,
  compact,
}: {
  id: GalaxyHotspotId;
  label: string;
  position: [number, number, number];
  selected: boolean;
  onSelect: (id: GalaxyHotspotId) => void;
  compact: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    const group = groupRef.current;
    if (!group) return;

    const pulse = 1 + Math.sin(state.clock.elapsedTime * 2.2 + position[0]) * 0.05;
    group.scale.setScalar(selected ? 1.14 : pulse);
  });

  return (
    <group ref={groupRef} position={position}>
      <Billboard follow>
        <group
          onClick={(event) => {
            event.stopPropagation();
            onSelect(id);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            document.body.style.cursor = 'pointer';
          }}
          onPointerOut={() => {
            document.body.style.cursor = '';
          }}
        >
          <Marker id={id} selected={selected} />
        </group>
      </Billboard>

      <Html
        center
        position={[0, 0.5, 0]}
        distanceFactor={compact ? 6.4 : 11}
        zIndexRange={[12, 0]}
        style={{ pointerEvents: 'none' }}
      >
        <div className={`${styles.hotspotLabel} ${selected ? styles.hotspotLabelActive : ''}`}>
          {label}
        </div>
      </Html>
    </group>
  );
}

export default function GalaxyHotspots({
  enabled,
  selected,
  onSelect,
}: {
  enabled: boolean;
  selected: GalaxyHotspotId | null;
  onSelect: (id: GalaxyHotspotId) => void;
}) {
  const width = useThree((state) => state.size.width);
  const compact = width < 640;

  if (!enabled) return null;

  return (
    <group renderOrder={6}>
      {GALAXY_HOTSPOTS.map((hotspot) => (
        <Hotspot
          key={hotspot.id}
          id={hotspot.id}
          label={hotspot.shortLabel}
          position={hotspot.position}
          selected={selected === hotspot.id}
          onSelect={onSelect}
          compact={compact}
        />
      ))}
    </group>
  );
}
