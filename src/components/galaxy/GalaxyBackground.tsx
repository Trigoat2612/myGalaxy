'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';

import GalaxyShader from './GalaxyShader';
import NebulaShader from './NebulaShader';
import ShootingStars from './ShootingStars';
import DepthStarLayers from './DepthStarLayers';
import GalaxyExplorerOverlay from './GalaxyExplorerOverlay';
import GalaxyCinematicOverlay, { type CinematicStage } from './GalaxyCinematicOverlay';
import GalaxyAudioController from './GalaxyAudioController';
import InteractionController, { type InteractionState } from './InteractionController';
import {
  DEFAULT_CAMERA,
  GALAXY_HOTSPOTS,
  type GalaxyHotspotId,
} from './galaxyConfig';
import RendererDiagnostics from './rendering/RendererDiagnostics';
import { detectGalaxyRendererCapabilities } from './rendering/rendererCapabilities';
import styles from './GalaxyBackground.module.css';

type QualityLevel = 'low' | 'balanced' | 'high';

type PointerPosition = {
  x: number;
  y: number;
};

type CinematicRuntime = {
  active: boolean;
  startedAt: number | null;
  progress: number;
  stage: CinematicStage;
};

const CINEMATIC_DURATION = 4.85;
const CINEMATIC_SESSION_KEY = 'galaxy-cinematic-v3.2-seen';
const PRESENTATION_INTERVAL_MS = 4300;

const MOBILE_BREAKPOINT = 640;
const MOBILE_CAMERA_ZOOM = 21.5;
const MOBILE_CAMERA_FOV = 54;
const MOBILE_GALAXY_SCALE = 0.40;

function getViewportDefaultZoom() {
  if (typeof window === 'undefined') return DEFAULT_CAMERA.zoom;
  return window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_CAMERA_ZOOM : DEFAULT_CAMERA.zoom;
}

function getResponsiveGalaxyScale(width: number) {
  if (width < 430) return 0.36;
  if (width < MOBILE_BREAKPOINT) return MOBILE_GALAXY_SCALE;
  return 1;
}

function cinematicTimeWarp(t: number) {
  // Keep the flight almost linear, but soften only the start/end enough to
  // avoid a mechanical launch or landing. The lower blend preserves momentum.
  const clamped = THREE.MathUtils.clamp(t, 0, 1);
  const smoother = clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
  return THREE.MathUtils.lerp(clamped, smoother, 0.12);
}

function getCinematicStage(progress: number): CinematicStage {
  if (progress < 0.025) return 'loading';
  if (progress < 0.17) return 'deep-space';
  if (progress < 0.60) return 'approach';
  if (progress < 0.79) return 'core';
  if (progress < 1) return 'reveal';
  return 'complete';
}

function getMobileCinematicFov(progress: number) {
  const p = THREE.MathUtils.clamp(progress, 0, 1);

  // Start slightly tighter than the normal mobile camera, reach the most
  // cinematic framing around the nucleus, then return smoothly to the normal
  // mobile FOV before control is handed back to the user.
  if (p < 0.18) {
    return THREE.MathUtils.lerp(50, 48, p / 0.18);
  }

  if (p < 0.68) {
    return THREE.MathUtils.lerp(48, 45.5, (p - 0.18) / 0.50);
  }

  if (p < 0.82) {
    return THREE.MathUtils.lerp(45.5, 47.5, (p - 0.68) / 0.14);
  }

  const reveal = THREE.MathUtils.smoothstep(p, 0.82, 1.0);
  return THREE.MathUtils.lerp(47.5, MOBILE_CAMERA_FOV, reveal);
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

function usePageVisibility() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
}

function detectInitialQuality(): { quality: QualityLevel; maxDpr: number } {
  if (typeof window === 'undefined') return { quality: 'balanced', maxDpr: 1.25 };

  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const width = window.innerWidth;

  if (width < 640 || memory <= 4 || cores <= 4) {
    return { quality: 'low', maxDpr: 1 };
  }

  if (width >= 1280 && memory >= 8 && cores >= 8) {
    return { quality: 'balanced', maxDpr: 1.3 };
  }

  return { quality: 'balanced', maxDpr: 1.2 };
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

function AdaptiveSharpnessController({
  interactionRef,
  explorationEnabled,
  quality,
  baseDpr,
}: {
  interactionRef: RefObject<InteractionState>;
  explorationEnabled: boolean;
  quality: QualityLevel;
  baseDpr: number;
}) {
  const { size, setDpr } = useThree();
  const lastDprRef = useRef(baseDpr);

  useFrame(() => {
    if (size.width >= MOBILE_BREAKPOINT) return;

    const zoom = interactionRef.current?.zoom ?? MOBILE_CAMERA_ZOOM;
    const zoomDetail = explorationEnabled
      ? THREE.MathUtils.clamp((12 - zoom) / 6.5, 0, 1)
      : 0;

    const hardwareCap = quality === 'high' ? 1.7 : quality === 'balanced' ? 1.55 : 1.35;
    const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    const targetDpr = Math.min(
      deviceDpr,
      hardwareCap,
      THREE.MathUtils.lerp(Math.max(1, baseDpr), hardwareCap, zoomDetail),
    );

    if (Math.abs(targetDpr - lastDprRef.current) < 0.035) return;
    lastDprRef.current = targetDpr;
    setDpr(targetDpr);
  });

  useEffect(() => {
    return () => setDpr(baseDpr);
  }, [baseDpr, setDpr]);

  return null;
}

function CameraRig({
  pointerRef,
  interactionRef,
  cinematicRef,
  explorationEnabled,
  selectedHotspot,
  animate,
  onCinematicProgress,
  onCinematicComplete,
}: {
  pointerRef: RefObject<PointerPosition>;
  interactionRef: RefObject<InteractionState>;
  cinematicRef: RefObject<CinematicRuntime>;
  explorationEnabled: boolean;
  selectedHotspot: GalaxyHotspotId | null;
  animate: boolean;
  onCinematicProgress: (progress: number, stage: CinematicStage) => void;
  onCinematicComplete: () => void;
}) {
  const { camera, size } = useThree();
  const baseZoom = size.width < MOBILE_BREAKPOINT ? MOBILE_CAMERA_ZOOM : DEFAULT_CAMERA.zoom;
  const baseFov = size.width < MOBILE_BREAKPOINT ? MOBILE_CAMERA_FOV : 40;
  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    camera.fov = baseFov;
    camera.updateProjectionMatrix();
  }, [baseFov, camera]);

  const currentTargetRef = useRef(new THREE.Vector3(...DEFAULT_CAMERA.target));
  const lastReportedStageRef = useRef<CinematicStage>('loading');
  const lastReportedBucketRef = useRef(-1);

  const isMobileViewport = size.width < MOBILE_BREAKPOINT;

  const cinematicPositionCurve = useMemo(() => {
    // One cubic Bézier, not a chain of spline segments. Mobile gets its own
    // closer camera path while desktop preserves the established framing.
    const target = new THREE.Vector3(...DEFAULT_CAMERA.target);
    const cosPitch = Math.cos(DEFAULT_CAMERA.pitch);
    const finalPosition = target.clone().add(
      new THREE.Vector3(
        Math.sin(DEFAULT_CAMERA.yaw) * cosPitch * baseZoom,
        Math.sin(DEFAULT_CAMERA.pitch) * baseZoom,
        Math.cos(DEFAULT_CAMERA.yaw) * cosPitch * baseZoom,
      ),
    );

    if (isMobileViewport) {
      return new THREE.CubicBezierCurve3(
        // Start closer than desktop so the galaxy fills more of the portrait
        // viewport from the beginning of the cinematic.
        new THREE.Vector3(-0.92, 3.05, 21.1),
        new THREE.Vector3(-0.46, 2.35, 15.4),
        // Stronger nucleus pass than V3.1.6. The control point is intentionally
        // close, but the cubic curve keeps the tangent continuous.
        new THREE.Vector3(0.12, 0.30, 1.55),
        finalPosition,
      );
    }

    return new THREE.CubicBezierCurve3(
      new THREE.Vector3(-1.35, 3.75, 24.8),
      new THREE.Vector3(-0.62, 3.05, 19.7),
      new THREE.Vector3(0.18, 0.35, 2.5),
      finalPosition,
    );
  }, [baseZoom, isMobileViewport]);

  const cinematicTargetCurve = useMemo(
    () =>
      isMobileViewport
        ? new THREE.CubicBezierCurve3(
            new THREE.Vector3(0.12, 0.08, 0),
            new THREE.Vector3(0.10, 0.02, 0),
            new THREE.Vector3(0.035, -0.055, 0),
            new THREE.Vector3(...DEFAULT_CAMERA.target),
          )
        : new THREE.CubicBezierCurve3(
            new THREE.Vector3(0.22, 0.18, 0),
            new THREE.Vector3(0.18, 0.10, 0),
            new THREE.Vector3(0.07, -0.06, 0),
            new THREE.Vector3(...DEFAULT_CAMERA.target),
          ),
    [isMobileViewport],
  );

  useFrame((state, delta) => {
    const pointer = pointerRef.current ?? { x: 0, y: 0 };
    const interaction = interactionRef.current;
    const cinematic = cinematicRef.current;
    if (!interaction || !cinematic) return;

    if (cinematic.active) {
      if (cinematic.startedAt === null) {
        cinematic.startedAt = state.clock.elapsedTime;
        if (isMobileViewport) {
          camera.position.set(-0.92, 3.05, 21.1);
          currentTargetRef.current.set(0.12, 0.08, 0);
        } else {
          camera.position.set(-1.35, 3.75, 24.8);
          currentTargetRef.current.set(0.22, 0.18, 0);
        }
        camera.lookAt(currentTargetRef.current);
      }

      const elapsed = state.clock.elapsedTime - cinematic.startedAt;
      const rawProgress = THREE.MathUtils.clamp(elapsed / CINEMATIC_DURATION, 0, 1);
      const travel = cinematicTimeWarp(rawProgress);
      cinematic.progress = rawProgress;
      cinematic.stage = getCinematicStage(rawProgress);

      if (camera instanceof THREE.PerspectiveCamera && isMobileViewport) {
        const cinematicFov = getMobileCinematicFov(rawProgress);
        if (Math.abs(camera.fov - cinematicFov) > 0.02) {
          camera.fov = cinematicFov;
          camera.updateProjectionMatrix();
        }
      }

      const bucket = Math.floor(rawProgress * 60);
      if (bucket !== lastReportedBucketRef.current || cinematic.stage !== lastReportedStageRef.current) {
        lastReportedBucketRef.current = bucket;
        lastReportedStageRef.current = cinematic.stage;
        onCinematicProgress(rawProgress, cinematic.stage);
      }

      const desiredPosition = cinematicPositionCurve.getPointAt(travel);
      const desiredTarget = cinematicTargetCurve.getPointAt(travel);

      // A tiny lateral drift keeps the movement organic without slowing it down.
      const driftEnvelope = Math.sin(Math.PI * rawProgress);
      desiredPosition.x += Math.sin(state.clock.elapsedTime * 0.9) * 0.018 * driftEnvelope;
      desiredPosition.y += Math.cos(state.clock.elapsedTime * 0.72) * 0.012 * driftEnvelope;

      // The spline already guarantees continuity. Copying the sampled position directly
      // removes the extra low-pass lag that made V2.4 feel paused between stages.
      camera.position.copy(desiredPosition);
      currentTargetRef.current.copy(desiredTarget);
      camera.lookAt(currentTargetRef.current);

      if (rawProgress >= 1) {
        cinematic.active = false;
        cinematic.stage = 'complete';
        interaction.yaw = DEFAULT_CAMERA.yaw;
        interaction.pitch = DEFAULT_CAMERA.pitch;
        interaction.zoom = baseZoom;
        interaction.targetYaw = DEFAULT_CAMERA.yaw;
        interaction.targetPitch = DEFAULT_CAMERA.pitch;
        interaction.targetZoom = baseZoom;
        if (camera instanceof THREE.PerspectiveCamera) {
          camera.fov = baseFov;
          camera.updateProjectionMatrix();
        }
        onCinematicComplete();
      }
      return;
    }

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
      desiredZoom = baseZoom + (animate ? Math.cos(state.clock.elapsedTime * 0.035) * 0.03 : 0);
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
  cinematicRef,
  cinematicStage,
  explorationEnabled,
  selectedHotspot,
  onSelectHotspot,
  onCinematicProgress,
  onCinematicComplete,
  maxDpr,
}: {
  quality: QualityLevel;
  animate: boolean;
  pointerRef: RefObject<PointerPosition>;
  interactionRef: RefObject<InteractionState>;
  cinematicRef: RefObject<CinematicRuntime>;
  cinematicStage: CinematicStage;
  explorationEnabled: boolean;
  selectedHotspot: GalaxyHotspotId | null;
  onSelectHotspot: (id: GalaxyHotspotId) => void;
  onCinematicProgress: (progress: number, stage: CinematicStage) => void;
  onCinematicComplete: () => void;
  maxDpr: number;
}) {
  const { size } = useThree();
  const counts = getSceneCounts(size.width, quality);
  const galaxyScale = getResponsiveGalaxyScale(size.width);
  const introActive = cinematicRef.current?.active ?? false;

  const showDepth = !introActive || cinematicStage !== 'loading';
  const showNebula = !introActive || ['approach', 'core', 'reveal', 'complete'].includes(cinematicStage);
  const showGalaxy = !introActive || ['approach', 'core', 'reveal', 'complete'].includes(cinematicStage);
  const showShooting = !introActive || ['reveal', 'complete'].includes(cinematicStage);

  return (
    <>
      <AdaptiveSharpnessController
        interactionRef={interactionRef}
        explorationEnabled={explorationEnabled && !introActive}
        quality={quality}
        baseDpr={maxDpr}
      />
      <InteractionController enabled={explorationEnabled && !introActive} interactionRef={interactionRef} />
      <CameraRig
        pointerRef={pointerRef}
        interactionRef={interactionRef}
        cinematicRef={cinematicRef}
        explorationEnabled={explorationEnabled}
        selectedHotspot={selectedHotspot}
        animate={animate}
        onCinematicProgress={onCinematicProgress}
        onCinematicComplete={onCinematicComplete}
      />
      {showNebula && <NebulaShader animate={animate} opacity={counts.nebula} />}
      {showDepth && <DepthStarLayers count={counts.background} animate={animate} pointerRef={pointerRef} />}
      {showGalaxy && (
        <group scale={galaxyScale}>
          <GalaxyShader
            stars={counts.galaxy}
            dust={counts.dust}
            animate={animate}
            explorationEnabled={explorationEnabled && !introActive}
            selectedHotspot={selectedHotspot}
            onSelectHotspot={onSelectHotspot}
            interactionRef={interactionRef}
          />
        </group>
      )}
      {showShooting && <ShootingStars count={counts.shooting} animate={animate} />}
    </>
  );
}

export default function GalaxyBackground() {
  const reducedMotion = useReducedMotion();
  const pageVisible = usePageVisibility();
  const pointerRef = useGlobalPointer();
  const initialQuality = useMemo(() => detectInitialQuality(), []);
  const rendererCapabilities = useMemo(() => detectGalaxyRendererCapabilities(), []);
  const initialViewportZoom = useMemo(() => getViewportDefaultZoom(), []);
  const interactionRef = useRef<InteractionState>({
    yaw: DEFAULT_CAMERA.yaw,
    pitch: DEFAULT_CAMERA.pitch,
    zoom: initialViewportZoom,
    targetYaw: DEFAULT_CAMERA.yaw,
    targetPitch: DEFAULT_CAMERA.pitch,
    targetZoom: initialViewportZoom,
  });
  const cinematicRef = useRef<CinematicRuntime>({
    active: false,
    startedAt: null,
    progress: 0,
    stage: 'loading',
  });

  const [quality, setQuality] = useState<QualityLevel>(initialQuality.quality);
  const [maxDpr, setMaxDpr] = useState(initialQuality.maxDpr);
  const lastQualityChangeRef = useRef(0);
  const [explorationEnabled, setExplorationEnabled] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<GalaxyHotspotId | null>(null);
  const [cinematicActive, setCinematicActive] = useState(false);
  const [cinematicStage, setCinematicStage] = useState<CinematicStage>('loading');
  const [cinematicProgress, setCinematicProgress] = useState(0);
  const [presentationActive, setPresentationActive] = useState(false);

  useEffect(() => {
    const alreadySeen = sessionStorage.getItem(CINEMATIC_SESSION_KEY) === '1';
    const shouldPlay = !reducedMotion && !alreadySeen;

    cinematicRef.current.active = shouldPlay;
    cinematicRef.current.startedAt = null;
    cinematicRef.current.progress = shouldPlay ? 0 : 1;
    cinematicRef.current.stage = shouldPlay ? 'loading' : 'complete';

    setCinematicActive(shouldPlay);
    setCinematicStage(shouldPlay ? 'loading' : 'complete');
    setCinematicProgress(shouldPlay ? 0 : 1);
  }, [reducedMotion]);

  useEffect(() => {
    document.body.classList.toggle('galaxy-exploring', explorationEnabled);
    return () => document.body.classList.remove('galaxy-exploring');
  }, [explorationEnabled]);

  const canChangeQuality = () => {
    const now = performance.now();
    if (cinematicRef.current.active || now - lastQualityChangeRef.current < 8000) return false;
    lastQualityChangeRef.current = now;
    return true;
  };

  const lowerQuality = () => {
    if (!canChangeQuality()) return;
    setQuality('low');
    setMaxDpr(1);
  };

  const raiseQuality = () => {
    if (!canChangeQuality()) return;

    const nav = navigator as Navigator & { deviceMemory?: number };
    const capable = (nav.deviceMemory ?? 8) >= 6 && (nav.hardwareConcurrency ?? 8) >= 6;
    setQuality(capable ? 'high' : 'balanced');
    setMaxDpr(capable ? 1.35 : 1.2);
  };

  const finishCinematic = useCallback(() => {
    cinematicRef.current.active = false;
    cinematicRef.current.progress = 1;
    cinematicRef.current.stage = 'complete';
    setCinematicActive(false);
    setCinematicProgress(1);
    setCinematicStage('complete');
    sessionStorage.setItem(CINEMATIC_SESSION_KEY, '1');
  }, []);

  const skipCinematic = () => {
    cinematicRef.current.active = false;
    cinematicRef.current.startedAt = null;
    const interaction = interactionRef.current;
    interaction.yaw = DEFAULT_CAMERA.yaw;
    interaction.pitch = DEFAULT_CAMERA.pitch;
    const defaultZoom = getViewportDefaultZoom();
    interaction.zoom = defaultZoom;
    interaction.targetYaw = DEFAULT_CAMERA.yaw;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = defaultZoom;
    finishCinematic();
  };

  const handleCinematicProgress = useCallback((progress: number, stage: CinematicStage) => {
    setCinematicProgress(progress);
    setCinematicStage(stage);
  }, []);

  const resetCamera = useCallback(() => {
    const interaction = interactionRef.current;
    const defaultZoom = getViewportDefaultZoom();
    interaction.targetYaw = DEFAULT_CAMERA.yaw;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = defaultZoom;
    setSelectedHotspot(null);
  }, []);

  const selectHotspot = useCallback((id: GalaxyHotspotId | null) => {
    if (cinematicRef.current.active) return;
    setSelectedHotspot(id);
    const interaction = interactionRef.current;
    interaction.targetYaw = 0;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = id
      ? GALAXY_HOTSPOTS.find((item) => item.id === id)?.zoom ?? getViewportDefaultZoom()
      : getViewportDefaultZoom();
  }, []);

  useEffect(() => {
    if (!presentationActive || cinematicActive) return;

    setExplorationEnabled(true);
    let index = 0;
    selectHotspot(GALAXY_HOTSPOTS[index].id);

    const timer = window.setInterval(() => {
      index = (index + 1) % GALAXY_HOTSPOTS.length;
      selectHotspot(GALAXY_HOTSPOTS[index].id);
    }, PRESENTATION_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [cinematicActive, presentationActive, selectHotspot]);

  const togglePresentation = () => {
    if (cinematicRef.current.active) return;
    setPresentationActive((current) => !current);
    setExplorationEnabled(true);
  };

  const manualSelectHotspot = (id: GalaxyHotspotId | null) => {
    setPresentationActive(false);
    selectHotspot(id);
  };

  const handleResetCamera = () => {
    setPresentationActive(false);
    resetCamera();
  };

  const toggleExploration = () => {
    if (cinematicRef.current.active) return;
    if (explorationEnabled) {
      setPresentationActive(false);
      resetCamera();
    }
    setExplorationEnabled(!explorationEnabled);
  };

  if (!rendererCapabilities.webgl2Available) {
    return (
      <div className={styles.webglFallback} role="img" aria-label="Fondo espacial estático. WebGL no está disponible en este dispositivo.">
        <span className={styles.webglFallbackStar} aria-hidden="true" />
        <RendererDiagnostics />
      </div>
    );
  }

  return (
    <>
      <div
        className={`${styles.galaxy} ${explorationEnabled ? styles.galaxyInteractive : ''}`}
        aria-hidden="true"
      >
        <Canvas
          frameloop={!pageVisible ? 'never' : reducedMotion ? 'demand' : 'always'}
          dpr={[1, maxDpr]}
          camera={{
            position: cinematicActive
              ? [-1.35, 3.75, 24.8]
              : [0.15, Math.sin(DEFAULT_CAMERA.pitch) * initialViewportZoom, Math.cos(DEFAULT_CAMERA.pitch) * initialViewportZoom],
            fov: typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_CAMERA_FOV : 40,
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
              animate={!reducedMotion && pageVisible}
              pointerRef={pointerRef}
              interactionRef={interactionRef}
              cinematicRef={cinematicRef}
              cinematicStage={cinematicStage}
              explorationEnabled={explorationEnabled}
              selectedHotspot={selectedHotspot}
              onSelectHotspot={(id) => manualSelectHotspot(id)}
              onCinematicProgress={handleCinematicProgress}
              onCinematicComplete={finishCinematic}
              maxDpr={maxDpr}
            />
          </PerformanceMonitor>
        </Canvas>
      </div>

      {selectedHotspot && !cinematicActive && (
        <div key={selectedHotspot} className={styles.selectionFeedback} aria-hidden="true" />
      )}

      <GalaxyCinematicOverlay
        active={cinematicActive}
        stage={cinematicStage}
        progress={cinematicProgress}
        onSkip={skipCinematic}
      />

      <GalaxyAudioController hidden={cinematicActive} />

      <div className={cinematicActive ? styles.explorerHiddenDuringIntro : undefined}>
        <GalaxyExplorerOverlay
          enabled={explorationEnabled}
          selected={selectedHotspot}
          presentationActive={presentationActive}
          onToggle={toggleExploration}
          onReset={handleResetCamera}
          onSelect={manualSelectHotspot}
          onTogglePresentation={togglePresentation}
        />
      </div>

      <RendererDiagnostics />
    </>
  );
}
