export type MigrationStatus = 'legacy-glsl' | 'tsl-foundation' | 'tsl-ready' | 'tsl-lab';

export type GalaxyMigrationItem = {
  component: string;
  status: MigrationStatus;
  target: 'v3.0' | 'v3.1' | 'v3.2';
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
    notes: 'Standalone WebGPURenderer + SpriteNodeMaterial engine animates tens of thousands of stars with TSL.',
  },
  {
    component: 'StarField / DepthStarLayers',
    status: 'tsl-lab',
    target: 'v3.1',
    notes: 'Distribution and visual behavior reproduced in the WebGPU lab; production switch waits for remaining GLSL layers.',
  },
  {
    component: 'GalaxyShader',
    status: 'tsl-foundation',
    target: 'v3.1',
    notes: 'Differential rotation model is represented in TSL lab logic; galaxy-specific density/temperature path remains on GLSL in production.',
  },
  {
    component: 'ShootingStars',
    status: 'legacy-glsl',
    target: 'v3.2',
    notes: 'Premium head shader still requires TSL port before the full renderer can switch.',
  },
  {
    component: 'NebulaShader / GalacticCore / GalaxyDisc',
    status: 'legacy-glsl',
    target: 'v3.2',
    notes: 'These procedural layers are the next blocking group for the WebGPURenderer production switch.',
  },
  {
    component: 'GalaxyHotspots / StarClusters',
    status: 'legacy-glsl',
    target: 'v3.2',
    notes: 'Premium stellar markers and cluster shaders remain stable on WebGL2 until their TSL equivalents are validated.',
  },
];
