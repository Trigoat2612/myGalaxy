'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import GalaxyAudioController from '../GalaxyAudioController';
import GalaxyCinematicOverlay, { type CinematicStage } from '../GalaxyCinematicOverlay';
import GalaxyExplorerOverlay from '../GalaxyExplorerOverlay';
import { DEFAULT_CAMERA, GALAXY_HOTSPOTS, GALAXY_VISUAL_TUNING, type GalaxyHotspotId } from '../galaxyConfig';
import styles from '../GalaxyBackground.module.css';

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
const CINEMATIC_SESSION_KEY = 'galaxy-webgpu-cinematic-v3.6.0-seen';
const PRESENTATION_INTERVAL_MS = 4300;

const STAR_TUNING = GALAXY_VISUAL_TUNING.stars;
const DISC_GLOW_TUNING = GALAXY_VISUAL_TUNING.discGlow;
const VIEW_TUNING = GALAXY_VISUAL_TUNING.view;

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

  const [state, setState] = useState<RuntimeState>('initializing');
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [message, setMessage] = useState('Inicializando la experiencia WebGPU + TSL…');
  const [explorationEnabled, setExplorationEnabled] = useState(false);
  const [selectedHotspot, setSelectedHotspot] = useState<GalaxyHotspotId | null>(null);
  const [presentationActive, setPresentationActive] = useState(false);
  const [cinematicActive, setCinematicActive] = useState(false);
  const [cinematicStage, setCinematicStage] = useState<CinematicStage>('loading');
  const [cinematicProgress, setCinematicProgress] = useState(0);

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

        function createParticleLayer(
          data: LayerData,
          options: {
            opacity: number;
            rotationSpeed: number;
            verticalMotion: number;
            twinkleSpeed: number;
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
            const x = instancePosition.x.mul(c).sub(instancePosition.z.mul(s));
            const z = instancePosition.x.mul(s).add(instancePosition.z.mul(c));
            const y = instancePosition.y.add(
              TSL.sin(TSL.time.mul(0.16).add(instancePhase)).mul(options.verticalMotion),
            );
            return TSL.vec3(x, y, z);
          })();

          material.scaleNode = TSL.vec2(
            instanceSize.mul(
              TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
                .mul(0.03)
                .add(1.0),
            ),
          );

          material.colorNode = TSL.Fn(() => {
            const twinkle = TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
              .mul(0.07)
              .add(0.93);
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
            return circle
              .mul(
                core
                  .mul(STAR_TUNING.spriteCoreWeight)
                  .add(halo.mul(STAR_TUNING.spriteHaloWeight))
                  .add(STAR_TUNING.spriteAmbientWeight),
              )
              .mul(twinkle)
              .mul(options.opacity);
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

        function createGalaxyLayer(count: number, dust = false): LayerData {
          const random = createRandom((dust ? 18871 : 99211) + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const branches = 4;
          const maxRadius = dust ? 14.2 : 13.4;
          const warm = new THREE.Color('#ffd7a5');
          const neutral = new THREE.Color('#eef3ff');
          const blue = new THREE.Color('#a8c7ff');
          const dusty = new THREE.Color('#7182a7');
          const current = new THREE.Color();

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const radius = Math.pow(random(), dust ? 0.72 : 0.64) * maxRadius;
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

        function createCoreLayer(count: number): LayerData {
          const random = createRandom(71341 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const hot = new THREE.Color('#fff2d8');
          const warm = new THREE.Color('#ffd5a0');
          const cool = new THREE.Color('#d8e4ff');
          const current = new THREE.Color();

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const angle = random() * Math.PI * 2;
            const radius = Math.pow(random(), 2.35) * 1.86;
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

        function createClusterLayer(count: number): LayerData {
          const random = createRandom(44017 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);

          const streamCenter = { x: 4.10, y: 0.09, z: 1.40 };
          const cradleCenter = { x: -4.66, y: 0.17, z: -0.92 };
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

          const streamCount = Math.floor(count * 0.38);
          const cradleCount = Math.floor(count * 0.36);

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
          const pulse = TSL.sin(TSL.time.mul(1.2 + index * 0.14).add(index * 1.7)).mul(0.06).add(0.94);
          const isCore = hotspot.id === 'core';
          const isCradle = hotspot.id === 'cluster';
          const haloStrength = isCore ? 0.38 : isCradle ? 0.08 : 0.09;
          const coreStrength = isCore ? 0.82 : 0.22;
          const markerScale = isCore ? 0.36 : isCradle ? 0.11 : 0.10;

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

        const galaxyStars = createParticleLayer(createGalaxyLayer(galaxyCount), {
          opacity: STAR_TUNING.galaxyOpacity,
          rotationSpeed: 0.010,
          verticalMotion: 0.0035,
          twinkleSpeed: 0.46,
        });

        const galaxyDust = createParticleLayer(createGalaxyLayer(dustCount, true), {
          opacity: STAR_TUNING.dustOpacity,
          rotationSpeed: 0.008,
          verticalMotion: 0.002,
          twinkleSpeed: 0.22,
        });

        const core = createParticleLayer(createCoreLayer(coreCount), {
          opacity: STAR_TUNING.coreOpacity,
          rotationSpeed: 0.020,
          verticalMotion: 0.003,
          twinkleSpeed: 0.55,
        });

        const clusters = createParticleLayer(createClusterLayer(clusterCount), {
          opacity: STAR_TUNING.clusterOpacity,
          rotationSpeed: 0.008,
          verticalMotion: 0.004,
          twinkleSpeed: 0.62,
        });

        farStars.renderOrder = -5;
        nearStars.renderOrder = -3;
        galaxyDust.renderOrder = 0;
        galaxyStars.renderOrder = 1;
        core.renderOrder = 2;
        clusters.renderOrder = 3;
        root.add(farStars, nearStars, galaxyDust, galaxyStars, core, clusters);

        const updateParticleScale = (zoom: number) => {
          const baseZoom = getBaseZoom();
          const zoomRatio = THREE.MathUtils.clamp(zoom / baseZoom, 0.20, 1);
          farStars.scale.setScalar(THREE.MathUtils.lerp(0.94, 1, zoomRatio));
          nearStars.scale.setScalar(THREE.MathUtils.lerp(0.92, 1, zoomRatio));
          galaxyDust.scale.setScalar(THREE.MathUtils.lerp(0.98, 1, zoomRatio));
          galaxyStars.scale.setScalar(THREE.MathUtils.lerp(0.985, 1, zoomRatio));
          core.scale.setScalar(1);
          clusters.scale.setScalar(1);
        };

        updateParticleScale(initialInteraction.zoom);

        const shootingStars = createTSLShootingStars();
        scene.add(shootingStars);

        let pointerX = 0;
        let pointerY = 0;
        let targetX = 0;
        let targetY = 0;
        let running = document.visibilityState !== 'hidden';
        let lastReportedStage: CinematicStage = 'loading';
        let lastReportedBucket = -1;
        let lastPixelRatio = Math.min(window.devicePixelRatio || 1, profile.pixelRatioMax);
        let lastExplorationState = explorationRef.current;

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
            galaxyDust.visible = true;
            galaxyStars.visible = true;
            core.visible = true;
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
          galaxyDust.visible = showGalaxy;
          galaxyStars.visible = showGalaxy;
          core.visible = showGalaxy;
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
          interaction.targetYaw = THREE.MathUtils.clamp(interaction.targetYaw - dx * 0.0036, -0.9, 0.9);
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
              interaction.targetYaw = THREE.MathUtils.clamp(interaction.targetYaw + 0.08, -0.9, 0.9);
              break;
            case 'ArrowRight':
              interaction.targetYaw = THREE.MathUtils.clamp(interaction.targetYaw - 0.08, -0.9, 0.9);
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
              camera.fov = getBaseFov();
              camera.updateProjectionMatrix();
              setCinematicLayerVisibility('complete', false);
              finishCinematic();
            }
          } else {
            setCinematicLayerVisibility('complete', false);

            const exploring = explorationRef.current;
            nebula.visible = !exploring;

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
              desiredTarget.x += pointerX * 0.035;
              desiredTarget.y += pointerY * 0.018 + (isMobile ? 0.05 : 0);
            }

            currentTarget.lerp(desiredTarget, 1 - Math.exp(-delta * (hotspot ? 4.2 : 2.1)));

            let desiredYaw = interaction.targetYaw;
            let desiredPitch = interaction.targetPitch;
            let desiredZoom = interaction.targetZoom;

            if (!exploring) {
              desiredYaw = DEFAULT_CAMERA.yaw + pointerX * 0.012 + Math.sin(clock.elapsedTime * 0.05) * 0.0025;
              desiredPitch = DEFAULT_CAMERA.pitch - pointerY * 0.006;
              desiredZoom = getBaseZoom() + Math.cos(clock.elapsedTime * 0.035) * 0.04;
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

            if (!exploring) {
              root.rotation.y += delta * 0.0045;
              root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, pointerX * 0.018, easing * 0.4);
              root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, VIEW_TUNING.rootTiltX + pointerY * 0.010, easing * 0.4);
            } else {
              root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, 0, easing * 0.55);
              root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, VIEW_TUNING.rootTiltX, easing * 0.55);
            }

            {
              const deviceDpr = window.devicePixelRatio || 1;
              const baseDpr = Math.min(deviceDpr, Math.max(1, profile.pixelRatioMax));
              const zoomDetail = isMobile && exploring
                ? THREE.MathUtils.clamp((12 - interaction.zoom) / 6.5, 0, 1)
                : 0;
              const hardwareCap = isMobile
                ? quality === 'high' ? 1.9 : quality === 'balanced' ? 1.72 : 1.55
                : profile.pixelRatioMax;
              const targetDpr = Math.min(
                deviceDpr,
                hardwareCap,
                THREE.MathUtils.lerp(baseDpr, hardwareCap, zoomDetail),
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

          const showHotspots = explorationRef.current && !cinematicRef.current.active;
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

          renderer.render(scene, camera);
        });

        setStats({
          backend: 'WebGPU + TSL',
          quality,
          stars: totalStars,
          migratedLayers: 7,
        });
        setState('running');
        setMessage('Renderer WebGPU interactivo listo: cinemática, hotspots, zoom, presentación y audio integrados.');

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
          renderer.dispose();

          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };
      } catch (error) {
        console.error('[Galaxy WebGPU Interactive Experience V3.6.0]', error);
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

      <GalaxyCinematicOverlay
        active={cinematicActive}
        stage={cinematicStage}
        progress={cinematicProgress}
        onSkip={skipCinematic}
      />

      <GalaxyAudioController hidden={cinematicActive || state !== 'running'} />

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

      {mode === 'candidate' && !cinematicActive && !explorationEnabled && (
        <div className="webgpuCandidateBadge">
          <div>
            <span className="webgpuLabEyebrow">GALAXY ENGINE · V3.6.0</span>
            <strong>WebGPU Direct Renderer</strong>
            <small>{message}</small>
          </div>

          {stats && (
            <div className="webgpuCandidateStats" aria-label="Estado del renderer WebGPU">
              <span>{stats.backend}</span>
              <span>{stats.quality}</span>
              <span>{stats.stars.toLocaleString()} partículas</span>
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
