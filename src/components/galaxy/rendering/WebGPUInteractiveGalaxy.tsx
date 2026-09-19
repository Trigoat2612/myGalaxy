'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import GalaxyAudioController from '../GalaxyAudioController';
import GalaxyCinematicOverlay, { type CinematicStage } from '../GalaxyCinematicOverlay';
import GalaxyExplorerOverlay from '../GalaxyExplorerOverlay';
import GalaxyPhotoModeOverlay, { type PhotoPreset } from '../GalaxyPhotoModeOverlay';
import { DEFAULT_CAMERA, GALAXY_HOTSPOTS, GALAXY_VISUAL_TUNING, type GalaxyHotspotId } from '../galaxyConfig';
import styles from '../GalaxyBackground.module.css';

import { ADAPTIVE_RENDER_SCALE, AdaptivePerformanceTracker, type AdaptivePerformanceTier } from './adaptivePerformance';

import {
  GPU_PARTICLE_PROFILES,
  detectGPUParticleQuality,
  type GPUParticleQuality,
} from './particleEngineConfig';

type RuntimeState = 'initializing' | 'running' | 'unsupported' | 'error';

type MigrationStats = {
  backend: string;
  quality: GPUParticleQuality;
  stars: number;
  migratedLayers: number;
  performanceTier: AdaptivePerformanceTier;
  fps: number;
};

type LayerData = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
};

type ShootingState = {
  group: any;
  delay: number;
  speed: number;
  angle: number;
  startX: number;
  startY: number;
  startZ: number;
};

type CosmicEventKind = 'stellar-birth';

type CosmicEventRuntime = {
  group: any;
  core: any;
  halo: any;
  ring: any;
  cloud: any;
  accent: any;
  spikeA: any;
  spikeB: any;
  coreMaterial: any;
  haloMaterial: any;
  ringMaterial: any;
  cloudMaterial: any;
  accentMaterial: any;
  spikeMaterial: any;
  cloudGeometry: any;
  accentGeometry: any;
  localPosition: any;
  active: boolean;
  kind: CosmicEventKind;
  elapsed: number;
  duration: number;
  nextIn: number;
};

type InteractionState = {
  yaw: number;
  pitch: number;
  zoom: number;
  targetYaw: number;
  targetPitch: number;
  targetZoom: number;
};

type ActivePointer = {
  id: number;
  x: number;
  y: number;
  pointerType: string;
};

type PerformanceMode = 'auto' | AdaptivePerformanceTier;

type CinematicRuntime = {
  active: boolean;
  startedAt: number | null;
  progress: number;
  stage: CinematicStage;
};

const MOBILE_BREAKPOINT = 640;
const MOBILE_CAMERA_ZOOM = 19.4;
const MOBILE_CAMERA_FOV = 54;
const DESKTOP_CAMERA_FOV = 40;
const MOBILE_MIN_ZOOM = 0.26;
const DESKTOP_MIN_ZOOM = 0.40;
const MOBILE_MAX_ZOOM = 36;
const DESKTOP_MAX_ZOOM = 28;
const CINEMATIC_DURATION = 4.85;
const CINEMATIC_SESSION_KEY = 'galaxy-webgpu-cinematic-v3.7.4-seen';
const PERFORMANCE_MODE_STORAGE_KEY = 'galaxy-performance-mode-v3.7.4';
const PRESENTATION_INTERVAL_MS = 4300;

const COSMIC_EVENT_MIN_DELAY = 1.1;
const COSMIC_EVENT_MAX_DELAY = 3.0;

const STAR_TUNING = GALAXY_VISUAL_TUNING.stars;
const DISC_GLOW_TUNING = GALAXY_VISUAL_TUNING.discGlow;
const VIEW_TUNING = GALAXY_VISUAL_TUNING.view;

const PARALLAX_TUNING = {
  normalStrength: 0.18,
  explorationStrength: 0.64,
  farX: 0.022,
  farY: 0.014,
  nearX: 0.070,
  nearY: 0.040,
  nebulaX: 0.010,
  nebulaY: 0.007,
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function smoothstep(value: number, min: number, max: number) {
  const t = clamp((value - min) / Math.max(0.0001, max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function getViewportDefaultZoom() {
  if (typeof window === 'undefined') return DEFAULT_CAMERA.zoom;
  return window.innerWidth < MOBILE_BREAKPOINT ? MOBILE_CAMERA_ZOOM : DEFAULT_CAMERA.zoom;
}

function cinematicTimeWarp(t: number) {
  const clamped = clamp(t, 0, 1);
  const smoother = clamped * clamped * clamped * (clamped * (clamped * 6 - 15) + 10);
  return lerp(clamped, smoother, 0.12);
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
  const p = clamp(progress, 0, 1);
  if (p < 0.18) return lerp(50, 48, p / 0.18);
  if (p < 0.68) return lerp(48, 45.5, (p - 0.18) / 0.50);
  if (p < 0.82) return lerp(45.5, 47.5, (p - 0.68) / 0.14);
  return lerp(47.5, MOBILE_CAMERA_FOV, smoothstep(p, 0.82, 1));
}

function getPointerDistance(a: ActivePointer, b: ActivePointer) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function createRandom(seed = 92837) {
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

function clampCount(value: number) {
  return Math.max(1, Math.floor(value));
}

export type WebGPUInteractiveGalaxyProps = {
  mode?: 'candidate' | 'production';
  onFallback?: (reason: 'unsupported' | 'error') => void;
};

export default function WebGPUInteractiveGalaxy({
  mode = 'candidate',
  onFallback,
}: WebGPUInteractiveGalaxyProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const hotspotLabelRefs = useRef<Record<GalaxyHotspotId, HTMLButtonElement | null>>({
    core: null,
    'inner-arm': null,
    cluster: null,
  });
  const explorationRef = useRef(false);
  const photoModeRef = useRef(false);
  const selectedHotspotRef = useRef<GalaxyHotspotId | null>(null);
  const interactionRef = useRef<InteractionState>({
    yaw: DEFAULT_CAMERA.yaw,
    pitch: DEFAULT_CAMERA.pitch,
    zoom: DEFAULT_CAMERA.zoom,
    targetYaw: DEFAULT_CAMERA.yaw,
    targetPitch: DEFAULT_CAMERA.pitch,
    targetZoom: DEFAULT_CAMERA.zoom,
  });
  const cinematicRef = useRef<CinematicRuntime>({
    active: false,
    startedAt: null,
    progress: 0,
    stage: 'loading',
  });
  const webgpuCaptureRef = useRef<((filename: string) => Promise<void>) | null>(null);
  const performanceModeRef = useRef<PerformanceMode>('auto');
  const photoPreviousStateRef = useRef<{ explorationEnabled: boolean; selectedHotspot: GalaxyHotspotId | null }>({
    explorationEnabled: false,
    selectedHotspot: null,
  });

  const [state, setState] = useState<RuntimeState>('initializing');
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [message, setMessage] = useState('Inicializando WebGPU + TSL · Differential Motion Safe…');
  const [explorationEnabled, setExplorationEnabled] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<GalaxyHotspotId | null>(null);
  const [presentationActive, setPresentationActive] = useState(false);
  const [cinematicActive, setCinematicActive] = useState(false);
  const [cinematicStage, setCinematicStage] = useState<CinematicStage>('loading');
  const [cinematicProgress, setCinematicProgress] = useState(0);
  const [photoModeActive, setPhotoModeActive] = useState(false);
  const [photoGridEnabled, setPhotoGridEnabled] = useState(false);
  const [photoPreset, setPhotoPreset] = useState<PhotoPreset>('general');
  const [photoCapturing, setPhotoCapturing] = useState(false);
  const [performanceMode, setPerformanceMode] = useState<PerformanceMode>('auto');
  const [utilityDockOpen, setUtilityDockOpen] = useState(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const alreadySeen = sessionStorage.getItem(CINEMATIC_SESSION_KEY) === '1';
    const shouldPlay = !reducedMotion && !alreadySeen;
    const defaultZoom = getViewportDefaultZoom();

    interactionRef.current = {
      yaw: DEFAULT_CAMERA.yaw,
      pitch: DEFAULT_CAMERA.pitch,
      zoom: defaultZoom,
      targetYaw: DEFAULT_CAMERA.yaw,
      targetPitch: DEFAULT_CAMERA.pitch,
      targetZoom: defaultZoom,
    };

    cinematicRef.current.active = shouldPlay;
    cinematicRef.current.startedAt = null;
    cinematicRef.current.progress = shouldPlay ? 0 : 1;
    cinematicRef.current.stage = shouldPlay ? 'loading' : 'complete';
    setCinematicActive(shouldPlay);
    setCinematicStage(shouldPlay ? 'loading' : 'complete');
    setCinematicProgress(shouldPlay ? 0 : 1);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('galaxy-exploring', explorationEnabled);
    return () => document.body.classList.remove('galaxy-exploring');
  }, [explorationEnabled]);

  useEffect(() => {
    photoModeRef.current = photoModeActive;
    document.body.classList.toggle('galaxy-photo-mode', photoModeActive);
    return () => {
      photoModeRef.current = false;
      document.body.classList.remove('galaxy-photo-mode');
    };
  }, [photoModeActive]);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(PERFORMANCE_MODE_STORAGE_KEY);
      if (stored === 'auto' || stored === 'eco' || stored === 'balanced' || stored === 'quality') {
        setPerformanceMode(stored);
      }
    } catch {}
  }, []);

  useEffect(() => {
    performanceModeRef.current = performanceMode;
    try {
      window.localStorage.setItem(PERFORMANCE_MODE_STORAGE_KEY, performanceMode);
    } catch {}
  }, [performanceMode]);

  const finishCinematic = useCallback(() => {
    cinematicRef.current.active = false;
    cinematicRef.current.startedAt = null;
    cinematicRef.current.progress = 1;
    cinematicRef.current.stage = 'complete';
    setCinematicActive(false);
    setCinematicStage('complete');
    setCinematicProgress(1);
    sessionStorage.setItem(CINEMATIC_SESSION_KEY, '1');
  }, []);

  const resetCamera = useCallback(() => {
    const defaultZoom = getViewportDefaultZoom();
    const interaction = interactionRef.current;
    interaction.targetYaw = DEFAULT_CAMERA.yaw;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = defaultZoom;
    selectedHotspotRef.current = null;
    setSelectedHotspot(null);
  }, []);

  const selectHotspot = useCallback((id: GalaxyHotspotId | null) => {
    if (cinematicRef.current.active) return;
    selectedHotspotRef.current = id;
    setSelectedHotspot(id);
    const interaction = interactionRef.current;
    interaction.targetYaw = 0;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = id
      ? GALAXY_HOTSPOTS.find((item) => item.id === id)?.zoom ?? getViewportDefaultZoom()
      : getViewportDefaultZoom();
  }, []);

  const skipCinematic = useCallback(() => {
    const interaction = interactionRef.current;
    const defaultZoom = getViewportDefaultZoom();
    interaction.yaw = DEFAULT_CAMERA.yaw;
    interaction.pitch = DEFAULT_CAMERA.pitch;
    interaction.zoom = defaultZoom;
    interaction.targetYaw = DEFAULT_CAMERA.yaw;
    interaction.targetPitch = DEFAULT_CAMERA.pitch;
    interaction.targetZoom = defaultZoom;
    finishCinematic();
  }, [finishCinematic]);

  const toggleExploration = useCallback(() => {
    if (cinematicRef.current.active) return;
    const next = !explorationRef.current;
    explorationRef.current = next;
    setExplorationEnabled(next);
    if (!next) {
      setPresentationActive(false);
      resetCamera();
    }
  }, [resetCamera]);

  const manualSelectHotspot = useCallback((id: GalaxyHotspotId | null) => {
    setPresentationActive(false);
    selectHotspot(id);
  }, [selectHotspot]);

  const handleResetCamera = useCallback(() => {
    setPresentationActive(false);
    resetCamera();
  }, [resetCamera]);

  const togglePresentation = useCallback(() => {
    if (cinematicRef.current.active) return;
    explorationRef.current = true;
    setExplorationEnabled(true);
    setPresentationActive((current) => !current);
  }, []);

  useEffect(() => {
    if (!presentationActive || cinematicActive) return;
    let index = 0;
    selectHotspot(GALAXY_HOTSPOTS[index].id);
    const timer = window.setInterval(() => {
      index = (index + 1) % GALAXY_HOTSPOTS.length;
      selectHotspot(GALAXY_HOTSPOTS[index].id);
    }, PRESENTATION_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [cinematicActive, presentationActive, selectHotspot]);

  const applyPhotoPreset = useCallback((preset: PhotoPreset) => {
    setPhotoPreset(preset);
    setPresentationActive(false);
    explorationRef.current = true;
    setExplorationEnabled(true);

    if (preset === 'general') {
      resetCamera();
      return;
    }

    selectHotspot(preset);
  }, [resetCamera, selectHotspot]);

  const enterPhotoMode = useCallback(() => {
    if (cinematicRef.current.active) return;
    photoPreviousStateRef.current = { explorationEnabled, selectedHotspot };
    setPresentationActive(false);
    explorationRef.current = true;
    setExplorationEnabled(true);
    setPhotoModeActive(true);
    applyPhotoPreset('general');
  }, [applyPhotoPreset, explorationEnabled, selectedHotspot]);

  const exitPhotoMode = useCallback(() => {
    const previous = photoPreviousStateRef.current;
    setPhotoModeActive(false);
    setPhotoGridEnabled(false);
    setPhotoPreset('general');
    explorationRef.current = previous.explorationEnabled;
    setExplorationEnabled(previous.explorationEnabled);

    if (previous.explorationEnabled && previous.selectedHotspot) {
      selectHotspot(previous.selectedHotspot);
    } else {
      resetCamera();
    }
  }, [resetCamera, selectHotspot]);

  useEffect(() => {
    if (!photoModeActive) return;

    const onPhotoKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') exitPhotoMode();
    };

    window.addEventListener('keydown', onPhotoKeyDown);
    return () => window.removeEventListener('keydown', onPhotoKeyDown);
  }, [exitPhotoMode, photoModeActive]);

  useEffect(() => {
    const onShortcutKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

      const key = event.key.toLowerCase();

      if (cinematicRef.current.active) return;

      if (key === 'r') {
        event.preventDefault();
        handleResetCamera();
        return;
      }

      if (key === 'p') {
        event.preventDefault();
        if (photoModeRef.current) exitPhotoMode();
        else enterPhotoMode();
      }
    };

    window.addEventListener('keydown', onShortcutKeyDown);
    return () => window.removeEventListener('keydown', onShortcutKeyDown);
  }, [enterPhotoMode, exitPhotoMode, handleResetCamera]);

  const capturePhoto = useCallback(async () => {
    const capture = webgpuCaptureRef.current;
    if (!capture || photoCapturing) return;

    setPhotoCapturing(true);
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

    try {
      const suffix = photoPreset === 'general' ? 'general' : photoPreset;
      await capture(`galaxia-v3.7.4-${suffix}.png`);
    } finally {
      setPhotoCapturing(false);
    }
  }, [photoCapturing, photoPreset]);

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function start() {
      const host = mountRef.current;
      if (!host) return;

      if (!('gpu' in navigator)) {
        setState('unsupported');
        setMessage('WebGPU no está disponible en este navegador. Se activará el fallback WebGL2.');
        onFallback?.('unsupported');
        return;
      }

      try {
        const THREE = await import('three/webgpu');
        const TSL = await import('three/tsl');

        if (disposed) return;

        const quality = detectGPUParticleQuality();
        const profile = GPU_PARTICLE_PROFILES[quality];
        const totalBudget = profile.count;

        const farCount = clampCount(totalBudget * 0.40);
        const nearCount = clampCount(totalBudget * 0.27);
        const galaxyCount = clampCount(totalBudget * 0.17);
        const dustCount = clampCount(totalBudget * 0.045);
        const coreCount = clampCount(totalBudget * 0.08);
        const clusterCount = clampCount(totalBudget * 0.095);
        const totalStars = farCount + nearCount + galaxyCount + dustCount + coreCount + clusterCount;

        const renderer = new THREE.WebGPURenderer({
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        });

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioMax));
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.setAnimationLoop(null);
        await renderer.init();

        if (disposed) {
          renderer.dispose();
          return;
        }

        host.replaceChildren(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#010208');

        let isMobile = host.clientWidth < MOBILE_BREAKPOINT;
        const getBaseZoom = () => (isMobile ? MOBILE_CAMERA_ZOOM : DEFAULT_CAMERA.zoom);
        const getBaseFov = () => (isMobile ? MOBILE_CAMERA_FOV : DESKTOP_CAMERA_FOV);
        const getMinZoom = () => (isMobile ? MOBILE_MIN_ZOOM : DESKTOP_MIN_ZOOM);
        const getMaxZoom = () => (isMobile ? MOBILE_MAX_ZOOM : DESKTOP_MAX_ZOOM);

        const camera = new THREE.PerspectiveCamera(
          getBaseFov(),
          Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
          0.1,
          160,
        );
        const currentTarget = new THREE.Vector3(...DEFAULT_CAMERA.target);
        const initialInteraction = interactionRef.current;
        const initialCosPitch = Math.cos(initialInteraction.pitch);
        camera.position.set(
          currentTarget.x + Math.sin(initialInteraction.yaw) * initialCosPitch * initialInteraction.zoom,
          currentTarget.y + Math.sin(initialInteraction.pitch) * initialInteraction.zoom,
          currentTarget.z + Math.cos(initialInteraction.yaw) * initialCosPitch * initialInteraction.zoom,
        );
        camera.lookAt(currentTarget);

        webgpuCaptureRef.current = async (filename: string) => {
          const width = Math.max(1, host.clientWidth);
          const height = Math.max(1, host.clientHeight);
          const previousPixelRatio = renderer.getPixelRatio();
          const exportPixelRatio = Math.min(3, Math.max(2, (window.devicePixelRatio || 1) * 1.5));

          renderer.setPixelRatio(exportPixelRatio);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();

          if (typeof renderer.renderAsync === 'function') {
            await renderer.renderAsync(scene, camera);
          } else {
            renderer.render(scene, camera);
          }

          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

          const blob = await new Promise<Blob | null>((resolve) => {
            renderer.domElement.toBlob(resolve, 'image/png', 1);
          });

          renderer.setPixelRatio(previousPixelRatio);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();

          if (!blob) throw new Error('No se pudo generar la captura PNG del canvas WebGPU.');

          const url = URL.createObjectURL(blob);
          const anchor = document.createElement('a');
          anchor.href = url;
          anchor.download = filename;
          document.body.appendChild(anchor);
          anchor.click();
          anchor.remove();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        };

        const root = new THREE.Group();
        root.rotation.x = VIEW_TUNING.rootTiltX;
        scene.add(root);

        const geometries: Array<{ dispose: () => void }> = [];
        const materials: Array<{ dispose: () => void }> = [];
        const shootingStates: ShootingState[] = [];

        function trackGeometry<T extends { dispose: () => void }>(geometry: T) {
          geometries.push(geometry);
          return geometry;
        }

        function trackMaterial<T extends { dispose: () => void }>(material: T) {
          materials.push(material);
          return material;
        }

        function createCosmicEventSystem(): CosmicEventRuntime {
          const group = new THREE.Group();
          group.visible = false;
          group.renderOrder = 18;
          scene.add(group);

          const coreGeometry = trackGeometry(new THREE.CircleGeometry(1, 40));
          const haloGeometry = trackGeometry(new THREE.CircleGeometry(1, 48));
          const ringGeometry = trackGeometry(new THREE.RingGeometry(0.82, 1, 56));
          const spikeGeometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
          const cloudGeometry = trackGeometry(new THREE.BufferGeometry());
          const accentGeometry = trackGeometry(new THREE.BufferGeometry());

          const cloudCount = 320;
          const accentCount = 220;
          const cloudPositions = new Float32Array(cloudCount * 3);
          const cloudColors = new Float32Array(cloudCount * 3);
          const accentPositions = new Float32Array(accentCount * 3);
          const accentColors = new Float32Array(accentCount * 3);
          cloudGeometry.setAttribute('position', new THREE.BufferAttribute(cloudPositions, 3));
          cloudGeometry.setAttribute('color', new THREE.BufferAttribute(cloudColors, 3));
          accentGeometry.setAttribute('position', new THREE.BufferAttribute(accentPositions, 3));
          accentGeometry.setAttribute('color', new THREE.BufferAttribute(accentColors, 3));

          const coreMaterial = trackMaterial(new THREE.MeshBasicMaterial({
            color: '#fff6df',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }));
          coreMaterial.visible = true;
          const haloMaterial = trackMaterial(new THREE.MeshBasicMaterial({
            color: '#9ebeff',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
          }));
          const ringMaterial = trackMaterial(new THREE.MeshBasicMaterial({
            color: '#c7d8ff',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            side: THREE.DoubleSide,
          }));
          const cloudMaterial = trackMaterial(new THREE.PointsMaterial({
            size: 0.075,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            vertexColors: true,
          }));
          const accentMaterial = trackMaterial(new THREE.PointsMaterial({
            size: 0.055,
            sizeAttenuation: true,
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            vertexColors: true,
          }));
          const spikeMaterial = trackMaterial(new THREE.MeshBasicMaterial({
            color: '#f4f8ff',
            transparent: true,
            opacity: 0,
            depthWrite: false,
            depthTest: false,
            blending: THREE.AdditiveBlending,
            toneMapped: false,
            side: THREE.DoubleSide,
          }));

          const halo = new THREE.Mesh(haloGeometry, haloMaterial);
          const ring = new THREE.Mesh(ringGeometry, ringMaterial);
          const core = new THREE.Mesh(coreGeometry, coreMaterial);
          const cloud = new THREE.Points(cloudGeometry, cloudMaterial);
          const accent = new THREE.Points(accentGeometry, accentMaterial);
          const spikeA = new THREE.Mesh(spikeGeometry, spikeMaterial);
          const spikeB = new THREE.Mesh(spikeGeometry, spikeMaterial);
          spikeA.rotation.z = 0;
          spikeB.rotation.z = Math.PI * 0.5;
          halo.renderOrder = 18;
          ring.renderOrder = 19;
          cloud.renderOrder = 20;
          accent.renderOrder = 21;
          spikeA.renderOrder = 22;
          spikeB.renderOrder = 22;
          core.renderOrder = 23;
          group.add(halo, ring, cloud, accent, spikeA, spikeB, core);

          const fillEventField = (kind: CosmicEventKind) => {
            const cloudPosition = cloudGeometry.getAttribute('position') as THREE.BufferAttribute;
            const cloudColor = cloudGeometry.getAttribute('color') as THREE.BufferAttribute;
            const accentPosition = accentGeometry.getAttribute('position') as THREE.BufferAttribute;
            const accentColor = accentGeometry.getAttribute('color') as THREE.BufferAttribute;
            const cloudPositionArray = cloudPosition.array as Float32Array;
            const cloudColorArray = cloudColor.array as Float32Array;
            const accentPositionArray = accentPosition.array as Float32Array;
            const accentColorArray = accentColor.array as Float32Array;

            const paint = (array: Float32Array, index: number, color: string, variation = 0) => {
              const c = new THREE.Color(color);
              if (variation > 0) {
                const drift = (Math.random() - 0.5) * variation;
                const hsl = { h: 0, s: 0, l: 0 };
                c.getHSL(hsl);
                c.setHSL(
                  THREE.MathUtils.euclideanModulo(hsl.h + drift, 1),
                  THREE.MathUtils.clamp(hsl.s + drift * 0.18, 0, 1),
                  THREE.MathUtils.clamp(hsl.l + drift * 0.12, 0, 1),
                );
              }
              array[index] = c.r;
              array[index + 1] = c.g;
              array[index + 2] = c.b;
            };
            const approxNormal = () => ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2;

            if (kind === 'stellar-birth') {
              cloudMaterial.size = 0.040;
              accentMaterial.size = 0.024;
              const lobeCenters = [
                [-0.36, 0.10],
                [-0.12, -0.10],
                [0.08, 0.18],
                [0.26, 0.02],
                [0.30, -0.12],
                [0.00, 0.28],
              ];
              for (let i = 0; i < cloudCount; i += 1) {
                const index = i * 3;
                const ambient = Math.random() < 0.30;
                if (ambient) {
                  const angle = Math.random() * Math.PI * 2;
                  const radius = 0.25 + Math.pow(Math.random(), 0.8) * 0.82;
                  cloudPositionArray[index] = Math.cos(angle) * radius * (0.90 + Math.random() * 0.35);
                  cloudPositionArray[index + 1] = Math.sin(angle) * radius * (0.52 + Math.random() * 0.34) + approxNormal() * 0.04;
                  cloudPositionArray[index + 2] = approxNormal() * 0.16;
                } else {
                  const lobe = lobeCenters[Math.floor(Math.random() * lobeCenters.length)];
                  cloudPositionArray[index] = lobe[0] + approxNormal() * (0.11 + Math.random() * 0.10);
                  cloudPositionArray[index + 1] = lobe[1] + approxNormal() * (0.08 + Math.random() * 0.10);
                  cloudPositionArray[index + 2] = approxNormal() * 0.14;
                }
                paint(cloudColorArray, index, Math.random() < 0.46 ? '#ff9a63' : Math.random() < 0.78 ? '#ffd1ae' : '#fff1de', 0.06);
              }
              for (let i = 0; i < accentCount; i += 1) {
                const index = i * 3;
                const lobe = lobeCenters[Math.floor(Math.random() * lobeCenters.length)];
                accentPositionArray[index] = lobe[0] + approxNormal() * (0.05 + Math.random() * 0.06);
                accentPositionArray[index + 1] = lobe[1] + approxNormal() * (0.04 + Math.random() * 0.05);
                accentPositionArray[index + 2] = approxNormal() * 0.09;
                paint(accentColorArray, index, Math.random() < 0.60 ? '#fff8ef' : '#ffd9bf', 0.04);
              }
              spikeA.visible = false;
              spikeB.visible = false;
            } else {
              cloudMaterial.size = 0.024;
              accentMaterial.size = 0.016;
              const crossArms = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5];
              const diagonalArms = [Math.PI * 0.25, Math.PI * 0.75, Math.PI * 1.25, Math.PI * 1.75];
              for (let i = 0; i < cloudCount; i += 1) {
                const index = i * 3;
                const useMainArm = Math.random() < 0.82;
                const armSet = useMainArm ? crossArms : diagonalArms;
                const arm = armSet[Math.floor(Math.random() * armSet.length)] + approxNormal() * (useMainArm ? 0.04 : 0.06);
                const radius = useMainArm
                  ? 0.02 + Math.pow(Math.random(), 0.82) * 0.34
                  : Math.pow(Math.random(), 1.9) * 0.16;
                const stretch = useMainArm ? (1.20 + Math.random() * 0.34) : (0.85 + Math.random() * 0.18);
                cloudPositionArray[index] = Math.cos(arm) * radius * stretch + approxNormal() * 0.006;
                cloudPositionArray[index + 1] = Math.sin(arm) * radius * stretch + approxNormal() * 0.006;
                cloudPositionArray[index + 2] = approxNormal() * 0.020;
                paint(cloudColorArray, index, Math.random() < 0.70 ? '#ffffff' : Math.random() < 0.88 ? '#eef4ff' : '#fff4db', 0.015);
              }
              for (let i = 0; i < accentCount; i += 1) {
                const index = i * 3;
                const arm = crossArms[Math.floor(Math.random() * crossArms.length)] + approxNormal() * 0.028;
                const radius = 0.01 + Math.pow(Math.random(), 0.95) * 0.22;
                accentPositionArray[index] = Math.cos(arm) * radius + approxNormal() * 0.004;
                accentPositionArray[index + 1] = Math.sin(arm) * radius + approxNormal() * 0.004;
                accentPositionArray[index + 2] = approxNormal() * 0.012;
                paint(accentColorArray, index, Math.random() < 0.84 ? '#ffffff' : '#dde9ff', 0.015);
              }
              spikeA.visible = true;
              spikeB.visible = true;
            }

            cloudPosition.needsUpdate = true;
            cloudColor.needsUpdate = true;
            accentPosition.needsUpdate = true;
            accentColor.needsUpdate = true;
            cloudGeometry.computeBoundingSphere();
            accentGeometry.computeBoundingSphere();
          };

          fillEventField('stellar-birth');

          return {
            group,
            core,
            halo,
            ring,
            cloud,
            accent,
            spikeA,
            spikeB,
            coreMaterial,
            haloMaterial,
            ringMaterial,
            cloudMaterial,
            accentMaterial,
            spikeMaterial,
            cloudGeometry,
            accentGeometry,
            localPosition: new THREE.Vector3(),
            active: false,
            kind: 'stellar-birth',
            elapsed: 0,
            duration: 2.4,
            nextIn: 12 + Math.random() * 12,
          };
        }

        function createParticleLayer(
          data: LayerData,
          options: {
            opacity: number;
            rotationSpeed: number;
            verticalMotion: number;
            twinkleSpeed: number;
            flow?: {
              directionX: number;
              directionZ: number;
              speed: number;
              strength: number;
              lateralStrength: number;
            };
            breath?: {
              speed: number;
              radialStrength: number;
              verticalStrength: number;
              glowStrength: number;
            };
            organic?: {
              speed: number;
              strength: number;
              verticalStrength: number;
            };
          },
        ) {
          const count = data.sizes.length;
          const positionAttribute = new THREE.InstancedBufferAttribute(data.positions, 3);
          const colorAttribute = new THREE.InstancedBufferAttribute(data.colors, 3);
          const sizeAttribute = new THREE.InstancedBufferAttribute(data.sizes, 1);
          const phaseAttribute = new THREE.InstancedBufferAttribute(data.phases, 1);

          const instancePosition = TSL.instancedBufferAttribute(positionAttribute);
          const instanceColor = TSL.instancedBufferAttribute(colorAttribute);
          const instanceSize = TSL.instancedBufferAttribute(sizeAttribute);
          const instancePhase = TSL.instancedBufferAttribute(phaseAttribute);

          const material = trackMaterial(new THREE.SpriteNodeMaterial());
          material.transparent = true;
          material.alphaTest = 0.06;
          material.depthWrite = false;
          material.blending = THREE.AdditiveBlending;

          material.positionNode = TSL.Fn(() => {
            const angle = TSL.time.mul(options.rotationSpeed).add(instancePhase.mul(0.0015));
            const c = TSL.cos(angle);
            const s = TSL.sin(angle);
            const baseX = instancePosition.x.mul(c).sub(instancePosition.z.mul(s));
            const baseZ = instancePosition.x.mul(s).add(instancePosition.z.mul(c));
            const baseY = instancePosition.y.add(
              TSL.sin(TSL.time.mul(0.16).add(instancePhase)).mul(options.verticalMotion),
            );

            if (options.flow) {
              const flowPhase = TSL.time.mul(options.flow.speed).sub(instancePhase);
              const forward = TSL.sin(flowPhase).mul(options.flow.strength);
              const lateral = TSL.sin(flowPhase.mul(0.57).add(instancePhase.mul(0.31)))
                .mul(options.flow.lateralStrength);
              const orthoX = -options.flow.directionZ;
              const orthoZ = options.flow.directionX;

              return TSL.vec3(
                baseX
                  .add(forward.mul(options.flow.directionX))
                  .add(lateral.mul(orthoX)),
                baseY.add(TSL.sin(flowPhase.mul(0.72)).mul(options.verticalMotion * 2.1)),
                baseZ
                  .add(forward.mul(options.flow.directionZ))
                  .add(lateral.mul(orthoZ)),
              );
            }

            if (options.breath) {
              const breathPhase = TSL.time.mul(options.breath.speed).add(instancePhase.mul(0.11));
              const breath = TSL.sin(breathPhase);
              const radialScale = breath.mul(options.breath.radialStrength).add(1.0);
              return TSL.vec3(
                baseX.mul(radialScale),
                baseY.add(breath.mul(options.breath.verticalStrength)),
                baseZ.mul(radialScale),
              );
            }

            if (options.organic) {
              const driftPhase = TSL.time.mul(options.organic.speed).add(instancePhase);
              const driftX = TSL.sin(driftPhase).mul(options.organic.strength);
              const driftZ = TSL.cos(driftPhase.mul(0.83).add(instancePhase.mul(0.37)))
                .mul(options.organic.strength);
              const driftY = TSL.sin(driftPhase.mul(1.17).add(instancePhase.mul(0.53)))
                .mul(options.organic.verticalStrength);
              return TSL.vec3(
                baseX.add(driftX),
                baseY.add(driftY),
                baseZ.add(driftZ),
              );
            }

            return TSL.vec3(baseX, baseY, baseZ);
          })();

          material.scaleNode = TSL.vec2(
            instanceSize.mul(
              TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
                .mul(0.03)
                .add(1.0),
            ).mul(
              options.breath
                ? TSL.sin(TSL.time.mul(options.breath.speed).add(instancePhase.mul(0.11)))
                    .mul(options.breath.glowStrength * 0.28)
                    .add(1.0)
                : 1.0,
            ),
          );

          material.colorNode = TSL.Fn(() => {
            const twinkle = TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
              .mul(0.07)
              .add(0.93);

            if (options.flow) {
              const flowGlow = TSL.sin(
                TSL.time.mul(options.flow.speed * 1.42).sub(instancePhase),
              ).mul(0.5).add(0.5);
              return instanceColor.mul(twinkle).mul(flowGlow.mul(0.18).add(0.94));
            }

            if (options.breath) {
              const nurseryGlow = TSL.sin(
                TSL.time.mul(options.breath.speed).add(instancePhase.mul(0.11)),
              ).mul(0.5).add(0.5);
              return instanceColor
                .mul(twinkle)
                .mul(nurseryGlow.mul(options.breath.glowStrength).add(0.92));
            }

            return instanceColor.mul(twinkle);
          })();

          material.opacityNode = TSL.Fn(() => {
            const centered = TSL.uv().sub(TSL.vec2(0.5));
            const radius = centered.length();
            const circle = TSL.step(radius, 0.5);
            const core = TSL.smoothstep(0.24, 0.0, radius);
            const halo = TSL.smoothstep(0.42, 0.12, radius);
            const twinkle = TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
              .mul(STAR_TUNING.twinkleAmplitude)
              .add(STAR_TUNING.twinkleBase);
            const baseOpacity = circle
              .mul(
                core
                  .mul(STAR_TUNING.spriteCoreWeight)
                  .add(halo.mul(STAR_TUNING.spriteHaloWeight))
                  .add(STAR_TUNING.spriteAmbientWeight),
              )
              .mul(twinkle)
              .mul(options.opacity);

            if (options.flow) {
              const flowGlow = TSL.sin(
                TSL.time.mul(options.flow.speed * 1.42).sub(instancePhase),
              ).mul(0.5).add(0.5);
              return baseOpacity.mul(flowGlow.mul(0.20).add(0.88));
            }

            if (options.breath) {
              const nurseryGlow = TSL.sin(
                TSL.time.mul(options.breath.speed).add(instancePhase.mul(0.11)),
              ).mul(0.5).add(0.5);
              return baseOpacity.mul(nurseryGlow.mul(options.breath.glowStrength * 0.52).add(0.88));
            }

            return baseOpacity;
          })();

          const geometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
          const mesh = new THREE.InstancedMesh(geometry, material, count);
          mesh.frustumCulled = false;
          return mesh;
        }

        function createDepthLayer(
          count: number,
          radiusMin: number,
          radiusMax: number,
          seed: number,
          palette: string[],
          sizeMin: number,
          sizeMax: number,
        ): LayerData {
          const random = createRandom(seed + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const paletteColors = palette.map((value) => new THREE.Color(value));

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const theta = random() * Math.PI * 2;
            const cosPhi = random() * 2 - 1;
            const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
            const radius = radiusMin + Math.pow(random(), 0.82) * (radiusMax - radiusMin);

            positions[i3] = radius * sinPhi * Math.cos(theta);
            positions[i3 + 1] = radius * cosPhi * 1.42;
            positions[i3 + 2] = radius * sinPhi * Math.sin(theta);

            const color = paletteColors[Math.min(paletteColors.length - 1, Math.floor(random() * paletteColors.length))];
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;

            sizes[i] = random() > 0.995
              ? sizeMax * (1.00 + random() * 0.12)
              : sizeMin + Math.pow(random(), 3.0) * (sizeMax - sizeMin);
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createGalaxyLayer(
          count: number,
          dust = false,
          radiusMinRatio = 0,
          radiusMaxRatio = 1,
        ): LayerData {
          const random = createRandom((dust ? 18871 : 99211) + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const branches = 4;
          const maxRadius = dust ? 14.2 : 13.4;
          const radiusMin = maxRadius * THREE.MathUtils.clamp(radiusMinRatio, 0, 1);
          const radiusMax = maxRadius * THREE.MathUtils.clamp(radiusMaxRatio, radiusMinRatio, 1);
          const warm = new THREE.Color('#ffd7a5');
          const neutral = new THREE.Color('#eef3ff');
          const blue = new THREE.Color('#a8c7ff');
          const dusty = new THREE.Color('#7182a7');
          const current = new THREE.Color();

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const radialSample = Math.pow(random(), dust ? 0.72 : 0.64);
            const radius = radiusMin + radialSample * Math.max(0.0001, radiusMax - radiusMin);
            const branch = i % branches;
            const branchAngle = (branch / branches) * Math.PI * 2;
            const spin = radius * (dust ? 0.30 : 0.31);
            const armAngle = branchAngle + spin;
            const freeAngle = random() * Math.PI * 2.3;
            const branchStrength = dust ? 0.58 : 0.46;
            const armBlend = branchStrength * (0.70 + (1 - Math.min(1, radius / maxRadius)) * 0.24);
            const angle = freeAngle + (armAngle - freeAngle) * armBlend + signedNoise(random) * (dust ? 0.20 : 0.13);
            const thickness = 0.155 + radius * (dust ? 0.034 : 0.028);

            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = signedNoise(random) * thickness;
            positions[i3 + 2] = Math.sin(angle) * radius * (0.79 + random() * 0.08);

            if (dust) {
              current.copy(dusty).offsetHSL(0, 0, (random() - 0.5) * 0.08);
            } else {
              const roll = random();
              current.copy(roll < 0.24 ? blue : roll < 0.79 ? neutral : warm);
              current.offsetHSL((random() - 0.5) * 0.01, 0, (random() - 0.5) * 0.065);
            }

            colors[i3] = current.r;
            colors[i3 + 1] = current.g;
            colors[i3 + 2] = current.b;
            sizes[i] = dust
              ? 0.008 + Math.pow(random(), 2.55) * 0.010
              : random() > 0.997
                ? 0.030 + random() * 0.015
                : 0.0085 + Math.pow(random(), 2.95) * 0.0135;
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createCoreLayer(count: number, radiusMinRatio = 0, radiusMaxRatio = 1): LayerData {
          const random = createRandom(71341 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const hot = new THREE.Color('#fff2d8');
          const warm = new THREE.Color('#ffd5a0');
          const cool = new THREE.Color('#d8e4ff');
          const current = new THREE.Color();
          const coreRadius = 1.86;
          const radiusMin = coreRadius * THREE.MathUtils.clamp(radiusMinRatio, 0, 1);
          const radiusMax = coreRadius * THREE.MathUtils.clamp(radiusMaxRatio, radiusMinRatio, 1);

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const angle = random() * Math.PI * 2;
            const radius = radiusMin + Math.pow(random(), 2.35) * Math.max(0.0001, radiusMax - radiusMin);
            const flatten = 0.74 + random() * 0.14;

            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = signedNoise(random) * (0.210 + radius * 0.082);
            positions[i3 + 2] = Math.sin(angle) * radius * flatten;

            const mix = random();
            current.copy(mix < 0.56 ? hot : mix < 0.88 ? warm : cool);
            current.offsetHSL((random() - 0.5) * 0.008, 0, (random() - 0.5) * 0.07);
            colors[i3] = current.r;
            colors[i3 + 1] = current.g;
            colors[i3 + 2] = current.b;

            sizes[i] = random() > 0.997
              ? 0.022 + random() * 0.008
              : 0.006 + Math.pow(random(), 3.4) * 0.0085;
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createLivingStreamLayer(count: number): LayerData {
          const random = createRandom(88421 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const streamAngle = -0.60;
          const streamDirX = Math.cos(streamAngle);
          const streamDirZ = Math.sin(streamAngle);
          const streamOrthoX = -streamDirZ;
          const streamOrthoZ = streamDirX;
          const softBlue = new THREE.Color('#8fc1ff');
          const neutralWhite = new THREE.Color('#f4f6ff');
          const warmWhite = new THREE.Color('#ffe4b8');

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const t = random() * 2 - 1;
            const branchRoll = random();

            if (branchRoll < 0.64) {
              const arcAngle = -1.10 + t * 1.05 + signedNoise(random) * 0.08;
              const arcRadius = 0.22 + (1 - Math.abs(t)) * 0.78 + random() * 0.10;
              const ringX = Math.cos(arcAngle) * arcRadius;
              const ringZ = Math.sin(arcAngle) * arcRadius * 0.26;
              const ringY = signedNoise(random) * 0.040;
              positions[i3] = streamDirX * ringZ + streamOrthoX * ringX;
              positions[i3 + 1] = ringY * 1.15;
              positions[i3 + 2] = streamDirZ * ringZ + streamOrthoZ * ringX;
            } else {
              const along = t * (0.98 + random() * 0.28);
              const width = (0.024 + (1 - Math.abs(t)) * 0.06) * Math.pow(random(), 0.58);
              const lateral = signedNoise(random) * width;
              const curve = Math.sin((t + 1) * Math.PI) * 0.18
                + Math.sin((t + 1) * Math.PI * 0.5) * 0.06;
              positions[i3] = streamDirX * along + streamOrthoX * (lateral + curve * 0.22);
              positions[i3 + 1] = signedNoise(random) * (0.030 + width * 0.38);
              positions[i3 + 2] = streamDirZ * along + streamOrthoZ * (lateral + curve);
            }

            const roll = random();
            const source = roll < 0.50 ? softBlue : roll < 0.84 ? neutralWhite : warmWhite;
            colors[i3] = source.r;
            colors[i3 + 1] = source.g;
            colors[i3 + 2] = source.b;
            sizes[i] = random() > 0.996
              ? 0.022 + random() * 0.010
              : 0.007 + Math.pow(random(), 2.7) * 0.010;

            // Correlate phase with position along the stream so brightness waves
            // travel through the feature instead of blinking randomly in place.
            phases[i] = ((t + 1) * 0.5) * Math.PI * 2 + signedNoise(random) * 0.24;
          }

          let meanX = 0;
          let meanY = 0;
          let meanZ = 0;
          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            meanX += positions[i3];
            meanY += positions[i3 + 1];
            meanZ += positions[i3 + 2];
          }
          if (count > 0) {
            meanX /= count;
            meanY /= count;
            meanZ /= count;
            for (let i = 0; i < count; i++) {
              const i3 = i * 3;
              positions[i3] -= meanX;
              positions[i3 + 1] -= meanY;
              positions[i3 + 2] -= meanZ;
            }
          }

          return { positions, colors, sizes, phases };
        }

        function createLivingNurseryLayer(count: number): LayerData {
          const random = createRandom(55331 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);

          const lobes = [
            { x: -0.18, z: 0.10, spreadX: 0.34, spreadZ: 0.22 },
            { x: 0.02, z: -0.06, spreadX: 0.32, spreadZ: 0.20 },
            { x: 0.18, z: 0.10, spreadX: 0.26, spreadZ: 0.18 },
            { x: -0.04, z: -0.18, spreadX: 0.24, spreadZ: 0.20 },
            { x: 0.08, z: 0.16, spreadX: 0.24, spreadZ: 0.18 },
          ];

          const hotBlue = new THREE.Color('#b7d7ff');
          const neutralWhite = new THREE.Color('#f4f6ff');
          const warmWhite = new THREE.Color('#ffe4b8');
          const redNebula = new THREE.Color('#ff9673');
          const orangeNebula = new THREE.Color('#ffc08a');
          const deepRed = new THREE.Color('#ff6e61');
          const current = new THREE.Color();

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const pass = random();
            const node = lobes[i % lobes.length];
            const shellAngle = random() * Math.PI * 2;
            const shellRadius = 0.18 + Math.pow(random(), 0.74) * 0.52;
            const shellX = Math.cos(shellAngle) * shellRadius * (0.82 + random() * 0.30);
            const shellZ = Math.sin(shellAngle) * shellRadius * (0.52 + random() * 0.18);
            const localX = signedNoise(random) * node.spreadX * (0.30 + random() * 0.95);
            const localZ = signedNoise(random) * node.spreadZ * (0.30 + random() * 0.95);
            const cavity = (shellX * shellX) / 0.070 + (shellZ * shellZ) / 0.026 < 0.34;

            if (pass < 0.40) {
              positions[i3] = shellX + signedNoise(random) * 0.06;
              positions[i3 + 1] = signedNoise(random) * 0.115;
              positions[i3 + 2] = shellZ + signedNoise(random) * 0.05;
              current.copy(pass < 0.18 ? deepRed : redNebula).lerp(orangeNebula, 0.34 + random() * 0.26);
            } else if (pass < 0.78) {
              positions[i3] = node.x + localX;
              positions[i3 + 1] = signedNoise(random) * 0.122;
              positions[i3 + 2] = node.z + localZ;
              const roll = random();
              current.copy(
                roll < 0.16
                  ? hotBlue
                  : roll < 0.54
                    ? neutralWhite
                    : roll < 0.80
                      ? warmWhite
                      : orangeNebula,
              );
            } else {
              const rimBoost = cavity ? 1.26 : 1.0;
              positions[i3] = shellX * rimBoost + signedNoise(random) * 0.03;
              positions[i3 + 1] = signedNoise(random) * 0.090;
              positions[i3 + 2] = shellZ * rimBoost + signedNoise(random) * 0.03;
              current.copy(warmWhite).lerp(neutralWhite, 0.28 + random() * 0.28);
            }

            colors[i3] = current.r;
            colors[i3 + 1] = current.g;
            colors[i3 + 2] = current.b;
            sizes[i] = random() > 0.996
              ? 0.022 + random() * 0.009
              : 0.0065 + Math.pow(random(), 2.55) * 0.009;

            const radialPhase = Math.atan2(positions[i3 + 2], positions[i3]);
            phases[i] = radialPhase * 0.32 + signedNoise(random) * 0.34;
          }

          return { positions, colors, sizes, phases };
        }

        function createClusterLayer(count: number): LayerData {
          const random = createRandom(44017 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);

          // Use the exact same source of truth as the hotspot markers/camera targets.
          // This prevents visual features from slowly diverging from their labels/centers.
          const streamHotspot = GALAXY_HOTSPOTS.find((hotspot) => hotspot.id === 'inner-arm');
          const cradleHotspot = GALAXY_HOTSPOTS.find((hotspot) => hotspot.id === 'cluster');
          const streamPosition = streamHotspot?.position ?? [4.10, 0.09, 1.40];
          const cradlePosition = cradleHotspot?.position ?? [-4.66, 0.17, -0.92];
          const streamCenter = { x: streamPosition[0], y: streamPosition[1], z: streamPosition[2] };
          const cradleCenter = { x: cradlePosition[0], y: cradlePosition[1], z: cradlePosition[2] };
          const streamAngle = -0.60;
          const streamDirX = Math.cos(streamAngle);
          const streamDirZ = Math.sin(streamAngle);
          const streamOrthoX = -streamDirZ;
          const streamOrthoZ = streamDirX;

          const cradleNebulaLobes = [
            { x: cradleCenter.x - 0.18, z: cradleCenter.z + 0.10, spreadX: 0.34, spreadZ: 0.22 },
            { x: cradleCenter.x + 0.02, z: cradleCenter.z - 0.06, spreadX: 0.32, spreadZ: 0.20 },
            { x: cradleCenter.x + 0.18, z: cradleCenter.z + 0.10, spreadX: 0.26, spreadZ: 0.18 },
            { x: cradleCenter.x - 0.04, z: cradleCenter.z - 0.18, spreadX: 0.24, spreadZ: 0.20 },
            { x: cradleCenter.x + 0.08, z: cradleCenter.z + 0.16, spreadX: 0.24, spreadZ: 0.18 },
          ];

          const scatterCenters = Array.from({ length: 7 }, () => {
            const radius = 2.8 + random() * 8.4;
            const angle = random() * Math.PI * 2.3;
            return {
              x: Math.cos(angle) * radius,
              z: Math.sin(angle) * radius * 0.8,
              spread: 0.16 + random() * 0.28,
            };
          });

          const hotBlue = new THREE.Color('#b7d7ff');
          const neutralWhite = new THREE.Color('#f4f6ff');
          const warmWhite = new THREE.Color('#ffe4b8');
          const redNebula = new THREE.Color('#ff9673');
          const orangeNebula = new THREE.Color('#ffc08a');
          const softBlue = new THREE.Color('#8fc1ff');
          const deepRed = new THREE.Color('#ff6e61');
          const current = new THREE.Color();

          const streamCount = 0;
          const cradleCount = 0;

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;

            if (i < streamCount) {
              const t = random() * 2 - 1;
              const branchRoll = random();

              if (branchRoll < 0.64) {
                const arcAngle = -1.10 + t * 1.05 + signedNoise(random) * 0.08;
                const arcRadius = 0.22 + (1 - Math.abs(t)) * 0.78 + random() * 0.10;
                const ringX = Math.cos(arcAngle) * arcRadius;
                const ringZ = Math.sin(arcAngle) * arcRadius * 0.26;
                const ringY = signedNoise(random) * 0.040;
                positions[i3] = streamCenter.x + streamDirX * ringZ + streamOrthoX * ringX;
                positions[i3 + 1] = streamCenter.y + ringY * 1.15;
                positions[i3 + 2] = streamCenter.z + streamDirZ * ringZ + streamOrthoZ * ringX;
              } else {
                const along = t * (0.98 + random() * 0.28);
                const width = (0.024 + (1 - Math.abs(t)) * 0.06) * Math.pow(random(), 0.58);
                const lateral = signedNoise(random) * width;
                const curve = Math.sin((t + 1) * Math.PI) * 0.18 + Math.sin((t + 1) * Math.PI * 0.5) * 0.06;
                positions[i3] = streamCenter.x + streamDirX * along + streamOrthoX * (lateral + curve * 0.22);
                positions[i3 + 1] = streamCenter.y + signedNoise(random) * (0.030 + width * 0.38);
                positions[i3 + 2] = streamCenter.z + streamDirZ * along + streamOrthoZ * (lateral + curve);
              }

              const roll = random();
              const source = roll < 0.50 ? softBlue : roll < 0.84 ? neutralWhite : warmWhite;
              colors[i3] = source.r;
              colors[i3 + 1] = source.g;
              colors[i3 + 2] = source.b;
              sizes[i] = random() > 0.996
                ? 0.022 + random() * 0.010
                : 0.007 + Math.pow(random(), 2.7) * 0.010;
              phases[i] = random() * Math.PI * 2;
              continue;
            }

            if (i < streamCount + cradleCount) {
              const pass = random();
              const node = cradleNebulaLobes[(i - streamCount) % cradleNebulaLobes.length];
              const shellAngle = random() * Math.PI * 2;
              const shellRadius = 0.18 + Math.pow(random(), 0.74) * 0.52;
              const shellX = Math.cos(shellAngle) * shellRadius * (0.82 + random() * 0.30);
              const shellZ = Math.sin(shellAngle) * shellRadius * (0.52 + random() * 0.18);
              const localX = signedNoise(random) * node.spreadX * (0.30 + random() * 0.95);
              const localZ = signedNoise(random) * node.spreadZ * (0.30 + random() * 0.95);
              const cavity = (shellX * shellX) / 0.070 + (shellZ * shellZ) / 0.026 < 0.34;

              if (pass < 0.40) {
                positions[i3] = cradleCenter.x + shellX + signedNoise(random) * 0.06;
                positions[i3 + 1] = cradleCenter.y + signedNoise(random) * 0.115;
                positions[i3 + 2] = cradleCenter.z + shellZ + signedNoise(random) * 0.05;
                current.copy(pass < 0.18 ? deepRed : redNebula).lerp(orangeNebula, 0.34 + random() * 0.26);
              } else if (pass < 0.78) {
                positions[i3] = node.x + localX;
                positions[i3 + 1] = cradleCenter.y + signedNoise(random) * 0.122;
                positions[i3 + 2] = node.z + localZ;
                const roll = random();
                current.copy(roll < 0.16 ? hotBlue : roll < 0.54 ? neutralWhite : roll < 0.80 ? warmWhite : orangeNebula);
              } else {
                const rimBoost = cavity ? 1.26 : 1.0;
                positions[i3] = cradleCenter.x + shellX * rimBoost + signedNoise(random) * 0.03;
                positions[i3 + 1] = cradleCenter.y + signedNoise(random) * 0.090;
                positions[i3 + 2] = cradleCenter.z + shellZ * rimBoost + signedNoise(random) * 0.03;
                current.copy(warmWhite).lerp(neutralWhite, 0.28 + random() * 0.28);
              }

              colors[i3] = current.r;
              colors[i3 + 1] = current.g;
              colors[i3 + 2] = current.b;
              sizes[i] = random() > 0.996
                ? 0.022 + random() * 0.009
                : 0.0065 + Math.pow(random(), 2.55) * 0.009;
              phases[i] = random() * Math.PI * 2;
              continue;
            }

            const center = scatterCenters[(i - streamCount - cradleCount) % scatterCenters.length];
            const spread = center.spread * (0.28 + Math.pow(random(), 1.8));
            const localAngle = random() * Math.PI * 2;
            const localRadius = spread * Math.sqrt(random());

            positions[i3] = center.x + Math.cos(localAngle) * localRadius;
            positions[i3 + 1] = signedNoise(random) * (0.035 + spread * 0.12);
            positions[i3 + 2] = center.z + Math.sin(localAngle) * localRadius;

            const roll = random();
            const source = roll < 0.22
              ? hotBlue
              : roll < 0.80
                ? neutralWhite
                : roll < 0.95
                  ? warmWhite
                  : redNebula;
            colors[i3] = source.r;
            colors[i3 + 1] = source.g;
            colors[i3 + 2] = source.b;
            sizes[i] = random() > 0.996
              ? 0.024 + random() * 0.010
              : 0.007 + Math.pow(random(), 2.8) * 0.010;
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createTSLGalaxyDisc() {
          const material = trackMaterial(new THREE.MeshBasicNodeMaterial());
          material.transparent = true;
          material.depthWrite = false;
          material.depthTest = false;
          material.blending = THREE.NormalBlending;

          const centered = TSL.uv().sub(TSL.vec2(0.5));
          const elliptical = TSL.vec2(centered.x.div(0.50), centered.y.div(0.43));
          const radius = elliptical.length();
          const edge = TSL.smoothstep(1.0, 0.60, radius);
          const coreGlow = TSL.smoothstep(0.44, 0.0, radius);
          const innerGlow = TSL.smoothstep(0.72, 0.12, radius);
          const waveA = TSL.sin(
            elliptical.x.mul(15.0)
              .add(elliptical.y.mul(11.0))
              .add(radius.mul(18.0))
              .sub(TSL.time.mul(0.025)),
          ).mul(0.5).add(0.5);
          const waveB = TSL.sin(
            elliptical.x.mul(-9.0)
              .add(elliptical.y.mul(17.0))
              .add(radius.mul(23.0))
              .add(1.7),
          ).mul(0.5).add(0.5);
          const filament = waveA.mul(waveB).mul(edge);

          material.colorNode = TSL.vec3(0.20, 0.28, 0.50)
            .mul(edge.mul(0.42))
            .add(TSL.vec3(1.0, 0.76, 0.46).mul(coreGlow.mul(DISC_GLOW_TUNING.coreColorWeight)))
            .add(TSL.vec3(0.56, 0.68, 1.0).mul(innerGlow.mul(DISC_GLOW_TUNING.innerColorWeight)))
            .add(TSL.vec3(0.38, 0.52, 0.94).mul(filament.mul(DISC_GLOW_TUNING.filamentColorWeight)));

          material.opacityNode = edge
            .mul(DISC_GLOW_TUNING.edgeOpacity)
            .add(coreGlow.mul(DISC_GLOW_TUNING.coreOpacity))
            .add(innerGlow.mul(DISC_GLOW_TUNING.innerOpacity))
            .add(filament.mul(DISC_GLOW_TUNING.filamentOpacity));

          const geometry = trackGeometry(new THREE.PlaneGeometry(27.5, 25.5));
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2;
          mesh.scale.set(1.24, 0.92, 1);
          mesh.renderOrder = -1;
          return mesh;
        }

        function createTSLNebula() {
          const material = trackMaterial(new THREE.MeshBasicNodeMaterial());
          material.transparent = true;
          material.side = THREE.BackSide;
          material.depthWrite = false;
          material.depthTest = false;
          material.blending = THREE.AdditiveBlending;

          const q = TSL.uv();
          const cloudA = TSL.sin(
            q.x.mul(19.0).add(q.y.mul(13.0)).add(TSL.time.mul(0.015)),
          ).mul(0.5).add(0.5);
          const cloudB = TSL.sin(
            q.x.mul(-11.0).add(q.y.mul(27.0)).sub(TSL.time.mul(0.010)).add(2.1),
          ).mul(0.5).add(0.5);
          const cloudC = TSL.sin(
            q.x.mul(31.0).sub(q.y.mul(7.0)).add(TSL.time.mul(0.006)).add(4.0),
          ).mul(0.5).add(0.5);
          const cloud = cloudA.mul(0.45).add(cloudB.mul(0.35)).add(cloudC.mul(0.20));
          const structure = TSL.smoothstep(0.48, 0.88, cloud);

          material.colorNode = TSL.vec3(0.12, 0.18, 0.42)
            .mul(cloud.mul(0.65))
            .add(TSL.vec3(0.31, 0.20, 0.48).mul(structure.mul(0.34)));
          material.opacityNode = cloud.mul(0.035).add(structure.mul(0.055));

          const geometry = trackGeometry(new THREE.SphereGeometry(46, 32, 20));
          const mesh = new THREE.Mesh(geometry, material);
          mesh.renderOrder = -10;
          return mesh;
        }

        function createTSLShootingStars() {
          const random = createRandom(55591);
          const group = new THREE.Group();
          group.rotation.x = 0.035;
          const count = isMobile ? 2 : quality === 'high' ? 5 : quality === 'balanced' ? 4 : 3;

          for (let i = 0; i < count; i++) {
            const starGroup = new THREE.Group();
            const tailLength = 1.35 + random() * 1.45;
            const tailWidth = 0.07 + random() * 0.045;

            const tailMaterial = trackMaterial(new THREE.MeshBasicNodeMaterial());
            tailMaterial.transparent = true;
            tailMaterial.depthWrite = false;
            tailMaterial.depthTest = false;
            tailMaterial.blending = THREE.AdditiveBlending;

            const tailUv = TSL.uv();
            const longitudinal = tailUv.x.mul(tailUv.x).mul(tailUv.x);
            const centeredY = TSL.abs(tailUv.y.sub(0.5));
            const vertical = TSL.smoothstep(0.5, 0.0, centeredY);
            const tailAlpha = longitudinal.mul(vertical).mul(0.36);
            tailMaterial.colorNode = TSL.vec3(0.43, 0.58, 0.96)
              .mul(TSL.float(1.0).sub(tailUv.x).mul(0.35).add(0.65))
              .add(TSL.vec3(0.90, 0.94, 1.0).mul(tailUv.x.mul(0.45)));
            tailMaterial.opacityNode = tailAlpha;

            const tailGeometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
            const tail = new THREE.Mesh(tailGeometry, tailMaterial);
            tail.scale.set(tailLength, tailWidth, 1);
            tail.position.x = tailLength * 0.5;
            starGroup.add(tail);

            const headMaterial = trackMaterial(new THREE.SpriteNodeMaterial());
            headMaterial.transparent = true;
            headMaterial.depthWrite = false;
            headMaterial.depthTest = false;
            headMaterial.blending = THREE.AdditiveBlending;
            const headUv = TSL.uv().sub(TSL.vec2(0.5));
            const headRadius = headUv.length();
            const headCore = TSL.smoothstep(0.18, 0.0, headRadius);
            const headHalo = TSL.smoothstep(0.5, 0.10, headRadius);
            const twinkle = TSL.sin(TSL.time.mul(3.1).add(i * 1.73)).mul(0.08).add(0.92);
            headMaterial.colorNode = TSL.vec3(0.68, 0.78, 1.0)
              .mul(headHalo.mul(0.52))
              .add(TSL.vec3(1.0, 0.94, 0.82).mul(headCore.mul(1.15)));
            headMaterial.opacityNode = headCore.mul(0.72).add(headHalo.mul(0.42)).mul(twinkle);
            headMaterial.scaleNode = TSL.vec2(0.19);

            const headGeometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
            const head = new THREE.InstancedMesh(headGeometry, headMaterial, 1);
            head.position.x = tailLength;
            head.frustumCulled = false;
            starGroup.add(head);

            const angle = -0.20 - random() * 0.33;
            const startX = -17 - random() * 7;
            const startY = random() > 0.26 ? 2.8 + random() * 8.2 : -0.5 + random() * 4.0;
            const startZ = -5.5 + random() * 10.5;
            starGroup.position.set(startX, startY, startZ);
            starGroup.rotation.z = angle;
            starGroup.visible = false;
            group.add(starGroup);

            shootingStates.push({
              group: starGroup,
              delay: 1.5 + i * 1.15 + random() * 5.0,
              speed: 4.4 + random() * 3.5,
              angle,
              startX,
              startY,
              startZ,
            });
          }

          return group;
        }

        function createTSLHotspotMarker(hotspot: (typeof GALAXY_HOTSPOTS)[number], index: number) {
          const group = new THREE.Group();
          group.position.set(...hotspot.position);

          const material = trackMaterial(new THREE.SpriteNodeMaterial());
          material.transparent = true;
          material.depthWrite = false;
          material.depthTest = false;
          material.blending = THREE.AdditiveBlending;

          const centered = TSL.uv().sub(TSL.vec2(0.5));
          const radius = centered.length();
          const coreMask = TSL.smoothstep(0.18, 0.0, radius);
          const haloMask = TSL.smoothstep(0.44, 0.10, radius);
          const isCore = hotspot.id === 'core';
          const isCradle = hotspot.id === 'cluster';
          const pulse = isCradle
            ? TSL.sin(TSL.time.mul(1.65 + index * 0.16).add(index * 1.9)).mul(0.12).add(0.96)
            : TSL.sin(TSL.time.mul(1.2 + index * 0.14).add(index * 1.7)).mul(0.06).add(0.94);
          const haloStrength = isCore ? 0.38 : isCradle ? 0.14 : 0.09;
          const coreStrength = isCore ? 0.82 : isCradle ? 0.30 : 0.22;
          const markerScale = isCore ? 0.36 : isCradle ? 0.125 : 0.10;

          const palette = [
            [1.0, 0.82, 0.55],
            [0.55, 0.70, 1.0],
            [0.72, 0.62, 1.0],
          ] as const;
          const color = palette[index % palette.length];

          material.colorNode = TSL.vec3(color[0], color[1], color[2])
            .mul(haloMask.mul(haloStrength))
            .add(TSL.vec3(1.0, 0.96, 0.88).mul(coreMask.mul(coreStrength)));
          material.opacityNode = haloMask.mul(haloStrength).add(coreMask.mul(coreStrength)).mul(pulse);
          material.scaleNode = TSL.vec2(markerScale);

          const geometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
          const marker = new THREE.InstancedMesh(geometry, material, 1);
          marker.frustumCulled = false;
          marker.renderOrder = 12;
          group.add(marker);
          group.visible = false;
          root.add(group);
          return group;
        }

        const hotspotGroups = new Map<GalaxyHotspotId, any>();
        GALAXY_HOTSPOTS.forEach((hotspot, index) => {
          hotspotGroups.set(hotspot.id, createTSLHotspotMarker(hotspot, index));
        });

        const nebula = createTSLNebula();
        scene.add(nebula);

        const disc = createTSLGalaxyDisc();
        root.add(disc);

        const farStars = createParticleLayer(
          createDepthLayer(farCount, 20, 62, 1103, ['#8095c5', '#aab9d9', '#d5ddf0'], 0.010, 0.028),
          { opacity: STAR_TUNING.farOpacity, rotationSpeed: 0.0011, verticalMotion: 0.004, twinkleSpeed: 0.34 },
        );

        const nearStars = createParticleLayer(
          createDepthLayer(nearCount, 10, 38, 7411, ['#aec4f5', '#d9e4fb', '#f1f5ff'], 0.011, 0.034),
          { opacity: STAR_TUNING.nearOpacity, rotationSpeed: 0.0018, verticalMotion: 0.006, twinkleSpeed: 0.42 },
        );

        const galaxyInnerCount = Math.max(1, Math.floor(galaxyCount * 0.38));
        const galaxyMidCount = Math.max(1, Math.floor(galaxyCount * 0.37));
        const galaxyOuterCount = Math.max(1, galaxyCount - galaxyInnerCount - galaxyMidCount);

        const galaxyStarsInner = createParticleLayer(createGalaxyLayer(galaxyInnerCount, false, 0.00, 0.36), {
          opacity: STAR_TUNING.galaxyOpacity,
          rotationSpeed: 0.0145,
          verticalMotion: 0.0035,
          twinkleSpeed: 0.48,
        });

        const galaxyStarsMid = createParticleLayer(createGalaxyLayer(galaxyMidCount, false, 0.30, 0.68), {
          opacity: STAR_TUNING.galaxyOpacity,
          rotationSpeed: 0.0085,
          verticalMotion: 0.0033,
          twinkleSpeed: 0.46,
        });

        const galaxyStarsOuter = createParticleLayer(createGalaxyLayer(galaxyOuterCount, false, 0.62, 1.00), {
          opacity: STAR_TUNING.galaxyOpacity,
          rotationSpeed: 0.0042,
          verticalMotion: 0.0030,
          twinkleSpeed: 0.44,
        });

        const dustInnerCount = Math.max(1, Math.floor(dustCount * 0.46));
        const dustMidCount = Math.max(1, Math.floor(dustCount * 0.34));
        const dustOuterCount = Math.max(1, dustCount - dustInnerCount - dustMidCount);

        const galaxyDustInner = createParticleLayer(createGalaxyLayer(dustInnerCount, true, 0.00, 0.42), {
          opacity: STAR_TUNING.dustOpacity,
          rotationSpeed: 0.0080,
          verticalMotion: 0.0022,
          twinkleSpeed: 0.24,
        });

        const galaxyDustMid = createParticleLayer(createGalaxyLayer(dustMidCount, true, 0.34, 0.72), {
          opacity: STAR_TUNING.dustOpacity,
          rotationSpeed: 0.0048,
          verticalMotion: 0.0020,
          twinkleSpeed: 0.22,
        });

        const galaxyDustOuter = createParticleLayer(createGalaxyLayer(dustOuterCount, true, 0.66, 1.00), {
          opacity: STAR_TUNING.dustOpacity,
          rotationSpeed: 0.0024,
          verticalMotion: 0.0018,
          twinkleSpeed: 0.20,
        });

        const coreInnerCount = Math.max(1, Math.floor(coreCount * 0.62));
        const coreOuterCount = Math.max(1, coreCount - coreInnerCount);

        const coreInner = createParticleLayer(createCoreLayer(coreInnerCount, 0.00, 0.58), {
          opacity: STAR_TUNING.coreOpacity,
          rotationSpeed: 0.026,
          verticalMotion: 0.0032,
          twinkleSpeed: 0.58,
        });

        const coreOuter = createParticleLayer(createCoreLayer(coreOuterCount, 0.48, 1.00), {
          opacity: STAR_TUNING.coreOpacity,
          rotationSpeed: 0.014,
          verticalMotion: 0.0028,
          twinkleSpeed: 0.52,
        });

        const livingStreamCount = Math.max(1, Math.floor(clusterCount * 0.38));
        const livingNurseryCount = Math.max(1, Math.floor(clusterCount * 0.36));
        const staticClusterCount = Math.max(1, clusterCount - livingStreamCount - livingNurseryCount);
        const streamHotspot = GALAXY_HOTSPOTS.find((hotspot) => hotspot.id === 'inner-arm');
        const nurseryHotspot = GALAXY_HOTSPOTS.find((hotspot) => hotspot.id === 'cluster');
        const streamPosition = streamHotspot?.position ?? [4.10, 0.09, 1.40];
        const nurseryPosition = nurseryHotspot?.position ?? [-4.66, 0.17, -0.92];
        const streamAngle = -0.60;
        const livingStream = createParticleLayer(createLivingStreamLayer(livingStreamCount), {
          opacity: Math.min(1, STAR_TUNING.clusterOpacity * 1.06),
          rotationSpeed: 0,
          verticalMotion: 0.0040,
          twinkleSpeed: 0.74,
          flow: {
            directionX: Math.cos(streamAngle),
            directionZ: Math.sin(streamAngle),
            speed: 0.62,
            strength: 0.050,
            lateralStrength: 0.016,
          },
        });
        const livingStreamGroup = new THREE.Group();
        livingStreamGroup.position.set(streamPosition[0], streamPosition[1], streamPosition[2]);
        livingStreamGroup.add(livingStream);
        livingStream.visible = true;
        livingStreamGroup.visible = true;

        const livingNursery = createParticleLayer(createLivingNurseryLayer(livingNurseryCount), {
          opacity: Math.min(1, STAR_TUNING.clusterOpacity * 1.18),
          rotationSpeed: 0,
          verticalMotion: 0.0027,
          twinkleSpeed: 0.86,
          breath: {
            speed: 0.54,
            radialStrength: 0.072,
            verticalStrength: 0.020,
            glowStrength: 0.40,
          },
        });
        const livingNurseryGroup = new THREE.Group();
        livingNurseryGroup.position.set(nurseryPosition[0], nurseryPosition[1], nurseryPosition[2]);
        livingNurseryGroup.add(livingNursery);

        const clusters = createParticleLayer(createClusterLayer(staticClusterCount), {
          opacity: STAR_TUNING.clusterOpacity * 0.86,
          // Restored from v3.7.1: spatially scattered small stellar clusters.
          // They remain persistent; only the stars inside each cluster drift subtly.
          // v3.7.4.15.1: stronger internal motion so each cluster feels more alive.
          rotationSpeed: 0,
          verticalMotion: 0.0042,
          twinkleSpeed: 0.68,
          organic: {
            speed: 0.32,
            strength: 0.022,
            verticalStrength: 0.010,
          },
        });

        farStars.renderOrder = -5;
        nearStars.renderOrder = -3;
        galaxyDustInner.renderOrder = 0;
        galaxyDustMid.renderOrder = 0;
        galaxyDustOuter.renderOrder = 0;
        galaxyStarsInner.renderOrder = 1;
        galaxyStarsMid.renderOrder = 1;
        galaxyStarsOuter.renderOrder = 1;
        coreInner.renderOrder = 2;
        coreOuter.renderOrder = 2;
        clusters.renderOrder = 3;
        livingNursery.renderOrder = 4;
        livingStream.renderOrder = 5;
        root.add(
          farStars,
          nearStars,
          galaxyDustInner,
          galaxyDustMid,
          galaxyDustOuter,
          galaxyStarsInner,
          galaxyStarsMid,
          galaxyStarsOuter,
          coreInner,
          coreOuter,
          livingStreamGroup,
          livingNurseryGroup,
          clusters,
        );

        const differentialLayers = [
          galaxyDustInner,
          galaxyDustMid,
          galaxyDustOuter,
          galaxyStarsInner,
          galaxyStarsMid,
          galaxyStarsOuter,
          coreInner,
          coreOuter,
        ];

        const updateParticleScale = (zoom: number) => {
          const baseZoom = getBaseZoom();
          const zoomRatio = THREE.MathUtils.clamp(zoom / baseZoom, 0.20, 1);
          farStars.scale.setScalar(THREE.MathUtils.lerp(0.94, 1, zoomRatio));
          nearStars.scale.setScalar(THREE.MathUtils.lerp(0.92, 1, zoomRatio));
          const dustScale = THREE.MathUtils.lerp(0.98, 1, zoomRatio);
          galaxyDustInner.scale.setScalar(dustScale);
          galaxyDustMid.scale.setScalar(dustScale);
          galaxyDustOuter.scale.setScalar(dustScale);
          const starScale = THREE.MathUtils.lerp(0.985, 1, zoomRatio);
          galaxyStarsInner.scale.setScalar(starScale);
          galaxyStarsMid.scale.setScalar(starScale);
          galaxyStarsOuter.scale.setScalar(starScale);
          coreInner.scale.setScalar(1);
          coreOuter.scale.setScalar(1);
          livingStream.scale.setScalar(1);
          livingNursery.scale.setScalar(1);
          clusters.scale.setScalar(1);
        };

        const enforceSemanticHotspotAnchors = () => {
          const streamHotspotNow = GALAXY_HOTSPOTS.find((hotspot) => hotspot.id === 'inner-arm');
          const nurseryHotspotNow = GALAXY_HOTSPOTS.find((hotspot) => hotspot.id === 'cluster');
          const currentStreamPosition = streamHotspotNow?.position ?? [3.98, 0.10, 1.32];
          const currentNurseryPosition = nurseryHotspotNow?.position ?? [-4.66, 0.17, -0.92];
          livingStreamGroup.position.set(currentStreamPosition[0], currentStreamPosition[1], currentStreamPosition[2]);
          livingNurseryGroup.position.set(currentNurseryPosition[0], currentNurseryPosition[1], currentNurseryPosition[2]);
        };

        updateParticleScale(initialInteraction.zoom);

        const shootingStars = createTSLShootingStars();
        scene.add(shootingStars);

        const cosmicEvent = createCosmicEventSystem();
        const cosmicWorldPosition = new THREE.Vector3();
        const reducedCosmicMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const configureCosmicEventVisual = (kind: CosmicEventKind) => {
          const cloudPosition = cosmicEvent.cloudGeometry.getAttribute('position') as THREE.BufferAttribute;
          const cloudColor = cosmicEvent.cloudGeometry.getAttribute('color') as THREE.BufferAttribute;
          const accentPosition = cosmicEvent.accentGeometry.getAttribute('position') as THREE.BufferAttribute;
          const accentColor = cosmicEvent.accentGeometry.getAttribute('color') as THREE.BufferAttribute;
          const cloudPositionArray = cloudPosition.array as Float32Array;
          const cloudColorArray = cloudColor.array as Float32Array;
          const accentPositionArray = accentPosition.array as Float32Array;
          const accentColorArray = accentColor.array as Float32Array;

          const paint = (array: Float32Array, index: number, color: string, variation = 0) => {
            const c = new THREE.Color(color);
            if (variation > 0) {
              const drift = (Math.random() - 0.5) * variation;
              const hsl = { h: 0, s: 0, l: 0 };
              c.getHSL(hsl);
              c.setHSL(
                THREE.MathUtils.euclideanModulo(hsl.h + drift, 1),
                THREE.MathUtils.clamp(hsl.s + drift * 0.18, 0, 1),
                THREE.MathUtils.clamp(hsl.l + drift * 0.12, 0, 1),
              );
            }
            array[index] = c.r;
            array[index + 1] = c.g;
            array[index + 2] = c.b;
          };

          const approxNormal = () => ((Math.random() + Math.random() + Math.random()) / 3 - 0.5) * 2;

          if (kind === 'stellar-birth') {
            cosmicEvent.cloudMaterial.size = 0.040;
            cosmicEvent.accentMaterial.size = 0.024;
            cosmicEvent.spikeA.visible = false;
            cosmicEvent.spikeB.visible = false;
            const lobeCenters = [
              [-0.36, 0.10],
              [-0.12, -0.10],
              [0.08, 0.18],
              [0.26, 0.02],
              [0.30, -0.12],
              [0.00, 0.28],
            ];
            for (let i = 0; i < cloudPositionArray.length; i += 3) {
              const ambient = Math.random() < 0.30;
              if (ambient) {
                const angle = Math.random() * Math.PI * 2;
                const radius = 0.25 + Math.pow(Math.random(), 0.8) * 0.82;
                cloudPositionArray[i] = Math.cos(angle) * radius * (0.90 + Math.random() * 0.35);
                cloudPositionArray[i + 1] = Math.sin(angle) * radius * (0.52 + Math.random() * 0.34) + approxNormal() * 0.04;
                cloudPositionArray[i + 2] = approxNormal() * 0.16;
              } else {
                const lobe = lobeCenters[Math.floor(Math.random() * lobeCenters.length)];
                cloudPositionArray[i] = lobe[0] + approxNormal() * (0.11 + Math.random() * 0.10);
                cloudPositionArray[i + 1] = lobe[1] + approxNormal() * (0.08 + Math.random() * 0.10);
                cloudPositionArray[i + 2] = approxNormal() * 0.14;
              }
              paint(cloudColorArray, i, Math.random() < 0.46 ? '#ff9a63' : Math.random() < 0.78 ? '#ffd1ae' : '#fff1de', 0.06);
            }
            for (let i = 0; i < accentPositionArray.length; i += 3) {
              const lobe = lobeCenters[Math.floor(Math.random() * lobeCenters.length)];
              accentPositionArray[i] = lobe[0] + approxNormal() * (0.05 + Math.random() * 0.06);
              accentPositionArray[i + 1] = lobe[1] + approxNormal() * (0.04 + Math.random() * 0.05);
              accentPositionArray[i + 2] = approxNormal() * 0.09;
              paint(accentColorArray, i, Math.random() < 0.60 ? '#fff8ef' : '#ffd9bf', 0.04);
            }
          } else {
            cosmicEvent.cloudMaterial.size = 0.034;
            cosmicEvent.accentMaterial.size = 0.021;
            cosmicEvent.spikeA.visible = false;
            cosmicEvent.spikeB.visible = false;
            const jets = [-2.7, -2.2, -1.4, -0.5, 0.15, 0.8, 1.55, 2.45];
            for (let i = 0; i < cloudPositionArray.length; i += 3) {
              if (Math.random() < 0.58) {
                const jet = jets[Math.floor(Math.random() * jets.length)] + approxNormal() * 0.18;
                const radius = 0.18 + Math.pow(Math.random(), 0.42) * 0.92;
                cloudPositionArray[i] = Math.cos(jet) * radius * (0.90 + Math.random() * 0.28);
                cloudPositionArray[i + 1] = Math.sin(jet) * radius * (0.76 + Math.random() * 0.26);
                cloudPositionArray[i + 2] = approxNormal() * 0.12;
              } else {
                const angle = Math.random() * Math.PI * 2;
                const shell = 0.22 + Math.pow(Math.random(), 0.56) * 0.72;
                const patch = 0.68 + Math.sin(angle * 3.4 + Math.random() * 2.6) * 0.16 + Math.sin(angle * 6.1) * 0.08;
                cloudPositionArray[i] = Math.cos(angle) * shell * patch + approxNormal() * 0.02;
                cloudPositionArray[i + 1] = Math.sin(angle) * shell * patch * 0.84 + approxNormal() * 0.02;
                cloudPositionArray[i + 2] = approxNormal() * 0.09;
              }
              paint(cloudColorArray, i, Math.random() < 0.44 ? '#fff6dd' : Math.random() < 0.75 ? '#ffe2a8' : '#f0ddff', 0.05);
            }
            for (let i = 0; i < accentPositionArray.length; i += 3) {
              const ray = jets[Math.floor(Math.random() * jets.length)] + approxNormal() * 0.09;
              const radius = 0.08 + Math.pow(Math.random(), 0.34) * 1.08;
              accentPositionArray[i] = Math.cos(ray) * radius + approxNormal() * 0.015;
              accentPositionArray[i + 1] = Math.sin(ray) * radius * 0.84 + approxNormal() * 0.015;
              accentPositionArray[i + 2] = approxNormal() * 0.07;
              paint(accentColorArray, i, Math.random() < 0.58 ? '#ffffff' : Math.random() < 0.82 ? '#fff3ca' : '#e6ddff', 0.03);
            }
          }

          cloudPosition.needsUpdate = true;
          cloudColor.needsUpdate = true;
          accentPosition.needsUpdate = true;
          accentColor.needsUpdate = true;
          cosmicEvent.cloudGeometry.computeBoundingSphere();
          cosmicEvent.accentGeometry.computeBoundingSphere();
        };

        const scheduleNextCosmicEvent = () => {
          cosmicEvent.nextIn = COSMIC_EVENT_MIN_DELAY
            + Math.random() * (COSMIC_EVENT_MAX_DELAY - COSMIC_EVENT_MIN_DELAY);
        };

        const triggerCosmicEvent = () => {
          const kind: CosmicEventKind = 'stellar-birth';

          cosmicEvent.kind = kind;
          cosmicEvent.elapsed = 0;
          cosmicEvent.active = true;
          cosmicEvent.group.visible = true;

          const nursery = GALAXY_HOTSPOTS.find((hotspot) => hotspot.id === 'cluster');
          const base = nursery?.position ?? [-4.66, 0.17, -0.92];
          cosmicEvent.localPosition.set(
            base[0] + (Math.random() - 0.5) * 0.32,
            base[1] + (Math.random() - 0.5) * 0.10,
            base[2] + (Math.random() - 0.5) * 0.26,
          );
          cosmicEvent.duration = 6.2;
          cosmicEvent.coreMaterial.color.set('#fff2d4');
          cosmicEvent.haloMaterial.color.set('#ffb68e');
          cosmicEvent.ringMaterial.color.set('#ffd6b8');
          cosmicEvent.cloudMaterial.color.set('#ffd6b0');
          cosmicEvent.accentMaterial.color.set('#fff1de');
          cosmicEvent.spikeMaterial.color.set('#ffd6b8');

          configureCosmicEventVisual(kind);
        };

        const updateCosmicEvent = (delta: number, disabled: boolean) => {
          if (reducedCosmicMotion || disabled) {
            cosmicEvent.group.visible = false;
            cosmicEvent.coreMaterial.opacity = 0;
            cosmicEvent.haloMaterial.opacity = 0;
            cosmicEvent.ringMaterial.opacity = 0;
            cosmicEvent.cloudMaterial.opacity = 0;
            cosmicEvent.accentMaterial.opacity = 0;
            cosmicEvent.spikeMaterial.opacity = 0;
            return;
          }

          if (!cosmicEvent.active) {
            cosmicEvent.nextIn -= delta;
            if (cosmicEvent.nextIn <= 0) triggerCosmicEvent();
            return;
          }

          cosmicEvent.elapsed += delta;
          const progress = cosmicEvent.elapsed / cosmicEvent.duration;
          if (progress >= 1) {
            cosmicEvent.active = false;
            cosmicEvent.group.visible = false;
            cosmicEvent.coreMaterial.opacity = 0;
            cosmicEvent.haloMaterial.opacity = 0;
            cosmicEvent.ringMaterial.opacity = 0;
            cosmicEvent.cloudMaterial.opacity = 0;
            cosmicEvent.accentMaterial.opacity = 0;
            cosmicEvent.spikeMaterial.opacity = 0;
            scheduleNextCosmicEvent();
            return;
          }

          cosmicWorldPosition.copy(cosmicEvent.localPosition);
          root.localToWorld(cosmicWorldPosition);
          cosmicEvent.group.position.copy(cosmicWorldPosition);
          cosmicEvent.group.quaternion.copy(camera.quaternion);

          const envelope = Math.sin(Math.PI * progress);
          const fastFlash = Math.sin(Math.PI * Math.min(1, progress * 2.5));
          const lateFade = 1 - THREE.MathUtils.smoothstep(progress, 0.50, 1.0);
          const intensity = Math.max(0, envelope * (0.70 + fastFlash * 0.30));
          const shimmer = 0.92 + Math.sin((cosmicEvent.elapsed + progress) * 18) * 0.08;
          if (cosmicEvent.kind === 'stellar-birth') {
            const bloom = 0.96 + envelope * 0.42;
            cosmicEvent.group.rotation.z += delta * 0.024;
            cosmicEvent.core.scale.setScalar(0.0024 + envelope * 0.0022);
            cosmicEvent.halo.scale.set(0.072 + bloom * 0.030, 0.060 + bloom * 0.024, 1);
            cosmicEvent.ring.scale.setScalar(0.01);
            cosmicEvent.cloud.scale.set(0.96 + bloom * 0.24, 0.92 + bloom * 0.18, 0.98 + bloom * 0.12);
            cosmicEvent.accent.scale.set(0.98 + envelope * 0.16, 0.94 + envelope * 0.12, 1.00 + envelope * 0.08);
            cosmicEvent.spikeA.scale.set(0.01, 0.01, 0.01);
            cosmicEvent.spikeB.scale.set(0.01, 0.01, 0.01);
            cosmicEvent.coreMaterial.opacity = intensity * 0.020;
            cosmicEvent.haloMaterial.opacity = intensity * 0.030 * lateFade;
            cosmicEvent.ringMaterial.opacity = 0;
            cosmicEvent.cloudMaterial.opacity = intensity * 0.48 * shimmer;
            cosmicEvent.accentMaterial.opacity = intensity * 0.24;
            cosmicEvent.spikeMaterial.opacity = 0;
          } else {
            const flash = 1.03 + envelope * 0.30;
            cosmicEvent.group.rotation.z += delta * 0.010;
            cosmicEvent.core.scale.setScalar(0.0024 + envelope * 0.0018);
            cosmicEvent.halo.scale.set(0.020 + flash * 0.010, 0.020 + flash * 0.010, 1);
            cosmicEvent.ring.scale.setScalar(0.01);
            cosmicEvent.cloud.scale.set(1.06 + envelope * 0.22, 1.06 + envelope * 0.22, 1.00 + envelope * 0.10);
            cosmicEvent.accent.scale.set(1.04 + envelope * 0.16, 1.04 + envelope * 0.16, 1.00 + envelope * 0.08);
            cosmicEvent.spikeA.scale.set(0.185 + envelope * 0.060, 0.009 + envelope * 0.003, 1);
            cosmicEvent.spikeB.scale.set(0.185 + envelope * 0.060, 0.009 + envelope * 0.003, 1);
            cosmicEvent.coreMaterial.opacity = Math.min(0.026, intensity * 0.020);
            cosmicEvent.haloMaterial.opacity = intensity * 0.008 * lateFade;
            cosmicEvent.ringMaterial.opacity = 0;
            cosmicEvent.cloudMaterial.opacity = intensity * 0.30 * shimmer;
            cosmicEvent.accentMaterial.opacity = intensity * 0.24;
            cosmicEvent.spikeMaterial.opacity = intensity * 0.52 * lateFade;
          }
        };

        let pointerX = 0;
        let pointerY = 0;
        let targetX = 0;
        let targetY = 0;
        let running = document.visibilityState !== 'hidden';
        let lastReportedStage: CinematicStage = 'loading';
        let lastReportedBucket = -1;
        let lastPixelRatio = Math.min(window.devicePixelRatio || 1, profile.pixelRatioMax);
        let lastExplorationState = explorationRef.current;
        const performanceTracker = new AdaptivePerformanceTracker({
          mobile: isMobile,
          initialTier: isMobile ? 'balanced' : quality === 'high' ? 'quality' : 'balanced',
        });
        let performanceSnapshot = performanceTracker.update(1 / 60, true);
        let statsReportAccumulator = 0;

        const activePointers = new Map<number, ActivePointer>();
        let dragging = false;
        let dragPointerId: number | null = null;
        let previousX = 0;
        let previousY = 0;
        let pinchStartDistance = 0;
        let pinchStartZoom = 0;

        const buildCinematicCurves = () => {
          const target = new THREE.Vector3(...DEFAULT_CAMERA.target);
          const baseZoom = getBaseZoom();
          const cosPitch = Math.cos(DEFAULT_CAMERA.pitch);
          const finalPosition = target.clone().add(
            new THREE.Vector3(
              Math.sin(DEFAULT_CAMERA.yaw) * cosPitch * baseZoom,
              Math.sin(DEFAULT_CAMERA.pitch) * baseZoom,
              Math.cos(DEFAULT_CAMERA.yaw) * cosPitch * baseZoom,
            ),
          );

          const positionCurve = isMobile
            ? new THREE.CubicBezierCurve3(
                new THREE.Vector3(-0.92, 3.05, 21.1),
                new THREE.Vector3(-0.46, 2.35, 15.4),
                new THREE.Vector3(0.12, 0.30, 1.55),
                finalPosition,
              )
            : new THREE.CubicBezierCurve3(
                new THREE.Vector3(-1.35, 3.75, 24.8),
                new THREE.Vector3(-0.62, 3.05, 19.7),
                new THREE.Vector3(0.18, 0.35, 2.5),
                finalPosition,
              );

          const targetCurve = isMobile
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
              );

          return { positionCurve, targetCurve };
        };

        let { positionCurve: cinematicPositionCurve, targetCurve: cinematicTargetCurve } = buildCinematicCurves();

        const setCinematicLayerVisibility = (stage: CinematicStage, active: boolean) => {
          if (!active) {
            nebula.visible = true;
            farStars.visible = true;
            nearStars.visible = true;
            disc.visible = true;
            differentialLayers.forEach((layer) => { layer.visible = true; });
            livingStreamGroup.visible = true;
            livingNurseryGroup.visible = true;
            clusters.visible = true;
            shootingStars.visible = true;
            return;
          }

          const showDepth = stage !== 'loading';
          const showGalaxy = ['approach', 'core', 'reveal', 'complete'].includes(stage);
          const showNebula = showGalaxy;
          const showShooting = ['reveal', 'complete'].includes(stage);

          nebula.visible = showNebula;
          farStars.visible = showDepth;
          nearStars.visible = showDepth;
          disc.visible = showGalaxy;
          differentialLayers.forEach((layer) => { layer.visible = showGalaxy; });
          livingStreamGroup.visible = showGalaxy;
          livingNurseryGroup.visible = showGalaxy;
          clusters.visible = showGalaxy;
          shootingStars.visible = showShooting;
        };

        const getTouchPointers = () =>
          Array.from(activePointers.values()).filter((pointer) => pointer.pointerType === 'touch');

        const beginPinch = () => {
          const touches = getTouchPointers();
          if (touches.length < 2) return;
          pinchStartDistance = Math.max(1, getPointerDistance(touches[0], touches[1]));
          pinchStartZoom = interactionRef.current.targetZoom;
          dragging = false;
          dragPointerId = null;
          renderer.domElement.style.cursor = 'grabbing';
        };

        const beginSinglePointerDrag = (pointer: ActivePointer) => {
          dragging = true;
          dragPointerId = pointer.id;
          previousX = pointer.x;
          previousY = pointer.y;
          pinchStartDistance = 0;
          renderer.domElement.style.cursor = 'grabbing';
        };

        const updatePointerParallax = (event: PointerEvent) => {
          const rect = renderer.domElement.getBoundingClientRect();
          if (!rect.width || !rect.height) return;
          targetX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
          targetY = -((((event.clientY - rect.top) / rect.height) * 2) - 1);
        };

        const onPointerDown = (event: PointerEvent) => {
          updatePointerParallax(event);
          if (!explorationRef.current || cinematicRef.current.active) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;

          const pointer: ActivePointer = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            pointerType: event.pointerType,
          };
          activePointers.set(event.pointerId, pointer);
          renderer.domElement.setPointerCapture?.(event.pointerId);

          const touches = getTouchPointers();
          if (touches.length >= 2) {
            beginPinch();
            return;
          }
          beginSinglePointerDrag(pointer);
        };

        const onPointerMove = (event: PointerEvent) => {
          updatePointerParallax(event);

          const stored = activePointers.get(event.pointerId);
          if (stored) {
            stored.x = event.clientX;
            stored.y = event.clientY;
          }

          if (!explorationRef.current || cinematicRef.current.active) return;
          const interaction = interactionRef.current;
          const touches = getTouchPointers();

          if (touches.length >= 2) {
            const distance = Math.max(1, getPointerDistance(touches[0], touches[1]));
            if (pinchStartDistance <= 0) {
              beginPinch();
              return;
            }
            const scale = distance / pinchStartDistance;
            interaction.targetZoom = THREE.MathUtils.clamp(
              pinchStartZoom / scale,
              getMinZoom(),
              getMaxZoom(),
            );
            return;
          }

          if (!dragging || dragPointerId !== event.pointerId) return;
          const dx = event.clientX - previousX;
          const dy = event.clientY - previousY;
          previousX = event.clientX;
          previousY = event.clientY;
          interaction.targetYaw -= dx * 0.0036;
          interaction.targetPitch = THREE.MathUtils.clamp(interaction.targetPitch + dy * 0.0032, -0.18, 0.42);
        };

        const stopPointer = (event: PointerEvent) => {
          if (!activePointers.has(event.pointerId)) return;
          activePointers.delete(event.pointerId);
          renderer.domElement.releasePointerCapture?.(event.pointerId);
          const touches = getTouchPointers();

          if (touches.length >= 2) {
            beginPinch();
            return;
          }
          if (activePointers.size === 1) {
            beginSinglePointerDrag(Array.from(activePointers.values())[0]);
            return;
          }

          dragging = false;
          dragPointerId = null;
          pinchStartDistance = 0;
          renderer.domElement.style.cursor = explorationRef.current ? 'grab' : '';
        };

        const onWheel = (event: WheelEvent) => {
          if (!explorationRef.current || cinematicRef.current.active) return;
          event.preventDefault();
          const interaction = interactionRef.current;
          interaction.targetZoom = THREE.MathUtils.clamp(
            interaction.targetZoom + event.deltaY * 0.008,
            getMinZoom(),
            getMaxZoom(),
          );
        };

        const onKeyDown = (event: KeyboardEvent) => {
          if (!explorationRef.current || cinematicRef.current.active) return;
          const target = event.target as HTMLElement | null;
          if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

          const interaction = interactionRef.current;
          let handled = true;
          switch (event.key) {
            case 'ArrowLeft':
              interaction.targetYaw += 0.08;
              break;
            case 'ArrowRight':
              interaction.targetYaw -= 0.08;
              break;
            case 'ArrowUp':
              interaction.targetPitch = THREE.MathUtils.clamp(interaction.targetPitch - 0.055, -0.18, 0.42);
              break;
            case 'ArrowDown':
              interaction.targetPitch = THREE.MathUtils.clamp(interaction.targetPitch + 0.055, -0.18, 0.42);
              break;
            case '+':
            case '=':
              interaction.targetZoom = THREE.MathUtils.clamp(interaction.targetZoom - 0.8, getMinZoom(), getMaxZoom());
              break;
            case '-':
            case '_':
              interaction.targetZoom = THREE.MathUtils.clamp(interaction.targetZoom + 0.8, getMinZoom(), getMaxZoom());
              break;
            case 'Home':
              interaction.targetYaw = DEFAULT_CAMERA.yaw;
              interaction.targetPitch = DEFAULT_CAMERA.pitch;
              interaction.targetZoom = getBaseZoom();
              selectedHotspotRef.current = null;
              setSelectedHotspot(null);
              break;
            default:
              handled = false;
          }
          if (handled) event.preventDefault();
        };

        const resize = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (!width || !height) return;

          const wasMobile = isMobile;
          isMobile = width < MOBILE_BREAKPOINT;
          camera.aspect = width / height;
          if (!cinematicRef.current.active) camera.fov = getBaseFov();
          camera.updateProjectionMatrix();
          renderer.setSize(width, height);

          cinematicPositionCurve = buildCinematicCurves().positionCurve;
          cinematicTargetCurve = buildCinematicCurves().targetCurve;

          if (wasMobile !== isMobile && !selectedHotspotRef.current) {
            const interaction = interactionRef.current;
            interaction.targetZoom = getBaseZoom();
            interaction.zoom = THREE.MathUtils.clamp(interaction.zoom, getMinZoom(), getMaxZoom());
          }
        };

        const onVisibility = () => {
          running = document.visibilityState !== 'hidden';
        };

        const clock = new THREE.Clock();
        const tmpLocal = new THREE.Vector3();
        const tmpWorld = new THREE.Vector3();
        const tmpProjected = new THREE.Vector3();

        const updateSafeVolumetricParallax = (delta: number, cinematicActive: boolean, exploring: boolean) => {
          const interaction = interactionRef.current;
          const disabled = cinematicActive || photoModeRef.current;
          const strength = disabled
            ? 0
            : exploring
              ? PARALLAX_TUNING.explorationStrength
              : PARALLAX_TUNING.normalStrength;
          const yawWave = Math.sin(interaction.yaw - DEFAULT_CAMERA.yaw);
          const pitchWave = Math.sin(interaction.pitch - DEFAULT_CAMERA.pitch);
          const smooth = 1 - Math.exp(-delta * 3.0);

          const farTargetX = (yawWave * PARALLAX_TUNING.farX + pointerX * 0.008) * strength;
          const farTargetY = (pitchWave * PARALLAX_TUNING.farY + pointerY * 0.006) * strength;
          farStars.position.x = THREE.MathUtils.lerp(farStars.position.x, farTargetX, smooth);
          farStars.position.y = THREE.MathUtils.lerp(farStars.position.y, farTargetY, smooth);
          farStars.position.z = THREE.MathUtils.lerp(farStars.position.z, 0, smooth);

          const nearTargetX = (-yawWave * PARALLAX_TUNING.nearX - pointerX * 0.025) * strength;
          const nearTargetY = (-pitchWave * PARALLAX_TUNING.nearY - pointerY * 0.018) * strength;
          nearStars.position.x = THREE.MathUtils.lerp(nearStars.position.x, nearTargetX, smooth);
          nearStars.position.y = THREE.MathUtils.lerp(nearStars.position.y, nearTargetY, smooth);
          nearStars.position.z = THREE.MathUtils.lerp(nearStars.position.z, 0, smooth);

          const nebulaTargetX = yawWave * PARALLAX_TUNING.nebulaX * strength;
          const nebulaTargetY = pitchWave * PARALLAX_TUNING.nebulaY * strength;
          nebula.position.x = THREE.MathUtils.lerp(nebula.position.x, nebulaTargetX, smooth * 0.65);
          nebula.position.y = THREE.MathUtils.lerp(nebula.position.y, nebulaTargetY, smooth * 0.65);
        };

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerup', stopPointer);
        renderer.domElement.addEventListener('pointercancel', stopPointer);
        renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
        window.addEventListener('keydown', onKeyDown);
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);

        renderer.setAnimationLoop(() => {
          if (!running) return;

          const delta = Math.min(clock.getDelta(), 0.05);
          const performanceLocked = cinematicRef.current.active || photoModeRef.current || photoCapturing;
          const trackedSnapshot = performanceTracker.update(
            delta,
            performanceLocked || performanceModeRef.current !== 'auto',
          );
          performanceSnapshot = performanceModeRef.current === 'auto'
            ? trackedSnapshot
            : {
                ...trackedSnapshot,
                tier: performanceModeRef.current as AdaptivePerformanceTier,
                renderScale: ADAPTIVE_RENDER_SCALE[performanceModeRef.current as AdaptivePerformanceTier],
                changed: false,
              };
          statsReportAccumulator += delta;
          const easing = 1 - Math.exp(-delta * 2.0);
          pointerX += (targetX - pointerX) * easing;
          pointerY += (targetY - pointerY) * easing;

          const cinematic = cinematicRef.current;
          const interaction = interactionRef.current;

          renderer.domElement.style.touchAction = explorationRef.current && !cinematic.active ? 'none' : 'auto';
          renderer.domElement.style.cursor = explorationRef.current && !cinematic.active
            ? dragging ? 'grabbing' : 'grab'
            : '';

          if (cinematic.active) {
            if (cinematic.startedAt === null) {
              cinematic.startedAt = clock.elapsedTime;
              cinematicPositionCurve = buildCinematicCurves().positionCurve;
              cinematicTargetCurve = buildCinematicCurves().targetCurve;
              if (isMobile) {
                camera.position.set(-0.92, 2.82, 20.1);
                currentTarget.set(0.10, 0.14, 0);
              } else {
                camera.position.set(-1.35, 3.75, 24.8);
                currentTarget.set(0.22, 0.18, 0);
              }
              camera.lookAt(currentTarget);
            }

            const elapsed = clock.elapsedTime - cinematic.startedAt;
            const rawProgress = THREE.MathUtils.clamp(elapsed / CINEMATIC_DURATION, 0, 1);
            const travel = cinematicTimeWarp(rawProgress);
            cinematic.progress = rawProgress;
            cinematic.stage = getCinematicStage(rawProgress);
            setCinematicLayerVisibility(cinematic.stage, true);

            if (isMobile) {
              const nextFov = getMobileCinematicFov(rawProgress);
              if (Math.abs(camera.fov - nextFov) > 0.02) {
                camera.fov = nextFov;
                camera.updateProjectionMatrix();
              }
            } else if (camera.fov !== DESKTOP_CAMERA_FOV) {
              camera.fov = DESKTOP_CAMERA_FOV;
              camera.updateProjectionMatrix();
            }

            const bucket = Math.floor(rawProgress * 60);
            if (bucket !== lastReportedBucket || cinematic.stage !== lastReportedStage) {
              lastReportedBucket = bucket;
              lastReportedStage = cinematic.stage;
              setCinematicProgress(rawProgress);
              setCinematicStage(cinematic.stage);
            }

            const desiredPosition = cinematicPositionCurve.getPointAt(travel);
            const desiredTarget = cinematicTargetCurve.getPointAt(travel);
            const driftEnvelope = Math.sin(Math.PI * rawProgress);
            desiredPosition.x += Math.sin(clock.elapsedTime * 0.9) * 0.018 * driftEnvelope;
            desiredPosition.y += Math.cos(clock.elapsedTime * 0.72) * 0.012 * driftEnvelope;
            camera.position.copy(desiredPosition);
            currentTarget.copy(desiredTarget);
            camera.lookAt(currentTarget);
            updateParticleScale(camera.position.distanceTo(currentTarget));

            root.rotation.y += delta * 0.0022;
            root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, easing);
            root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, VIEW_TUNING.rootTiltX, easing);

            if (rawProgress >= 1) {
              cinematic.active = false;
              cinematic.startedAt = null;
              cinematic.stage = 'complete';
              interaction.yaw = DEFAULT_CAMERA.yaw;
              interaction.pitch = DEFAULT_CAMERA.pitch;
              interaction.zoom = getBaseZoom();
              interaction.targetYaw = DEFAULT_CAMERA.yaw;
              interaction.targetPitch = DEFAULT_CAMERA.pitch;
              interaction.targetZoom = getBaseZoom();
              updateParticleScale(interaction.zoom);
          enforceSemanticHotspotAnchors();
              camera.fov = getBaseFov();
              camera.updateProjectionMatrix();
              setCinematicLayerVisibility('complete', false);
              finishCinematic();
            }
          } else {
            setCinematicLayerVisibility('complete', false);

            const exploring = explorationRef.current;
            nebula.visible = false;

            if (camera.fov !== getBaseFov()) {
              camera.fov = getBaseFov();
              camera.updateProjectionMatrix();
            }

            const hotspot = selectedHotspotRef.current
              ? GALAXY_HOTSPOTS.find((item) => item.id === selectedHotspotRef.current) ?? null
              : null;

            let desiredTarget = new THREE.Vector3(...DEFAULT_CAMERA.target);
            if (hotspot) {
              tmpLocal.set(...hotspot.cameraTarget);
              root.updateMatrixWorld(true);
              desiredTarget = root.localToWorld(tmpLocal.clone());
            } else if (!exploring) {
              desiredTarget.y += isMobile ? 0.0 : 0.0;
            }

            currentTarget.lerp(desiredTarget, 1 - Math.exp(-delta * (hotspot ? 4.2 : 2.1)));

            let desiredYaw = interaction.targetYaw;
            let desiredPitch = interaction.targetPitch;
            let desiredZoom = interaction.targetZoom;

            if (!exploring) {
              desiredYaw = DEFAULT_CAMERA.yaw;
              desiredPitch = DEFAULT_CAMERA.pitch;
              desiredZoom = getBaseZoom();
            }

            const orbitEasing = 1 - Math.exp(-delta * 3.0);
            interaction.yaw = THREE.MathUtils.lerp(interaction.yaw, desiredYaw, orbitEasing);
            interaction.pitch = THREE.MathUtils.lerp(interaction.pitch, desiredPitch, orbitEasing);
            interaction.zoom = THREE.MathUtils.lerp(interaction.zoom, desiredZoom, orbitEasing);
            updateParticleScale(interaction.zoom);

            const cosPitch = Math.cos(interaction.pitch);
            const offset = new THREE.Vector3(
              Math.sin(interaction.yaw) * cosPitch * interaction.zoom,
              Math.sin(interaction.pitch) * interaction.zoom,
              Math.cos(interaction.yaw) * cosPitch * interaction.zoom,
            );
            const desiredPosition = currentTarget.clone().add(offset);
            camera.position.lerp(desiredPosition, 1 - Math.exp(-delta * 4.0));
            camera.lookAt(currentTarget);

            root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, easing * 0.55);
            root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, VIEW_TUNING.rootTiltX, easing * 0.55);

            {
              const deviceDpr = window.devicePixelRatio || 1;
              const baseDpr = Math.min(deviceDpr, Math.max(1, profile.pixelRatioMax));
              const zoomDetail = isMobile && exploring
                ? THREE.MathUtils.clamp((12 - interaction.zoom) / 6.5, 0, 1)
                : 0;
              const hardwareCap = isMobile
                ? quality === 'high' ? 1.9 : quality === 'balanced' ? 1.72 : 1.55
                : profile.pixelRatioMax;
              const requestedDpr = Math.min(
                deviceDpr,
                hardwareCap,
                THREE.MathUtils.lerp(baseDpr, hardwareCap, zoomDetail),
              );
              const performanceFloor = isMobile ? 0.82 : 0.88;
              const targetDpr = Math.max(
                performanceFloor,
                requestedDpr * performanceSnapshot.renderScale,
              );
              if (Math.abs(targetDpr - lastPixelRatio) >= 0.035) {
                lastPixelRatio = targetDpr;
                renderer.setPixelRatio(targetDpr);
              }
            }

            if (lastExplorationState !== exploring) {
              lastExplorationState = exploring;
              activePointers.clear();
              dragging = false;
              pinchStartDistance = 0;
            }
          }

          updateSafeVolumetricParallax(delta, cinematic.active, explorationRef.current);

          const nurseryPrimary = Math.sin(clock.elapsedTime * 0.54);
          const nurserySecondary = Math.cos(clock.elapsedTime * 0.31 + 0.9);
          livingNursery.rotation.y = nurseryPrimary * 0.095;
          livingNursery.rotation.z = nurserySecondary * 0.060;
          livingNursery.position.y = nurseryPrimary * 0.010;
          livingNursery.scale.setScalar(1 + nurseryPrimary * 0.032 + nurserySecondary * 0.014);

          updateCosmicEvent(
            delta,
            cinematic.active || photoModeRef.current || photoCapturing || document.visibilityState === 'hidden',
          );

          const showHotspots = explorationRef.current && !cinematicRef.current.active && !photoModeRef.current;
          root.updateMatrixWorld(true);
          GALAXY_HOTSPOTS.forEach((hotspot) => {
            const group = hotspotGroups.get(hotspot.id);
            const selected = selectedHotspotRef.current === hotspot.id;
            if (group) {
              group.visible = showHotspots;
              const targetScale = selected ? 1.08 : 1;
              const nextScale = THREE.MathUtils.lerp(group.scale.x, targetScale, 1 - Math.exp(-delta * 7));
              group.scale.setScalar(nextScale);
            }

            const label = hotspotLabelRefs.current[hotspot.id];
            if (!label) return;
            if (!showHotspots) {
              label.style.opacity = '0';
              label.style.pointerEvents = 'none';
              return;
            }

            tmpLocal.set(...hotspot.position);
            tmpWorld.copy(tmpLocal);
            root.localToWorld(tmpWorld);
            tmpProjected.copy(tmpWorld).project(camera);
            const visible = tmpProjected.z > -1 && tmpProjected.z < 1 && Math.abs(tmpProjected.x) < 1.18 && Math.abs(tmpProjected.y) < 1.18;
            if (!visible) {
              label.style.opacity = '0';
              label.style.pointerEvents = 'none';
              return;
            }

            const x = (tmpProjected.x * 0.5 + 0.5) * host.clientWidth;
            const y = (-tmpProjected.y * 0.5 + 0.5) * host.clientHeight;
            label.style.transform = `translate3d(${x}px, ${y - (isMobile ? 9 : 15)}px, 0) translate(-50%, -50%)`;
            label.style.opacity = '1';
            label.style.pointerEvents = 'auto';
          });

          if (shootingStars.visible) {
            for (const shooting of shootingStates) {
              shooting.delay -= delta;
              if (shooting.delay > 0) {
                shooting.group.visible = false;
                continue;
              }

              shooting.group.visible = true;
              shooting.group.position.x += Math.cos(shooting.angle) * shooting.speed * delta;
              shooting.group.position.y += Math.sin(shooting.angle) * shooting.speed * delta;

              if (shooting.group.position.x > 18.5 || shooting.group.position.y < -8.5) {
                shooting.group.position.set(shooting.startX, shooting.startY, shooting.startZ);
                shooting.delay = 2.2 + Math.random() * 7.5;
                shooting.group.visible = false;
              }
            }
          }

          if (statsReportAccumulator >= 1.0 || performanceSnapshot.changed) {
            statsReportAccumulator = 0;
            setStats({
              backend: 'WebGPU + TSL',
              quality,
              stars: totalStars,
              migratedLayers: 7,
              performanceTier: performanceSnapshot.tier,
              fps: Math.round(performanceSnapshot.fps),
            });
          }

          renderer.render(scene, camera);
        });

        setStats({
          backend: 'WebGPU + TSL',
          quality,
          stars: totalStars,
          migratedLayers: 7,
          performanceTier: performanceSnapshot.tier,
          fps: Math.round(performanceSnapshot.fps),
        });
        setState('running');
        setMessage('Renderer WebGPU listo: base visual estable, parallax seguro, Cuna dinámica con pulsos reforzados y eventos de luz estelar integrados.');

        cleanup = () => {
          renderer.setAnimationLoop(null);
          renderer.domElement.removeEventListener('pointerdown', onPointerDown);
          renderer.domElement.removeEventListener('pointermove', onPointerMove);
          renderer.domElement.removeEventListener('pointerup', stopPointer);
          renderer.domElement.removeEventListener('pointercancel', stopPointer);
          renderer.domElement.removeEventListener('wheel', onWheel);
          window.removeEventListener('keydown', onKeyDown);
          window.removeEventListener('resize', resize);
          document.removeEventListener('visibilitychange', onVisibility);
          activePointers.clear();

          geometries.forEach((geometry) => geometry.dispose());
          materials.forEach((material) => material.dispose());
          webgpuCaptureRef.current = null;
          renderer.dispose();

          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };
      } catch (error) {
        console.error('[Galaxy WebGPU Interactive Experience V3.7.4]', error);
        setState('error');
        setMessage('WebGPU está disponible, pero la experiencia TSL no pudo inicializarse. Se activará el fallback WebGL2.');
        onFallback?.('error');
      }
    }

    void start();

    return () => {
      disposed = true;
      cleanup();
    };
  }, [finishCinematic, onFallback]);

  return (
    <div
      className={`webgpuMigration ${mode === 'production' ? `webgpuProduction ${explorationEnabled ? 'webgpuProductionExploring' : ''}` : 'webgpuCandidate'}`}
      aria-label={mode === 'production' ? 'Galaxia WebGPU de producción' : 'Experiencia interactiva WebGPU de la galaxia'}
    >
      <div ref={mountRef} className="webgpuMigrationCanvas" />

      {!photoModeActive && !photoCapturing && (
      <div className="webgpuHotspotLayer" aria-label="Regiones interactivas de la galaxia">
        {GALAXY_HOTSPOTS.map((hotspot) => (
          <button
            key={hotspot.id}
            ref={(element) => {
              hotspotLabelRefs.current[hotspot.id] = element;
            }}
            type="button"
            className={`${styles.hotspotLabel} ${selectedHotspot === hotspot.id ? styles.hotspotLabelActive : ''} webgpuHotspotButton`}
            onClick={() => manualSelectHotspot(hotspot.id)}
            aria-pressed={selectedHotspot === hotspot.id}
            aria-label={`Explorar ${hotspot.label}`}
          >
            {hotspot.shortLabel}
          </button>
        ))}
      </div>
      )}

      <GalaxyCinematicOverlay
        active={cinematicActive}
        stage={cinematicStage}
        progress={cinematicProgress}
        onSkip={skipCinematic}
      />

      <GalaxyAudioController hidden={cinematicActive || state !== 'running' || photoModeActive || photoCapturing} />

      {!photoModeActive && !photoCapturing && (
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
      )}

      {!cinematicActive && state === 'running' && (
        <GalaxyPhotoModeOverlay
          active={photoModeActive}
          capturing={photoCapturing}
          gridEnabled={photoGridEnabled}
          selectedPreset={photoPreset}
          onEnter={enterPhotoMode}
          onExit={exitPhotoMode}
          onCapture={capturePhoto}
          onToggleGrid={() => setPhotoGridEnabled((current) => !current)}
          onPreset={applyPhotoPreset}
        />
      )}

      {!cinematicActive && state === 'running' && !photoModeActive && !photoCapturing && (
        <>
          {!utilityDockOpen && (
            <button
              type="button"
              className="galaxyUtilityDockLauncher"
              onClick={() => setUtilityDockOpen(true)}
              aria-label="Abrir controles de escena"
              aria-expanded="false"
            >
              <span className="galaxyUtilityDockLauncherDot" aria-hidden="true" />
              <span>Controles</span>
            </button>
          )}

          {utilityDockOpen && (
            <div className="galaxyUtilityDock" aria-label="Controles de estabilidad y rendimiento">
              <div className="galaxyUtilityDockHeader">
                <div>
                  <strong>Control de escena</strong>
                  <span>{performanceMode === 'auto' ? `Auto · ${stats?.performanceTier ?? 'balanced'}` : `Manual · ${performanceMode}`}</span>
                </div>
                <button
                  type="button"
                  className="galaxyUtilityDockClose"
                  onClick={() => setUtilityDockOpen(false)}
                  aria-label="Cerrar controles de escena"
                  aria-expanded="true"
                >
                  ×
                </button>
              </div>

              <div className="galaxyUtilityDockRow">
                <button type="button" className="galaxyUtilityButton" onClick={handleResetCamera}>Recentrar</button>
              </div>

              <p className="galaxyUtilityOrbitHint">Arrastra sobre la galaxia para orbitarla.</p>

              <div className="galaxyUtilityDockRow galaxyUtilityModes">
                {(['auto', 'quality', 'balanced', 'eco'] as PerformanceMode[]).map((modeOption) => (
                  <button
                    key={modeOption}
                    type="button"
                    className={`galaxyUtilityButton ${performanceMode === modeOption ? 'galaxyUtilityButtonActive' : ''}`}
                    onClick={() => setPerformanceMode(modeOption)}
                    aria-pressed={performanceMode === modeOption}
                  >
                    {modeOption === 'auto' ? 'Auto' : modeOption}
                  </button>
                ))}
              </div>

              <div className="galaxyUtilityMeta">
                <span>{stats?.fps ?? '—'} FPS</span>
                <span>{stats?.stars?.toLocaleString() ?? '—'} partículas</span>
              </div>
            </div>
          )}
        </>
      )}



      {mode === 'candidate' && !cinematicActive && !explorationEnabled && (
        <div className="webgpuCandidateBadge">
          <div>
            <span className="webgpuLabEyebrow">GALAXY ENGINE · V3.7.4</span>
            <strong>WebGPU Direct Renderer</strong>
            <small>{message}</small>
          </div>

          {stats && (
            <div className="webgpuCandidateStats" aria-label="Estado del renderer WebGPU">
              <span>{stats.backend}</span>
              <span>{stats.quality}</span>
              <span>{stats.stars.toLocaleString()} partículas</span>
              <span>{stats.performanceTier} · {stats.fps} FPS</span>
              <span>7/7 TSL</span>
            </div>
          )}

          <div className="webgpuCandidateNav">
            <a href="/webgl-galaxy">Forzar WebGL2</a>
            <a href="/webgpu-lab">Particle Lab</a>
          </div>
        </div>
      )}

      {mode === 'candidate' && state === 'unsupported' && (
        <div className="webgpuCandidateFallback" role="status">
          <strong>WebGPU no disponible</strong>
          <span>El fallback WebGL2 sigue disponible.</span>
          <a href="/webgl-galaxy">Abrir WebGL2</a>
        </div>
      )}

      {mode === 'candidate' && state === 'error' && (
        <div className="webgpuCandidateFallback" role="alert">
          <strong>No se pudo iniciar WebGPU</strong>
          <span>{message}</span>
          <a href="/webgl-galaxy">Abrir fallback WebGL2</a>
        </div>
      )}
    </div>
  );
}
