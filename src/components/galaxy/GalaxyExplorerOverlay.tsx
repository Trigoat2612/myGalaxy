'use client';

import { GALAXY_HOTSPOTS, type GalaxyHotspotId } from './galaxyConfig';
import styles from './GalaxyBackground.module.css';

export default function GalaxyExplorerOverlay({
  enabled,
  selected,
  presentationActive,
  onToggle,
  onReset,
  onSelect,
  onTogglePresentation,
}: {
  enabled: boolean;
  selected: GalaxyHotspotId | null;
  presentationActive: boolean;
  onToggle: () => void;
  onReset: () => void;
  onSelect: (id: GalaxyHotspotId | null) => void;
  onTogglePresentation: () => void;
}) {
  const activeHotspot = GALAXY_HOTSPOTS.find((item) => item.id === selected) ?? null;

  return (
    <div className={styles.explorerUi}>
      <button
        type="button"
        className={`${styles.explorerToggle} ${enabled ? styles.explorerToggleActive : ''}`}
        onClick={onToggle}
        aria-pressed={enabled}
        aria-controls="galaxy-explorer-panel"
        aria-expanded={enabled}
      >
        <span className={styles.explorerDot} aria-hidden="true" />
        {enabled ? 'Salir de exploración' : 'Explorar galaxia'}
      </button>

      {enabled && (
        <div
          id="galaxy-explorer-panel"
          className={styles.explorerPanel}
          role="region"
          aria-label="Controles de exploración de la galaxia"
        >
          <div className={styles.explorerPanelHeader}>
            <div aria-live="polite" aria-atomic="true">
              <span className={styles.explorerEyebrow}>
                {presentationActive ? 'PRESENTACIÓN AUTOMÁTICA' : 'MODO EXPLORACIÓN'}
              </span>
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

          <div className={styles.regionButtons} aria-label="Regiones galácticas">
            <button
              type="button"
              className={selected === null ? styles.regionButtonActive : styles.regionButton}
              onClick={() => onSelect(null)}
              aria-pressed={selected === null}
            >
              General
            </button>

            {GALAXY_HOTSPOTS.map((hotspot) => (
              <button
                type="button"
                key={hotspot.id}
                className={selected === hotspot.id ? styles.regionButtonActive : styles.regionButton}
                onClick={() => onSelect(hotspot.id)}
                aria-pressed={selected === hotspot.id}
              >
                {hotspot.shortLabel}
              </button>
            ))}
          </div>

          <button
            type="button"
            className={`${styles.presentationButton} ${presentationActive ? styles.presentationButtonActive : ''}`}
            onClick={onTogglePresentation}
            aria-pressed={presentationActive}
          >
            <span aria-hidden="true">{presentationActive ? 'Ⅱ' : '▶'}</span>
            {presentationActive ? 'Detener presentación' : 'Presentación automática'}
          </button>

          <div className={styles.controlsHint} aria-label="Controles disponibles">
            <span>Arrastrar · orbitar</span>
            <span>Rueda / + − · zoom</span>
            <span>Flechas · orientar</span>
            <span>Inicio · restablecer</span>
          </div>
        </div>
      )}
    </div>
  );
}
