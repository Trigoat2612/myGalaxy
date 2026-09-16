'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

import GalaxyDisc from './GalaxyDisc';
import { galaxyFragmentShader, galaxyVertexShader } from './shaders';

type GalaxyData = {
  positions: Float32Array;
  colors: Float32Array;
  scales: Float32Array;
  phases: Float32Array;
  radii: Float32Array;
  opacities: Float32Array;
};

function createRandom(seed = 123456) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function signedNoise(random: () => number) {
  return (random() + random() + random() - 1.5) / 1.5;
}

function createGalaxyData(count: number, dust = false): GalaxyData {
  const random = createRandom((dust ? 74021 : 1989) + count);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const phases = new Float32Array(count);
  const radii = new Float32Array(count);
  const opacities = new Float32Array(count);

  const branches = 4;
  const maxRadius = dust ? 14.2 : 13.4;

  const coreColor = new THREE.Color(dust ? '#5b5057' : '#fff2d8');
  const innerColor = new THREE.Color(dust ? '#4d5364' : '#d8e4ff');
  const middleColor = new THREE.Color(dust ? '#3f4a60' : '#9cb5e6');
  const outerColor = new THREE.Color(dust ? '#31394d' : '#7183b0');
  const color = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const selector = random();

    let radius: number;
    let ySpread: number;
    let branchStrength: number;
    let zoneOpacity: number;

    if (selector < (dust ? 0.08 : 0.24)) {
      radius = Math.pow(random(), 2.35) * 3.0;
      ySpread = 0.18 + (1 - radius / 3.0) * 0.36;
      branchStrength = 0.05;
      zoneOpacity = dust ? 0.15 : 0.92;
    } else if (selector < (dust ? 0.945 : 0.955)) {
      radius = 0.95 + Math.pow(random(), 0.72) * (maxRadius - 0.95);
      ySpread = 0.035 + radius * 0.0075;
      branchStrength = dust ? 0.66 : 0.43;
      zoneOpacity = dust ? 0.125 : 0.78;
    } else {
      radius = 7.8 + Math.pow(random(), 0.58) * (maxRadius + 3.2 - 7.8);
      ySpread = 0.34 + random() * 0.72;
      branchStrength = 0.015;
      zoneOpacity = dust ? 0.032 : 0.26;
    }

    const branch = i % branches;
    const branchAngle = (branch / branches) * Math.PI * 2;
    const spin = radius * (dust ? 0.3 : 0.31);
    const armAngle = branchAngle + spin;
    const freeAngle = random() * Math.PI * 2.3;
    const armBlend = branchStrength * (0.7 + (1.0 - Math.min(1, radius / maxRadius)) * 0.25);
    const angle = THREE.MathUtils.lerp(freeAngle, armAngle, armBlend);

    const spread = (dust ? 0.16 : 0.08) + radius * (dust ? 0.045 : 0.034);
    const effectiveRadius = Math.max(0, radius + signedNoise(random) * spread);

    const asymmetry = 1.0 + Math.sin(angle + 0.6) * 0.03;
    positions[i3] = Math.cos(angle) * effectiveRadius * asymmetry;
    positions[i3 + 1] = signedNoise(random) * ySpread;
    positions[i3 + 2] = Math.sin(angle) * effectiveRadius * (0.98 + Math.cos(angle - 0.45) * 0.015);

    const normalizedRadius = Math.min(1, radius / maxRadius);

    if (normalizedRadius < 0.2) {
      color.copy(coreColor).lerp(innerColor, normalizedRadius / 0.2);
    } else if (normalizedRadius < 0.62) {
      color.copy(innerColor).lerp(middleColor, (normalizedRadius - 0.2) / 0.42);
    } else {
      color.copy(middleColor).lerp(outerColor, (normalizedRadius - 0.62) / 0.38);
    }

    color.offsetHSL(
      (random() - 0.5) * 0.012,
      -0.02 + random() * 0.022,
      (random() - 0.5) * 0.042,
    );

    colors[i3] = color.r;
    colors[i3 + 1] = color.g;
    colors[i3 + 2] = color.b;

    const laneA = Math.abs(Math.sin(angle * 2.0 - radius * 0.63 + 0.5));
    const laneB = Math.abs(Math.sin(angle * 2.0 - radius * 0.63 + 3.02));
    const lane = Math.min(laneA, laneB);
    const laneMask = 1 - THREE.MathUtils.smoothstep(lane, 0.09, 0.28);
    const innerMask = THREE.MathUtils.smoothstep(radius, 1.3, 2.5);
    const outerMask = 1 - THREE.MathUtils.smoothstep(radius, 10.2, 13.8);
    const extinction = 1 - laneMask * innerMask * outerMask * (dust ? 0.015 : 0.03);

    const rareBrightStar = !dust && random() > 0.992;

    scales[i] = dust
      ? 0.22 + random() * 0.65
      : rareBrightStar
        ? 1.1 + random() * 0.8
        : 0.28 + Math.pow(random(), 2.5) * 0.86;

    phases[i] = random() * Math.PI * 2;
    radii[i] = radius;
    opacities[i] = zoneOpacity * extinction * (0.84 + random() * 0.16);
  }

  return { positions, colors, scales, phases, radii, opacities };
}

function ShaderPoints({
  count,
  dust = false,
  animate,
}: {
  count: number;
  dust?: boolean;
  animate: boolean;
}) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const gl = useThree((state) => state.gl);
  const data = useMemo(() => createGalaxyData(count, dust), [count, dust]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPixelRatio: { value: 1 },
      uPointSize: { value: dust ? 4.6 : 4.4 },
      uOpacity: { value: dust ? 0.10 : 0.94 },
      uDust: { value: dust ? 1 : 0 },
    }),
    [dust],
  );

  useEffect(() => () => materialRef.current?.dispose(), []);

  useFrame((state) => {
    const material = materialRef.current;
    if (!material) return;

    material.uniforms.uTime.value = animate ? state.clock.elapsedTime : 0;
    material.uniforms.uPixelRatio.value = gl.getPixelRatio();
  });

  return (
    <points renderOrder={dust ? 2 : 1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[data.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[data.colors, 3]} />
        <bufferAttribute attach="attributes-aScale" args={[data.scales, 1]} />
        <bufferAttribute attach="attributes-aPhase" args={[data.phases, 1]} />
        <bufferAttribute attach="attributes-aRadius" args={[data.radii, 1]} />
        <bufferAttribute attach="attributes-aOpacity" args={[data.opacities, 1]} />
      </bufferGeometry>

      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={galaxyVertexShader}
        fragmentShader={galaxyFragmentShader}
        transparent
        depthWrite={false}
        depthTest={!dust}
        blending={dust ? THREE.NormalBlending : THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
}

export default function GalaxyShader({
  stars,
  dust,
  animate,
}: {
  stars: number;
  dust: number;
  animate: boolean;
}) {
  return (
    <group rotation={[0.72, 0.04, -0.18]} scale={[1.26, 1.0, 0.74]} position={[0.08, -0.18, 0]}>
      <GalaxyDisc animate={animate} />
      <ShaderPoints count={stars} animate={animate} />
      <ShaderPoints count={dust} dust animate={animate} />
    </group>
  );
}
