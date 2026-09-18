'use client';

import styles from './GalaxyBackground.module.css';
import {
  GALAXY_VISUAL_PROFILES,
  GALAXY_VISUAL_PROFILE_ORDER,
  type GalaxyVisualProfileId,
} from './visualProfiles';

export default function GalaxyVisualProfileOverlay({
  value,
  onChange,
  hidden = false,
}: {
  value: GalaxyVisualProfileId;
  onChange: (value: GalaxyVisualProfileId) => void;
  hidden?: boolean;
}) {
  if (hidden) return null;

  const current = GALAXY_VISUAL_PROFILES[value];

  return (
    <div className={styles.profileUi}>
      <div className={styles.profilePanel}>
        <span className={styles.profileEyebrow}>PERFIL VISUAL</span>
        <strong>Color grading galáctico</strong>
        <p className={styles.profileMeta}>{current.description}</p>

        <div className={styles.profileButtons}>
          {GALAXY_VISUAL_PROFILE_ORDER.map((profileId) => {
            const profile = GALAXY_VISUAL_PROFILES[profileId];
            const active = profileId === value;

            return (
              <button
                key={profileId}
                type="button"
                className={active ? styles.profileButtonActive : styles.profileButton}
                onClick={() => onChange(profileId)}
                aria-pressed={active}
              >
                {profile.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
