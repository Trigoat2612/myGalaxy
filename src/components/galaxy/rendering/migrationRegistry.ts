export type MigrationStatus = 'legacy-glsl' | 'tsl-foundation' | 'tsl-ready' | 'tsl-lab' | 'tsl-migrated';

export type GalaxyMigrationItem = {
  component: string;
  status: MigrationStatus;
  target: 'v3.0' | 'v3.1' | 'v3.2' | 'v3.3' | 'v3.4' | 'v3.5';
  notes: string;
};

export const GALAXY_TSL_MIGRATION: GalaxyMigrationItem[] = [
  {
    component: 'Renderer runtime',
    status: 'tsl-ready',
    target: 'v3.0',
    notes: 'Capability detection, lazy WebGPURenderer factory and TSL loader available.',
  },
  {
    component: 'WebGPU Particle Lab',
    status: 'tsl-ready',
    target: 'v3.1',
    notes: 'Standalone WebGPURenderer + SpriteNodeMaterial engine validates the particle architecture.',
  },
  {
    component: 'StarField',
    status: 'tsl-migrated',
    target: 'v3.2',
    notes: 'Background stellar depth and twinkle run in TSL.',
  },
  {
    component: 'DepthStarLayers',
    status: 'tsl-migrated',
    target: 'v3.2',
    notes: 'Far and near depth layers run in WebGPU/TSL.',
  },
  {
    component: 'GalacticCore',
    status: 'tsl-migrated',
    target: 'v3.2',
    notes: 'Warm central stellar bulge uses a dense SpriteNodeMaterial particle system.',
  },
  {
    component: 'StarClusters',
    status: 'tsl-migrated',
    target: 'v3.2',
    notes: 'Clustered stellar populations and temperature colors run in TSL.',
  },
  {
    component: 'GalaxyShader / GalaxyDisc',
    status: 'tsl-migrated',
    target: 'v3.3',
    notes: 'Main spiral population, dust population and procedural luminous disk are reproduced in the WebGPU scene.',
  },
  {
    component: 'NebulaShader',
    status: 'tsl-migrated',
    target: 'v3.3',
    notes: 'The background nebula now uses MeshBasicNodeMaterial with an animated TSL cloud stack.',
  },
  {
    component: 'ShootingStars',
    status: 'tsl-migrated',
    target: 'v3.3',
    notes: 'Head and tail visuals use TSL node materials while lightweight trajectory state remains on CPU.',
  },
  {
    component: 'GalaxyHotspots / interaction',
    status: 'tsl-migrated',
    target: 'v3.4',
    notes: 'Hotspots, cinematic camera, mobile pinch zoom, labels, automatic presentation and ambient audio are mounted over the WebGPU scene as a production candidate.',
  },
  {
    component: 'Production renderer selection',
    status: 'tsl-migrated',
    target: 'v3.5',
    notes: 'The root route prefers WebGPU + TSL and falls back automatically to the stable WebGL2 scene when WebGPU is unavailable or initialization fails.',
  },
];
