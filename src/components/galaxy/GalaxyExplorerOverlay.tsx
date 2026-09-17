'use client';

import { GALAXY_HOTSPOTS, type GalaxyHotspotId } from './galaxyConfig';
import styles from './GalaxyBackground.module.css';

export default function GalaxyExplorerOverlay({
  enabled,
  selected,
  onToggle,
  onReset,
  onSelect,
}: {
  enabled: boolean;
  selected: GalaxyHotspotId | null;
  onToggle: () => void;
  onReset: () => void;
  onSelect: (id: GalaxyHotspotId | null) => void;
}) {
  const activeHotspot = GALAXY_HOTSPOTS.find((item) => item.id === selected) ?? null;

  return (
    <div className={styles.explorerUi}>
      <button
        type="button"
        className={`${styles.explorerToggle} ${enabled ? styles.explorerToggleActive : ''}`}
        onClick={onToggle}
        aria-pressed={enabled}
      >
        <span className={styles.explorerDot} />
        {enabled ? 'Salir de exploración' : 'Explorar galaxia'}
      </button>

      {enabled && (
        <div className={styles.explorerPanel}>
          <div className={styles.explorerPanelHeader}>
            <div>
              <span className={styles.explorerEyebrow}>MODO EXPLORACIÓN</span>
              <strong>{activeHotspot?.label ?? 'Vista general'}</strong>
            </div>
            <button type="button" className={styles.resetButton} onClick={onReset}>
              Restablecer
            </button>
          </div>

          <p>
            {activeHotspot?.description ??
              'Arrastra para orbitar, usa la rueda para acercarte y selecciona una región.'}
          </p>

          <div className={styles.regionButtons}>
            <button
              type="button"
              className={selected === null ? styles.regionButtonActive : styles.regionButton}
              onClick={() => onSelect(null)}
            >
              General
            </button>

            {GALAXY_HOTSPOTS.map((hotspot) => (
              <button
                type="button"
                key={hotspot.id}
                className={selected === hotspot.id ? styles.regionButtonActive : styles.regionButton}
                onClick={() => onSelect(hotspot.id)}
              >
                {hotspot.shortLabel}
              </button>
            ))}
          </div>

          <div className={styles.controlsHint}>
            <span>Arrastrar · orbitar</span>
            <span>Rueda · zoom</span>
            <span>Click · enfocar</span>
          </div>
        </div>
      )}
    </div>
  );
}
