'use client';

import type { GalaxyHotspotId } from './galaxyConfig';
import styles from './GalaxyBackground.module.css';

export type PhotoPreset = 'general' | GalaxyHotspotId;

export default function GalaxyPhotoModeOverlay({
  active,
  capturing,
  gridEnabled,
  selectedPreset,
  onEnter,
  onExit,
  onCapture,
  onToggleGrid,
  onPreset,
}: {
  active: boolean;
  capturing: boolean;
  gridEnabled: boolean;
  selectedPreset: PhotoPreset;
  onEnter: () => void;
  onExit: () => void;
  onCapture: () => void;
  onToggleGrid: () => void;
  onPreset: (preset: PhotoPreset) => void;
}) {
  if (!active) {
    return (
      <button
        type="button"
        className={styles.photoModeLauncher}
        onClick={onEnter}
        aria-label="Activar modo fotografía"
      >
        <span aria-hidden="true">◎</span>
        <span>Modo foto</span>
      </button>
    );
  }

  if (capturing) return null;

  const presets: Array<{ id: PhotoPreset; label: string }> = [
    { id: 'general', label: 'General' },
    { id: 'core', label: 'Núcleo' },
    { id: 'inner-arm', label: 'Corriente' },
    { id: 'cluster', label: 'Cuna' },
  ];

  return (
    <>
      {gridEnabled && (
        <div className={styles.photoGrid} aria-hidden="true">
          <span className={styles.photoGridV1} />
          <span className={styles.photoGridV2} />
          <span className={styles.photoGridH1} />
          <span className={styles.photoGridH2} />
        </div>
      )}

      <div className={styles.photoModeBar} role="group" aria-label="Controles del modo fotografía">
        <div className={styles.photoModeTitle}>
          <span className={styles.photoModeEyebrow}>PHOTO MODE</span>
          <strong>Encuadre premium</strong>
        </div>

        <div className={styles.photoPresetRow}>
          {presets.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={selectedPreset === preset.id ? styles.photoPresetActive : styles.photoPreset}
              onClick={() => onPreset(preset.id)}
              aria-pressed={selectedPreset === preset.id}
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className={styles.photoModeActions}>
          <button type="button" className={styles.photoUtilityButton} onClick={onToggleGrid} aria-pressed={gridEnabled}>
            Cuadrícula
          </button>
          <button type="button" className={styles.photoCaptureButton} onClick={onCapture}>
            Capturar PNG
          </button>
          <button type="button" className={styles.photoUtilityButton} onClick={onExit}>
            Salir
          </button>
        </div>
      </div>
    </>
  );
}
