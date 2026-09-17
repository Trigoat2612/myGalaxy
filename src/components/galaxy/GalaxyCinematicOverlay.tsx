'use client';

import styles from './GalaxyBackground.module.css';

export type CinematicStage = 'loading' | 'deep-space' | 'approach' | 'core' | 'reveal' | 'complete';

const STAGE_LABELS: Record<CinematicStage, string> = {
  loading: 'Preparando escena',
  'deep-space': 'Espacio profundo',
  approach: 'Aproximación',
  core: 'Núcleo galáctico',
  reveal: 'Vista general',
  complete: 'Exploración disponible',
};

export default function GalaxyCinematicOverlay({
  active,
  stage,
  progress,
  onSkip,
}: {
  active: boolean;
  stage: CinematicStage;
  progress: number;
  onSkip: () => void;
}) {
  if (!active) return null;

  return (
    <div className={styles.cinematicOverlay} aria-hidden="true">
      <div className={styles.cinematicVignette} />

      <div className={styles.cinematicStatus}>
        <span className={styles.cinematicEyebrow}>GALAXY EXPERIENCE</span>
        <strong>{STAGE_LABELS[stage]}</strong>
        <div className={styles.cinematicProgressTrack}>
          <span
            className={styles.cinematicProgressBar}
            style={{ transform: `scaleX(${Math.max(0.03, progress)})` }}
          />
        </div>
      </div>

      <button type="button" className={styles.cinematicSkip} onClick={onSkip}>
        Saltar intro
      </button>
    </div>
  );
}
