'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

import GalaxyShader from './GalaxyShader';
import NebulaShader from './NebulaShader';
import ShootingStars from './ShootingStars';
import DepthStarLayers from './DepthStarLayers';
import GalaxyExplorerOverlay from './GalaxyExplorerOverlay';
import InteractionController, { type InteractionState } from './InteractionController';
import {
  DEFAULT_CAMERA,
  GALAXY_HOTSPOTS,
  type GalaxyHotspotId,
} from './galaxyConfig';
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
  interactionRef,
  explorationEnabled,
  selectedHotspot,
  animate,
}: {
  pointerRef: RefObject<PointerPosition>;
  interactionRef: RefObject<InteractionState>;
  explorationEnabled: boolean;
  selectedHotspot: GalaxyHotspotId | null;
  animate: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const currentTargetRef = useRef(new THREE.Vector3(...DEFAULT_CAMERA.target));

  useFrame((state, delta) => {
    const pointer = pointerRef.current ?? { x: 0, y: 0 };
    const interaction = interactionRef.current;
    if (!interaction) return;

    const hotspot = selectedHotspot
      ? GALAXY_HOTSPOTS.find((item) => item.id === selectedHotspot) ?? null
      : null;

    const desiredTarget = hotspot
      ? new THREE.Vector3(...hotspot.cameraTarget)
      : new THREE.Vector3(...DEFAULT_CAMERA.target);

    if (!explorationEnabled && animate) {
      desiredTarget.x += pointer.x * 0.035;
      desiredTarget.y += pointer.y * 0.018;
    }

    const targetEasing = 1 - Math.exp(-delta * (hotspot ? 2.8 : 2.1));
    currentTargetRef.current.lerp(desiredTarget, targetEasing);

    let desiredYaw = interaction.targetYaw;
    let desiredPitch = interaction.targetPitch;
    let desiredZoom = interaction.targetZoom;

    if (!explorationEnabled) {
      const idleYaw = animate ? Math.sin(state.clock.elapsedTime * 0.05) * 0.0025 : 0;
      desiredYaw = pointer.x * 0.011 + idleYaw;
      desiredPitch = DEFAULT_CAMERA.pitch - pointer.y * 0.006;
      desiredZoom = DEFAULT_CAMERA.zoom + (animate ? Math.cos(state.clock.elapsedTime * 0.035) * 0.03 : 0);
    }

    const orbitEasing = 1 - Math.exp(-delta * 3.0);
    interaction.yaw = THREE.MathUtils.lerp(interaction.yaw, desiredYaw, orbitEasing);
    interaction.pitch = THREE.MathUtils.lerp(interaction.pitch, desiredPitch, orbitEasing);
    interaction.zoom = THREE.MathUtils.lerp(interaction.zoom, desiredZoom, orbitEasing);

    const cosPitch = Math.cos(interaction.pitch);
    const offset = new THREE.Vector3(
      Math.sin(interaction.yaw) * cosPitch * interaction.zoom,
      Math.sin(interaction.pitch) * interaction.zoom,
      Math.cos(interaction.yaw) * cosPitch * interaction.zoom,
    );

    const desiredPosition = currentTargetRef.current.clone().add(offset);
    const cameraEasing = 1 - Math.exp(-delta * 4.0);
    camera.position.lerp(desiredPosition, cameraEasing);
    camera.lookAt(currentTargetRef.current);
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
  interactionRef,
  explorationEnabled,
  selectedHotspot,
  onSelectHotspot,
}: {
  quality: QualityLevel;
  animate: boolean;
  pointerRef: RefObject<PointerPosition>;
  interactionRef: RefObject<InteractionState>;
  explorationEnabled: boolean;
  selectedHotspot: GalaxyHotspotId | null;
  onSelectHotspot: (id: GalaxyHotspotId) => void;
}) {
  const { size } = useThree();
  const counts = getSceneCounts(size.width, quality);

  return (
    <>
      <InteractionController enabled={explorationEnabled} interactionRef={interactionRef} />
      <CameraRig
        pointerRef={pointerRef}
        interactionRef={interactionRef}
        explorationEnabled={explorationEnabled}
        selectedHotspot={selectedHotspot}
        animate={animate}
      />
      <NebulaShader animate={animate} opacity={counts.nebula} />
      <DepthStarLayers count={counts.background} animate={animate} pointerRef={pointerRef} />
      <GalaxyShader
        stars={counts.galaxy}
        dust={counts.dust}
        animate={animate}
        explorationEnabled={explorationEnabled}
        selectedHotspot={selectedHotspot}
        onSelectHotspot={onSelectHotspot}
      />
      <ShootingStars count={counts.shooting} animate={animate} />
    </>
  );
}

export default function GalaxyBackground() {
  const reducedMotion = useReducedMotion();
  const pointerRef = useGlobalPointer();
  const interactionRef = useRef<InteractionState>({
    yaw: DEFAULT_CAMERA.yaw,
    pitch: DEFAULT_CAMERA.pitch,
    zoom: DEFAULT_CAMERA.zoom,
    targetYaw: DEFAULT_CAMERA.yaw,
    targetPitch: DEFAULT_CAMERA.pitch,
    targetZoom: DEFAULT_CAMERA.zoom,
  });

  const [quality, setQuality] = useState<QualityLevel>('balanced');
  const [maxDpr, setMaxDpr] = useState(1.3);
  const [explorationEnabled, setExplorationEnabled] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<GalaxyHotspotId | null>(null);

  useEffect(() => {
    document.body.classList.toggle('galaxy-exploring', explorationEnabled);
    return () => document.body.classList.remove('galaxy-exploring');
  }, [explorationEnabled]);

  const lowerQuality = () => {
    setQuality('low');
    setMaxDpr(1);
  };

  const raiseQuality = () => {
    setQuality('high');
    setMaxDpr(1.45);
  };

  const resetCamera = () => {
    const interaction = interactionRef.current;
    interaction.targetYaw = DEFAULT_CAMERA.yaw;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = DEFAULT_CAMERA.zoom;
    setSelectedHotspot(null);
  };

  const selectHotspot = (id: GalaxyHotspotId | null) => {
    setSelectedHotspot(id);
    const interaction = interactionRef.current;
    interaction.targetYaw = 0;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = id
      ? GALAXY_HOTSPOTS.find((item) => item.id === id)?.zoom ?? DEFAULT_CAMERA.zoom
      : DEFAULT_CAMERA.zoom;
  };

  const toggleExploration = () => {
    if (explorationEnabled) resetCamera();
    setExplorationEnabled(!explorationEnabled);
  };

  return (
    <>
      <div
        className={`${styles.galaxy} ${explorationEnabled ? styles.galaxyInteractive : ''}`}
        aria-hidden="true"
      >
        <Canvas
          frameloop={reducedMotion ? 'demand' : 'always'}
          dpr={[1, maxDpr]}
          camera={{
            position: [0.15, 1.58, 15.75],
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
              interactionRef={interactionRef}
              explorationEnabled={explorationEnabled}
              selectedHotspot={selectedHotspot}
              onSelectHotspot={(id) => selectHotspot(id)}
            />
          </PerformanceMonitor>
        </Canvas>
      </div>

      <GalaxyExplorerOverlay
        enabled={explorationEnabled}
        selected={selectedHotspot}
        onToggle={toggleExploration}
        onReset={resetCamera}
        onSelect={selectHotspot}
      />
    </>
  );
}
