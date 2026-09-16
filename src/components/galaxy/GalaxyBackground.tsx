'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

import GalaxyShader from './GalaxyShader';
import NebulaShader from './NebulaShader';
import ShootingStars from './ShootingStars';
import DepthStarLayers from './DepthStarLayers';
import styles from './GalaxyBackground.module.css';

type QualityLevel = 'low' | 'balanced' | 'high';

type PointerPosition = {
  x: number;
  y: number;
};

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

function CameraRig({
  pointerRef,
  animate,
}: {
  pointerRef: RefObject<PointerPosition>;
  animate: boolean;
}) {
  const camera = useThree((state) => state.camera);

  useFrame((state, delta) => {
    const pointer = pointerRef.current ?? { x: 0, y: 0 };
    const idleX = animate ? Math.sin(state.clock.elapsedTime * 0.05) * 0.035 : 0;
    const targetX = animate ? 0.1 + pointer.x * 0.18 + idleX : 0.1;
    const targetY = animate ? 1.65 + pointer.y * 0.11 : 1.65;
    const targetZ = animate ? 15.85 + Math.cos(state.clock.elapsedTime * 0.035) * 0.03 : 15.85;
    const easing = 1 - Math.exp(-delta * 2.2);

    camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, easing);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, easing);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, easing);
    camera.lookAt(0.15, -0.08, 0);
  });

  return null;
}

function getSceneCounts(width: number, quality: QualityLevel) {
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  if (isMobile) {
    if (quality === 'low') return { galaxy: 12000, dust: 1600, background: 900, shooting: 0, nebula: 0.18 };
    if (quality === 'high') return { galaxy: 18500, dust: 2800, background: 1600, shooting: 2, nebula: 0.24 };
    return { galaxy: 15000, dust: 2200, background: 1200, shooting: 1, nebula: 0.21 };
  }

  if (isTablet) {
    if (quality === 'low') return { galaxy: 19500, dust: 2700, background: 1500, shooting: 2, nebula: 0.2 };
    if (quality === 'high') return { galaxy: 30000, dust: 4700, background: 2500, shooting: 2, nebula: 0.27 };
    return { galaxy: 24500, dust: 3700, background: 1900, shooting: 1, nebula: 0.23 };
  }

  if (quality === 'low') return { galaxy: 26000, dust: 3800, background: 2000, shooting: 3, nebula: 0.2 };
  if (quality === 'high') return { galaxy: 42000, dust: 7000, background: 3600, shooting: 5, nebula: 0.29 };
  return { galaxy: 34500, dust: 5400, background: 2800, shooting: 4, nebula: 0.25 };
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
      <NebulaShader animate={animate} opacity={counts.nebula} />
      <DepthStarLayers count={counts.background} animate={animate} pointerRef={pointerRef} />
      <GalaxyShader stars={counts.galaxy} dust={counts.dust} animate={animate} />
      <ShootingStars count={counts.shooting} animate={animate} />
    </>
  );
}

export default function GalaxyBackground() {
  const reducedMotion = useReducedMotion();
  const pointerRef = useGlobalPointer();
  const [quality, setQuality] = useState<QualityLevel>('balanced');
  const [maxDpr, setMaxDpr] = useState(1.3);

  const lowerQuality = () => {
    setQuality('low');
    setMaxDpr(1);
  };

  const raiseQuality = () => {
    setQuality('high');
    setMaxDpr(1.45);
  };

  return (
    <div className={styles.galaxy} aria-hidden="true">
      <Canvas
        frameloop={reducedMotion ? 'demand' : 'always'}
        dpr={[1, maxDpr]}
        camera={{
          position: [0.1, 1.65, 15.85],
          fov: 40,
          near: 0.1,
          far: 140,
        }}
        gl={{
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        }}
      >
        <color attach="background" args={['#01030a']} />

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
