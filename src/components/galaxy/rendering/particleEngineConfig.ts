export type GPUParticleQuality = 'low' | 'balanced' | 'high';

export type GPUParticleProfile = {
  count: number;
  radiusMin: number;
  radiusMax: number;
  pixelRatioMax: number;
};

export const GPU_PARTICLE_PROFILES: Record<GPUParticleQuality, GPUParticleProfile> = {
  low: {
    count: 18000,
    radiusMin: 5,
    radiusMax: 25,
    pixelRatioMax: 1,
  },
  balanced: {
    count: 42000,
    radiusMin: 5,
    radiusMax: 28,
    pixelRatioMax: 1.25,
  },
  high: {
    count: 72000,
    radiusMin: 5,
    radiusMax: 31,
    pixelRatioMax: 1.4,
  },
};

export function detectGPUParticleQuality(): GPUParticleQuality {
  if (typeof window === 'undefined') return 'balanced';

  const nav = navigator as Navigator & { deviceMemory?: number };
  const memory = nav.deviceMemory ?? 8;
  const cores = nav.hardwareConcurrency ?? 8;
  const width = window.innerWidth;

  if (width < 640 || memory <= 4 || cores <= 4) return 'low';
  if (width >= 1280 && memory >= 8 && cores >= 8) return 'high';
  return 'balanced';
}
