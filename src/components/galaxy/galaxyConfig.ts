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
    cameraTarget: [0.12, -0.12, 0],
    zoom: 9.8,
  },
  {
    id: 'inner-arm',
    label: 'Corriente estelar',
    shortLabel: 'Corriente',
    description: 'Flujo de estrellas y polvo en el brazo derecho, con brillo joven y traza cósmica.',
    position: [3.95, 0.05, 1.2],
    cameraTarget: [2.45, 0.18, 0.72],
    zoom: 10.9,
  },
  {
    id: 'cluster',
    label: 'Cuna estelar',
    shortLabel: 'Cuna estelar',
    description: 'Región de formación estelar con brillo agrupado, gas tenue y pequeñas condensaciones luminosas.',
    position: [-4.35, 0.12, -1.22],
    cameraTarget: [-2.45, 0.22, -0.78],
    zoom: 11.2,
  },
];

export const DEFAULT_CAMERA = {
  target: [0.15, -0.08, 0] as [number, number, number],
  zoom: 15.85,
  yaw: 0,
  pitch: 0.105,
};
