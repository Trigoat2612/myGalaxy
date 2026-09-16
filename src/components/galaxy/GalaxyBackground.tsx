'use client';

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

import styles from './GalaxyBackground.module.css';

type QualityLevel = 'low' | 'balanced' | 'high';

type PointerPosition = {
  x: number;
  y: number;
};

type StarLayerData = {
  positions: Float32Array;
  colors: Float32Array;
};

type GalaxyData = {
  small: StarLayerData;
  medium: StarLayerData;
  bright: StarLayerData;
};

function createRandom(seed = 123456) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(mediaQuery.matches);

    update();
    mediaQuery.addEventListener('change', update);

    return () => mediaQuery.removeEventListener('change', update);
  }, []);

  return reducedMotion;
}

function useGlobalPointer() {
  const pointerRef = useRef<PointerPosition>({ x: 0, y: 0 });

  useEffect(() => {
    const updatePointer = (event: PointerEvent) => {
      pointerRef.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      pointerRef.current.y = -((event.clientY / window.innerHeight) * 2 - 1);
    };

    const resetPointer = () => {
      pointerRef.current.x = 0;
      pointerRef.current.y = 0;
    };

    window.addEventListener('pointermove', updatePointer, { passive: true });
    window.addEventListener('blur', resetPointer);

    return () => {
      window.removeEventListener('pointermove', updatePointer);
      window.removeEventListener('blur', resetPointer);
    };
  }, []);

  return pointerRef;
}

function pushStar(
  targetPositions: number[],
  targetColors: number[],
  x: number,
  y: number,
  z: number,
  color: THREE.Color,
) {
  targetPositions.push(x, y, z);
  targetColors.push(color.r, color.g, color.b);
}

function createGalaxyData(count: number): GalaxyData {
  const random = createRandom(1989 + count);

  const smallPositions: number[] = [];
  const smallColors: number[] = [];
  const mediumPositions: number[] = [];
  const mediumColors: number[] = [];
  const brightPositions: number[] = [];
  const brightColors: number[] = [];

  const branches = 5;
  const maxRadius = 10;

  const coreColor = new THREE.Color('#fff8e8');
  const middleColor = new THREE.Color('#8ba9ff');
  const outerColor = new THREE.Color('#7544ff');
  const starColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const isCore = random() < 0.25;

    const radius = isCore
      ? Math.pow(random(), 2.3) * 3.2
      : Math.pow(random(), 0.72) * maxRadius;

    const branch = i % branches;
    const branchAngle = (branch / branches) * Math.PI * 2;
    const spinAngle = radius * 0.64;
    const angle = branchAngle + spinAngle;

    const spread = 0.12 + radius * 0.08;
    const xNoise = (random() - 0.5) * spread * 2;
    const zNoise = (random() - 0.5) * spread * 2;

    const verticalSpread = Math.max(0.07, 0.72 - radius * 0.055);
    const yNoise = (random() - 0.5) * verticalSpread;

    const x = Math.cos(angle) * radius + xNoise;
    const y = yNoise;
    const z = Math.sin(angle) * radius + zNoise;

    const normalizedRadius = radius / maxRadius;

    if (normalizedRadius < 0.35) {
      starColor
        .copy(coreColor)
        .lerp(middleColor, normalizedRadius / 0.35);
    } else {
      starColor
        .copy(middleColor)
        .lerp(outerColor, (normalizedRadius - 0.35) / 0.65);
    }

    starColor.offsetHSL(
      (random() - 0.5) * 0.025,
      0,
      (random() - 0.5) * 0.09,
    );

    const brightnessClass = random();

    if (brightnessClass > 0.975) {
      pushStar(brightPositions, brightColors, x, y, z, starColor);
    } else if (brightnessClass > 0.82) {
      pushStar(mediumPositions, mediumColors, x, y, z, starColor);
    } else {
      pushStar(smallPositions, smallColors, x, y, z, starColor);
    }
  }

  return {
    small: {
      positions: new Float32Array(smallPositions),
      colors: new Float32Array(smallColors),
    },
    medium: {
      positions: new Float32Array(mediumPositions),
      colors: new Float32Array(mediumColors),
    },
    bright: {
      positions: new Float32Array(brightPositions),
      colors: new Float32Array(brightColors),
    },
  };
}

function StarPoints({
  data,
  size,
  opacity,
}: {
  data: StarLayerData;
  size: number;
  opacity: number;
}) {
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[data.positions, 3]}
        />
        <bufferAttribute
          attach="attributes-color"
          args={[data.colors, 3]}
        />
      </bufferGeometry>

      <pointsMaterial
        vertexColors
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function Galaxy({
  count,
  animate,
}: {
  count: number;
  animate: boolean;
}) {
  const galaxyRef = useRef<THREE.Group>(null);
  const data = useMemo(() => createGalaxyData(count), [count]);

  useFrame((_, delta) => {
    if (!animate || !galaxyRef.current) return;
    galaxyRef.current.rotation.y += delta * 0.024;
  });

  return (
    <group ref={galaxyRef} rotation={[0.34, 0, -0.08]}>
      <StarPoints data={data.small} size={0.032} opacity={0.72} />
      <StarPoints data={data.medium} size={0.055} opacity={0.88} />
      <StarPoints data={data.bright} size={0.095} opacity={1} />
    </group>
  );
}

function BackgroundStars({ count }: { count: number }) {
  const { small, bright } = useMemo(() => {
    const random = createRandom(92837 + count);
    const small: number[] = [];
    const bright: number[] = [];

    for (let i = 0; i < count; i++) {
      const theta = random() * Math.PI * 2;
      const cosPhi = random() * 2 - 1;
      const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);
      const radius = 18 + random() * 28;

      const x = radius * sinPhi * Math.cos(theta);
      const y = radius * cosPhi;
      const z = radius * sinPhi * Math.sin(theta);

      if (random() > 0.965) {
        bright.push(x, y, z);
      } else {
        small.push(x, y, z);
      }
    }

    return {
      small: new Float32Array(small),
      bright: new Float32Array(bright),
    };
  }, [count]);

  return (
    <>
      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[small, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#dfe8ff"
          size={0.03}
          sizeAttenuation
          transparent
          opacity={0.58}
          depthWrite={false}
        />
      </points>

      <points>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[bright, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color="#ffffff"
          size={0.075}
          sizeAttenuation
          transparent
          opacity={0.92}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </>
  );
}

function createTailTexture() {
  const width = 96;
  const data = new Uint8Array(width * 4);

  for (let i = 0; i < width; i++) {
    const t = i / (width - 1);
    const alpha = Math.round(Math.pow(t, 2.6) * 255);
    const offset = i * 4;

    data[offset] = 235;
    data[offset + 1] = 245;
    data[offset + 2] = 255;
    data[offset + 3] = alpha;
  }

  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;

  return texture;
}

function ShootingStar({
  index,
  animate,
}: {
  index: number;
  animate: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const elapsedRef = useRef(-(1.5 + index * 3.2));
  const speedRef = useRef(5.4 + index * 0.75);
  const tailTexture = useMemo(() => createTailTexture(), []);
  const tailLength = 2.4 + index * 0.18;
  const angle = -0.34;

  useEffect(() => () => tailTexture.dispose(), [tailTexture]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;

    group.position.set(-13 - index * 2, 6.5 + index * 1.4, -2 + index * 0.8);
    group.rotation.z = angle;
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

    if (group.position.x > 16 || group.position.y < -9) {
      const random = createRandom(Date.now() + index * 97);

      group.position.set(
        -14 - random() * 8,
        5 + random() * 7,
        -4 + random() * 7,
      );

      elapsedRef.current = -(4 + random() * 11 + index * 0.8);
      speedRef.current = 5 + random() * 4;
    }
  });

  return (
    <group ref={groupRef}>
      <mesh>
        <planeGeometry args={[tailLength, 0.035]} />
        <meshBasicMaterial
          map={tailTexture}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          opacity={0.78}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[tailLength / 2, 0, 0]}>
        <circleGeometry args={[0.055, 12]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={0.98}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function ShootingStars({
  count,
  animate,
}: {
  count: number;
  animate: boolean;
}) {
  return (
    <group rotation={[0.04, 0, 0]}>
      {Array.from({ length: count }, (_, index) => (
        <ShootingStar key={index} index={index} animate={animate} />
      ))}
    </group>
  );
}

function CameraRig({
  pointerRef,
  animate,
}: {
  pointerRef: RefObject<PointerPosition>;
  animate: boolean;
}) {
  const camera = useThree((state) => state.camera);

  useFrame((_, delta) => {
    const pointer = pointerRef.current ?? { x: 0, y: 0 };
    const targetX = animate ? pointer.x * 0.75 : 0;
    const targetY = animate ? 4.6 + pointer.y * 0.42 : 4.6;
    const easing = 1 - Math.exp(-delta * 2.8);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, easing);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, easing);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, 13, easing);
    camera.lookAt(0, 0, 0);
  });

  return null;
}

function getSceneCounts(width: number, quality: QualityLevel) {
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  if (isMobile) {
    if (quality === 'low') return { galaxy: 6000, background: 900, shooting: 1 };
    if (quality === 'high') return { galaxy: 10000, background: 1700, shooting: 2 };
    return { galaxy: 8000, background: 1300, shooting: 1 };
  }

  if (isTablet) {
    if (quality === 'low') return { galaxy: 11000, background: 1700, shooting: 2 };
    if (quality === 'high') return { galaxy: 19000, background: 3000, shooting: 3 };
    return { galaxy: 15000, background: 2400, shooting: 2 };
  }

  if (quality === 'low') return { galaxy: 16000, background: 2600, shooting: 2 };
  if (quality === 'high') return { galaxy: 28000, background: 4800, shooting: 4 };
  return { galaxy: 23000, background: 3800, shooting: 3 };
}

function ResponsiveScene({
  quality,
  animate,
  pointerRef,
}: {
  quality: QualityLevel;
  animate: boolean;
  pointerRef: RefObject<PointerPosition>;
}) {
  const { size } = useThree();
  const counts = getSceneCounts(size.width, quality);

  return (
    <>
      <CameraRig pointerRef={pointerRef} animate={animate} />
      <BackgroundStars count={counts.background} />
      <Galaxy count={counts.galaxy} animate={animate} />
      <ShootingStars count={counts.shooting} animate={animate} />
    </>
  );
}

export default function GalaxyBackground() {
  const reducedMotion = useReducedMotion();
  const pointerRef = useGlobalPointer();
  const [quality, setQuality] = useState<QualityLevel>('balanced');
  const [maxDpr, setMaxDpr] = useState(1.35);

  const lowerQuality = () => {
    setQuality('low');
    setMaxDpr(1);
  };

  const raiseQuality = () => {
    setQuality('high');
    setMaxDpr(1.5);
  };

  return (
    <div className={styles.galaxy} aria-hidden="true">
      <Canvas
        frameloop={reducedMotion ? 'demand' : 'always'}
        dpr={[1, maxDpr]}
        camera={{
          position: [0, 4.6, 13],
          fov: 55,
          near: 0.1,
          far: 100,
        }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#01020a']} />

        <PerformanceMonitor
          onIncline={raiseQuality}
          onDecline={lowerQuality}
          onFallback={lowerQuality}
        >
          <ResponsiveScene
            quality={quality}
            animate={!reducedMotion}
            pointerRef={pointerRef}
          />
        </PerformanceMonitor>
      </Canvas>
    </div>
  );
}
