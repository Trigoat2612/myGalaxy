import type { QualityLevel } from '../types';
import type { CinematicStage } from '../GalaxyCinematicOverlay';

export type ZoomBand = 'overview' | 'exploration' | 'close' | 'macro';

type BackgroundLayerConfig = {
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
    ? { galaxy: 15800, dust: 2100, background: 2100, shooting: 1, nebula: 0.22 }
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
      count: Math.max(240, Math.round(background * 0.16)),
      pointSize: isMobile ? 1.1 : 1.3,
      opacity: 0.2,
      color: '#8ea6cf',
      radiusMin: 44,
      radiusMax: 66,
      offsetY: 5.6,
      driftX: 0.04,
      driftY: 0.026,
      seedOffset: 3001,
    },
    {
      count: Math.max(320, Math.round(background * 0.24)),
      pointSize: isMobile ? 1.35 : 1.55,
      opacity: 0.26,
      color: '#b2c4e7',
      radiusMin: 36,
      radiusMax: 56,
      offsetY: 2.8,
      driftX: 0.07,
      driftY: 0.045,
      seedOffset: 4003,
    },
    {
      count: Math.max(360, Math.round(background * 0.28)),
      pointSize: isMobile ? 1.75 : 2.05,
      opacity: 0.34,
      color: '#d2def5',
      radiusMin: 28,
      radiusMax: 46,
      offsetY: 0,
      driftX: 0.12,
      driftY: 0.08,
      seedOffset: 5009,
    },
    {
      count: Math.max(320, Math.round(background * 0.2)),
      pointSize: isMobile ? 1.55 : 1.9,
      opacity: 0.28,
      color: '#c4d7ff',
      radiusMin: 26,
      radiusMax: 44,
      offsetY: -2.6,
      driftX: 0.1,
      driftY: 0.07,
      seedOffset: 6007,
    },
    {
      count: Math.max(220, Math.round(background * 0.12)),
      pointSize: isMobile ? 1.2 : 1.45,
      opacity: 0.21,
      color: '#9bb4de',
      radiusMin: 34,
      radiusMax: 58,
      offsetY: -5.2,
      driftX: 0.06,
      driftY: 0.038,
      seedOffset: 7001,
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
