export type GalaxyVisualProfileId = 'cinematic' | 'realistic' | 'vibrant';

export type GalaxyVisualProfileSettings = {
  label: string;
  description: string;
  starBrightness: number;
  starSaturation: number;
  starWarmth: number;
  starBloom: number;
  discBrightness: number;
  discSaturation: number;
  discWarmth: number;
  discContrast: number;
  coreBrightness: number;
  coreSaturation: number;
  coreWarmth: number;
  coreBloom: number;
  nebulaBrightness: number;
  nebulaSaturation: number;
  nebulaTint: number;
};

export const GALAXY_VISUAL_PROFILES: Record<GalaxyVisualProfileId, GalaxyVisualProfileSettings> = {
  cinematic: {
    label: 'Cinemático',
    description: 'Balance premium con brillo controlado y contraste elegante.',
    starBrightness: 1.0,
    starSaturation: 1.0,
    starWarmth: 0.08,
    starBloom: 1.0,
    discBrightness: 1.0,
    discSaturation: 1.0,
    discWarmth: 0.06,
    discContrast: 1.0,
    coreBrightness: 1.0,
    coreSaturation: 1.0,
    coreWarmth: 0.08,
    coreBloom: 1.0,
    nebulaBrightness: 1.0,
    nebulaSaturation: 1.0,
    nebulaTint: 0.12,
  },
  realistic: {
    label: 'Realista',
    description: 'Menos saturación, menos glow y una lectura más astronómica.',
    starBrightness: 0.92,
    starSaturation: 0.86,
    starWarmth: 0.03,
    starBloom: 0.84,
    discBrightness: 0.94,
    discSaturation: 0.88,
    discWarmth: 0.03,
    discContrast: 1.08,
    coreBrightness: 0.95,
    coreSaturation: 0.92,
    coreWarmth: 0.04,
    coreBloom: 0.88,
    nebulaBrightness: 0.84,
    nebulaSaturation: 0.9,
    nebulaTint: 0.05,
  },
  vibrant: {
    label: 'Vibrante',
    description: 'Más presencia cromática, más energía y mayor impacto visual.',
    starBrightness: 1.1,
    starSaturation: 1.14,
    starWarmth: 0.12,
    starBloom: 1.14,
    discBrightness: 1.08,
    discSaturation: 1.1,
    discWarmth: 0.1,
    discContrast: 1.12,
    coreBrightness: 1.12,
    coreSaturation: 1.1,
    coreWarmth: 0.13,
    coreBloom: 1.16,
    nebulaBrightness: 1.12,
    nebulaSaturation: 1.14,
    nebulaTint: 0.18,
  },
};

export const GALAXY_VISUAL_PROFILE_ORDER: GalaxyVisualProfileId[] = ['cinematic', 'realistic', 'vibrant'];
