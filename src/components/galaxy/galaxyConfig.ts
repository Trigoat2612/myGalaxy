export type GalaxyHotspotId = 'core' | 'inner-arm' | 'cluster';

export type GalaxyHotspot = {
  id: GalaxyHotspotId;
  label: string;
  shortLabel: string;
  description: string;
  position: [number, number, number];
  cameraTarget: [number, number, number];
  zoom: number;
};

export const GALAXY_HOTSPOTS: GalaxyHotspot[] = [
  {
    id: 'core',
    label: 'Núcleo galáctico',
    shortLabel: 'Núcleo',
    description: 'Región central de mayor densidad, brillo y velocidad angular.',
    position: [0, 0.06, 0],
    cameraTarget: [0.02, 0.05, 0.02],
    zoom: 1.55,
  },
  {
    id: 'inner-arm',
    label: 'Corriente estelar',
    shortLabel: 'Corriente',
    description: 'Flujo estelar curvo con traza luminosa, condensaciones jóvenes y halo difuso.',
    position: [4.10, 0.09, 1.40],
    cameraTarget: [4.10, 0.09, 1.40],
    zoom: 1.16,
  },
  {
    id: 'cluster',
    label: 'Cuna estelar',
    shortLabel: 'Cuna estelar',
    description: 'Nebulosa de formación estelar con nubes difusas, cavidades luminosas y brotes jóvenes.',
    position: [-4.66, 0.17, -0.92],
    cameraTarget: [-4.66, 0.17, -0.92],
    zoom: 1.20,
  },
];

export const DEFAULT_CAMERA = {
  target: [0.32, 0.10, -0.18] as [number, number, number],
  zoom: 18.2,
  yaw: -0.92,
  pitch: 0.44,
};

/**
 * Ajustes visuales centralizados para WebGPU/TSL.
 * Modifica estos valores para probar brillo, glow e inclinación sin buscar
 * constantes dispersas en el renderer.
 */
export const GALAXY_VISUAL_TUNING = {
  stars: {
    farOpacity: 1.0,
    nearOpacity: 0.97,
    galaxyOpacity: 0.92,
    dustOpacity: 0.14,
    coreOpacity: 0.92,
    clusterOpacity: 0.80,
    twinkleAmplitude: 0.030,
    twinkleBase: 0.97,
    spriteCoreWeight: 0.95,
    spriteHaloWeight: 0.035,
    spriteAmbientWeight: 0.006,
  },
  discGlow: {
    coreColorWeight: 0.34,
    innerColorWeight: 0.16,
    filamentColorWeight: 0.08,
    edgeOpacity: 0.075,
    coreOpacity: 0.072,
    innerOpacity: 0.028,
    filamentOpacity: 0.020,
  },
  view: {
    // Más negativo = inclina más el plano de la galaxia respecto a la cámara.
    rootTiltX: -0.24,
    // DEFAULT_CAMERA.pitch controla la elevación de la cámara base.
  },
} as const;

