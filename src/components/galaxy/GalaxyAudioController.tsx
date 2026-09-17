'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './GalaxyBackground.module.css';

const AUDIO_URL = '/audio/galaxy-ambient.mp3';
const AUDIO_ENABLED_KEY = 'galaxy-audio-v2.5.2-enabled';
const AUDIO_VOLUME_KEY = 'galaxy-audio-v2.5.2-volume';
const LEGACY_ENABLED_KEYS = ['galaxy-audio-v2.5.1-enabled', 'galaxy-audio-v2.5-enabled'];
const LEGACY_VOLUME_KEYS = ['galaxy-audio-v2.5.1-volume', 'galaxy-audio-v2.5-volume'];
const DEFAULT_VOLUME = 0.14;
const GESTURE_FADE_DURATION_MS = 1400;
const MANUAL_FADE_DURATION_MS = 900;
const STOP_FADE_DURATION_MS = 520;

type AudioStatus = 'off' | 'starting' | 'primed' | 'on' | 'blocked' | 'missing';
type UnlockReason = 'gesture' | 'manual';

function clampVolume(value: number) {
  return Math.min(0.35, Math.max(0, value));
}

function isAutoplayBlocked(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

function getFirstStoredValue(keys: string[]) {
  for (const key of keys) {
    const value = localStorage.getItem(key);
    if (value !== null) return value;
  }

  return null;
}

export default function GalaxyAudioController({ hidden = false }: { hidden?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const attemptIdRef = useRef(0);
  const desiredEnabledRef = useRef(true);
  const mountedRef = useRef(true);
  const unlockingRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);

  const [status, setStatus] = useState<AudioStatus>('starting');
  const [volume, setVolume] = useState(DEFAULT_VOLUME);

  const cancelFade = useCallback(() => {
    if (fadeFrameRef.current !== null) {
      cancelAnimationFrame(fadeFrameRef.current);
      fadeFrameRef.current = null;
    }
  }, []);

  const fadeTo = useCallback(
    (audio: HTMLAudioElement, target: number, duration: number, onComplete?: () => void) => {
      cancelFade();
      const startVolume = audio.volume;
      const safeTarget = clampVolume(target);
      const startedAt = performance.now();

      if (duration <= 0) {
        audio.volume = safeTarget;
        onComplete?.();
        return;
      }

      const tick = (now: number) => {
        const progress = Math.min(1, (now - startedAt) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        audio.volume = startVolume + (safeTarget - startVolume) * eased;

        if (progress < 1) {
          fadeFrameRef.current = requestAnimationFrame(tick);
          return;
        }

        fadeFrameRef.current = null;
        onComplete?.();
      };

      fadeFrameRef.current = requestAnimationFrame(tick);
    },
    [cancelFade],
  );

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(AUDIO_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.muted = true;
    audio.volume = 0;

    audio.addEventListener('error', () => {
      if (!mountedRef.current) return;
      attemptIdRef.current += 1;
      setStatus('missing');
    });

    audioRef.current = audio;
    return audio;
  }, []);

  /**
   * Intenta arrancar el archivo silenciado. El autoplay muted suele estar
   * permitido y hace que la pista avance desde el inicio de la cinemática.
   */
  const primeAudio = useCallback(async () => {
    if (!desiredEnabledRef.current) return false;

    const audio = ensureAudio();
    const attemptId = ++attemptIdRef.current;

    setStatus('starting');

    try {
      audio.muted = true;
      audio.volume = 0;

      if (audio.paused) {
        await audio.play();
      }

      if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

      localStorage.setItem(AUDIO_ENABLED_KEY, '1');
      setStatus('primed');
      return true;
    } catch (error) {
      if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

      if (isAutoplayBlocked(error)) {
        setStatus('blocked');
        return false;
      }

      setStatus('missing');
      return false;
    }
  }, [ensureAudio]);

  /**
   * Debe ejecutarse dentro de una interacción real cuando el navegador exige
   * activación del usuario. Si la pista ya estaba reproduciéndose muted, solo
   * la desmutea y aplica el fade sin reiniciar currentTime.
   */
  const unlockAudio = useCallback(
    async (reason: UnlockReason) => {
      if (!desiredEnabledRef.current || unlockingRef.current) return false;

      unlockingRef.current = true;
      const audio = ensureAudio();
      const attemptId = ++attemptIdRef.current;

      try {
        audio.muted = false;

        if (audio.paused) {
          audio.volume = 0;
          await audio.play();
        }

        if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

        localStorage.setItem(AUDIO_ENABLED_KEY, '1');
        setStatus('on');

        fadeTo(
          audio,
          volumeRef.current,
          reason === 'gesture' ? GESTURE_FADE_DURATION_MS : MANUAL_FADE_DURATION_MS,
        );

        return true;
      } catch (error) {
        if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

        // Si incluso el intento con gesto falla por política, dejamos la pista
        // preparada en muted y permitimos un nuevo intento.
        audio.muted = true;

        if (isAutoplayBlocked(error)) {
          setStatus('blocked');
          return false;
        }

        setStatus('missing');
        return false;
      } finally {
        unlockingRef.current = false;
      }
    },
    [ensureAudio, fadeTo],
  );

  const stopAudio = useCallback(() => {
    desiredEnabledRef.current = false;
    attemptIdRef.current += 1;
    localStorage.setItem(AUDIO_ENABLED_KEY, '0');

    const audio = audioRef.current;

    if (!audio || audio.paused) {
      setStatus('off');
      return;
    }

    if (audio.muted || audio.volume <= 0.001) {
      audio.pause();
      audio.currentTime = 0;
      setStatus('off');
      return;
    }

    fadeTo(audio, 0, STOP_FADE_DURATION_MS, () => {
      audio.pause();
      audio.currentTime = 0;
      audio.muted = true;
      if (mountedRef.current) setStatus('off');
    });
  }, [fadeTo]);

  useEffect(() => {
    mountedRef.current = true;

    const storedVolumeRaw =
      localStorage.getItem(AUDIO_VOLUME_KEY) ?? getFirstStoredValue(LEGACY_VOLUME_KEYS);
    const storedVolume = Number(storedVolumeRaw);
    const initialVolume =
      Number.isFinite(storedVolume) && storedVolume >= 0
        ? clampVolume(storedVolume)
        : DEFAULT_VOLUME;

    volumeRef.current = initialVolume;
    setVolume(initialVolume);

    const currentPreference = localStorage.getItem(AUDIO_ENABLED_KEY);
    const legacyPreference = getFirstStoredValue(LEGACY_ENABLED_KEYS);

    // Primera visita: habilitado por defecto. Si el usuario lo desactivó en
    // una versión anterior, mantenemos su elección.
    const wantsAudio =
      currentPreference !== null
        ? currentPreference !== '0'
        : legacyPreference !== null
          ? legacyPreference !== '0'
          : true;

    desiredEnabledRef.current = wantsAudio;
    localStorage.setItem(AUDIO_ENABLED_KEY, wantsAudio ? '1' : '0');
    localStorage.setItem(AUDIO_VOLUME_KEY, String(initialVolume));

    if (!wantsAudio) {
      setStatus('off');
      return () => {
        mountedRef.current = false;
      };
    }

    // 1) Arrancamos muted para que la pista pueda avanzar desde el comienzo.
    void primeAudio();

    // 2) El primer gesto válido intenta convertir esa reproducción silenciosa
    //    en audio audible sin reiniciar la canción.
    const unlockOnGesture = () => {
      if (!desiredEnabledRef.current) return;

      const audio = audioRef.current;
      if (audio && !audio.paused && !audio.muted) return;

      void unlockAudio('gesture');
    };

    window.addEventListener('pointerdown', unlockOnGesture, { passive: true });
    window.addEventListener('touchstart', unlockOnGesture, { passive: true });
    window.addEventListener('keydown', unlockOnGesture);

    return () => {
      mountedRef.current = false;
      window.removeEventListener('pointerdown', unlockOnGesture);
      window.removeEventListener('touchstart', unlockOnGesture);
      window.removeEventListener('keydown', unlockOnGesture);
    };
  }, [primeAudio, unlockAudio]);

  useEffect(() => {
    volumeRef.current = volume;

    const audio = audioRef.current;
    if (!audio || status !== 'on') return;
    fadeTo(audio, volume, 260);
  }, [fadeTo, status, volume]);

  useEffect(() => {
    return () => {
      cancelFade();
      const audio = audioRef.current;
      if (!audio) return;
      audio.pause();
      audio.src = '';
      audioRef.current = null;
    };
  }, [cancelFade]);

  const toggle = () => {
    if (status === 'on') {
      stopAudio();
      return;
    }

    desiredEnabledRef.current = true;
    localStorage.setItem(AUDIO_ENABLED_KEY, '1');
    void unlockAudio('manual');
  };

  const changeVolume = (value: number) => {
    const next = clampVolume(value);
    volumeRef.current = next;
    setVolume(next);
    localStorage.setItem(AUDIO_VOLUME_KEY, String(next));
  };

  if (hidden) return null;

  const waitingForGesture = status === 'primed' || status === 'blocked';

  return (
    <div className={styles.audioUi}>
      <button
        type="button"
        className={`${styles.audioToggle} ${status === 'on' ? styles.audioToggleActive : ''}`}
        onClick={toggle}
        aria-pressed={status === 'on'}
        aria-label={status === 'on' ? 'Silenciar ambientación' : 'Activar ambientación'}
      >
        <span className={styles.audioGlyph} aria-hidden="true">
          {status === 'on' ? '◉' : '○'}
        </span>
        <span>
          {status === 'starting'
            ? 'Preparando audio…'
            : status === 'on'
              ? 'Ambientación'
              : status === 'primed'
                ? 'Audio preparado'
                : status === 'blocked'
                  ? 'Activar sonido'
                  : status === 'missing'
                    ? 'Audio no encontrado'
                    : 'Sonido desactivado'}
        </span>
      </button>

      {status === 'on' && (
        <label className={styles.volumeControl}>
          <span>Vol.</span>
          <input
            type="range"
            min="0"
            max="0.35"
            step="0.01"
            value={volume}
            onChange={(event) => changeVolume(Number(event.target.value))}
            aria-label="Volumen de ambientación"
          />
        </label>
      )}

      {waitingForGesture && (
        <span className={styles.audioHint}>
          La pista ya está preparada. El primer clic, toque o tecla habilita el sonido.
        </span>
      )}

      {status === 'missing' && (
        <span className={styles.audioHint}>Añade public/audio/galaxy-ambient.mp3</span>
      )}
    </div>
  );
}
