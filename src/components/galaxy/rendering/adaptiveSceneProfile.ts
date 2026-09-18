import type { QualityLevel } from '../types';
import type { CinematicStage } from '../GalaxyCinematicOverlay';

export type ZoomBand = 'overview' | 'exploration' | 'close' | 'macro';

export type BackgroundLayerConfig = {
  count: number;
  pointSize: number;
  opacity: number;
  color: string;
  radiusMin: number;
  radiusMax: number;
  offsetY: number;
  driftX: number;
  driftY: number;
  seedOffset: number;
  distribution: 'halo' | 'disc';
  verticalScale: number;
  radialBias: number;
  rotationSpeed: number;
};

export type AdaptiveSceneProfile = {
  galaxy: number;
  dust: number;
  shooting: number;
  nebula: number;
  backgroundLayers: BackgroundLayerConfig[];
};

export type AdaptiveProfileInput = {
  width: number;
  quality: QualityLevel;
  zoomBand: ZoomBand;
  explorationEnabled: boolean;
  cinematicStage: CinematicStage;
};

const qualityMultipliers: Record<QualityLevel, number> = {
  low: 0.86,
  balanced: 1,
  high: 1.14,
};

const zoomMultipliers: Record<ZoomBand, { galaxy: number; dust: number; background: number }> = {
  overview: { galaxy: 1, dust: 1, background: 1 },
  exploration: { galaxy: 1.08, dust: 0.96, background: 1.08 },
  close: { galaxy: 1.2, dust: 0.88, background: 1.18 },
  macro: { galaxy: 1.32, dust: 0.82, background: 1.24 },
};

function scale(count: number, factor: number) {
  return Math.max(1, Math.round(count * factor));
}

export function resolveZoomBand(zoom: number, explorationEnabled: boolean): ZoomBand {
  if (!explorationEnabled) return 'overview';
  if (zoom <= 1.35) return 'macro';
  if (zoom <= 3.25) return 'close';
  return 'exploration';
}

export function getAdaptiveSceneProfile({
  width,
  quality,
  zoomBand,
  explorationEnabled,
  cinematicStage,
}: AdaptiveProfileInput): AdaptiveSceneProfile {
  const isMobile = width < 640;
  const isTablet = width >= 640 && width < 1024;

  const base = isMobile
    ? { galaxy: 17200, dust: 2300, background: 3000, shooting: 1, nebula: 0.26 }
    : isTablet
      ? { galaxy: 25000, dust: 3600, background: 2500, shooting: 2, nebula: 0.24 }
      : { galaxy: 35200, dust: 5200, background: 3200, shooting: 4, nebula: 0.26 };

  const cinematicFactor =
    cinematicStage === 'loading' || cinematicStage === 'deep-space'
      ? 0.55
      : cinematicStage === 'approach'
        ? 0.82
        : 1;

  const qualityFactor = qualityMultipliers[quality];
  const zoomFactor = zoomMultipliers[zoomBand];
  const explorationFactor = explorationEnabled ? 1.06 : 1;

  const galaxy = scale(base.galaxy, qualityFactor * zoomFactor.galaxy * cinematicFactor * explorationFactor);
  const dust = scale(base.dust, qualityFactor * zoomFactor.dust * cinematicFactor);
  const background = scale(base.background, qualityFactor * zoomFactor.background * explorationFactor);
  const shooting = cinematicStage === 'loading' || cinematicStage === 'deep-space'
    ? 0
    : Math.max(0, Math.round(base.shooting * (quality === 'high' ? 1.25 : 1)));

  const backgroundLayers: BackgroundLayerConfig[] = [
    {
      count: Math.max(220, Math.round(background * 0.12)),
      pointSize: isMobile ? 1.08 : 1.15,
      opacity: isMobile ? 0.22 : 0.18,
      color: '#8ea6cf',
      radiusMin: 46,
      radiusMax: 72,
      offsetY: 8.4,
      driftX: 0.035,
      driftY: 0.024,
      seedOffset: 3001,
      distribution: 'halo',
      verticalScale: 0.62,
      radialBias: 0.72,
      rotationSpeed: 0.015,
    },
    {
      count: Math.max(280, Math.round(background * 0.18)),
      pointSize: isMobile ? 1.22 : 1.32,
      opacity: isMobile ? 0.24 : 0.2,
      color: '#a6bbdf',
      radiusMin: 38,
      radiusMax: 60,
      offsetY: 4.6,
      driftX: 0.055,
      driftY: 0.034,
      seedOffset: 4013,
      distribution: 'disc',
      verticalScale: 0.18,
      radialBias: 1.16,
      rotationSpeed: 0.03,
    },
    {
      count: Math.max(380, Math.round(background * 0.28)),
      pointSize: isMobile ? 1.52 : 1.7,
      opacity: isMobile ? 0.32 : 0.28,
      color: '#d2def5',
      radiusMin: 24,
      radiusMax: 44,
      offsetY: 0,
      driftX: 0.095,
      driftY: 0.068,
      seedOffset: 5009,
      distribution: 'disc',
      verticalScale: 0.1,
      radialBias: 1.28,
      rotationSpeed: 0.05,
    },
    {
      count: Math.max(320, Math.round(background * 0.22)),
      pointSize: isMobile ? 1.42 : 1.55,
      opacity: isMobile ? 0.28 : 0.24,
      color: '#c4d7ff',
      radiusMin: 28,
      radiusMax: 50,
      offsetY: -3.8,
      driftX: 0.082,
      driftY: 0.058,
      seedOffset: 6011,
      distribution: 'disc',
      verticalScale: 0.14,
      radialBias: 1.08,
      rotationSpeed: -0.04,
    },
    {
      count: Math.max(260, Math.round(background * 0.2)),
      pointSize: isMobile ? 1.14 : 1.24,
      opacity: isMobile ? 0.24 : 0.2,
      color: '#9bb4de',
      radiusMin: 34,
      radiusMax: 58,
      offsetY: -7.6,
      driftX: 0.05,
      driftY: 0.03,
      seedOffset: 7001,
      distribution: 'halo',
      verticalScale: 0.58,
      radialBias: 0.76,
      rotationSpeed: -0.018,
    },
  ];

  return {
    galaxy,
    dust,
    shooting,
    nebula: base.nebula * (cinematicFactor < 1 ? 0.86 : 1) * (quality === 'high' ? 1.06 : 1),
    backgroundLayers,
  };
}
