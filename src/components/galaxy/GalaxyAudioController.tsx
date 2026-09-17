'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './GalaxyBackground.module.css';

const AUDIO_URL = '/audio/galaxy-ambient.mp3';
const AUDIO_ENABLED_KEY = 'galaxy-audio-v2.6.2-enabled';
const AUDIO_VOLUME_KEY = 'galaxy-audio-v2.6.2-volume';
const LEGACY_ENABLED_KEYS = [
  'galaxy-audio-v2.6.1-enabled',
  'galaxy-audio-v2.5.2-enabled',
  'galaxy-audio-v2.5.1-enabled',
  'galaxy-audio-v2.5-enabled',
];
const LEGACY_VOLUME_KEYS = [
  'galaxy-audio-v2.6.1-volume',
  'galaxy-audio-v2.5.2-volume',
  'galaxy-audio-v2.5.1-volume',
  'galaxy-audio-v2.5-volume',
];
const DEFAULT_VOLUME = 0.14;
const GESTURE_FADE_DURATION_MS = 1400;
const MANUAL_FADE_DURATION_MS = 900;
const STOP_FADE_DURATION_MS = 520;
const VISIBILITY_FADE_DURATION_MS = 450;
const READY_TIMEOUT_MS = 12000;

type AudioStatus = 'off' | 'starting' | 'primed' | 'on' | 'blocked' | 'missing';
type UnlockReason = 'gesture' | 'manual';
type VisibilityResumeMode = 'audible' | 'primed' | null;

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

type AudioResourceState = 'available' | 'missing' | 'unknown';

/**
 * Verifica la existencia del recurso sin confundir errores del elemento
 * <audio> con un 404 real. Solo 404/410 se consideran ausencia confirmada.
 */
async function verifyAudioResource(): Promise<AudioResourceState> {
  try {
    const response = await fetch(AUDIO_URL, {
      method: 'HEAD',
      cache: 'no-store',
    });

    if (response.ok) return 'available';
    if (response.status === 404 || response.status === 410) return 'missing';

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * Espera a que el navegador haya cargado datos reales del archivo.
 * Un timeout NO significa que el archivo no exista; una red lenta no debe
 * convertirse mágicamente en un falso "Audio no encontrado".
 */
function waitForPlayable(audio: HTMLAudioElement) {
  if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve, reject) => {
    let settled = false;

    const cleanup = () => {
      audio.removeEventListener('loadeddata', handleReady);
      audio.removeEventListener('canplay', handleReady);
      audio.removeEventListener('error', handleError);
      window.clearTimeout(timeoutId);
    };

    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };

    const handleReady = () => finish(true);

    const handleError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(audio.error ?? new Error('No se pudo cargar el audio.'));
    };

    const timeoutId = window.setTimeout(() => finish(false), READY_TIMEOUT_MS);

    audio.addEventListener('loadeddata', handleReady, { once: true });
    audio.addEventListener('canplay', handleReady, { once: true });
    audio.addEventListener('error', handleError, { once: true });

    // Fuerza la carga si el navegador todavía no la inició.
    if (audio.networkState === HTMLMediaElement.NETWORK_EMPTY) {
      audio.load();
    }
  });
}

export default function GalaxyAudioController({ hidden = false }: { hidden?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const attemptIdRef = useRef(0);
  const desiredEnabledRef = useRef(true);
  const mountedRef = useRef(true);
  const unlockingRef = useRef(false);
  const volumeRef = useRef(DEFAULT_VOLUME);
  const visibilityResumeModeRef = useRef<VisibilityResumeMode>(null);
  const resourceCheckRef = useRef<Promise<AudioResourceState> | null>(null);

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

  const checkResource = useCallback(() => {
    if (!resourceCheckRef.current) {
      resourceCheckRef.current = verifyAudioResource();
    }

    return resourceCheckRef.current;
  }, []);

  const markMissingOnlyIfConfirmed = useCallback(async () => {
    const resourceState = await checkResource();

    if (!mountedRef.current || resourceState !== 'missing') return false;

    attemptIdRef.current += 1;
    setStatus('missing');
    return true;
  }, [checkResource]);


  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;

    const audio = new Audio(AUDIO_URL);
    audio.loop = true;
    audio.preload = 'auto';
    audio.muted = true;
    audio.volume = 0;

    const handleError = () => {
      // El error del elemento media por sí solo no demuestra que el archivo
      // no exista. Confirmamos la URL por HTTP antes de mostrar "missing".
      void markMissingOnlyIfConfirmed();
    };

    audio.addEventListener('error', handleError);
    audioRef.current = audio;
    audio.load();

    return audio;
  }, [markMissingOnlyIfConfirmed]);

  /**
   * Arranca el archivo silenciado. Primero espera datos reales del media.
   * El estado "missing" solo se establece tras confirmar un 404/410 por HTTP.
   */
  const primeAudio = useCallback(async () => {
    if (!desiredEnabledRef.current) return false;

    const audio = ensureAudio();
    const attemptId = ++attemptIdRef.current;

    setStatus('starting');

    try {
      try {
        await waitForPlayable(audio);
      } catch {
        if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;
        if (await markMissingOnlyIfConfirmed()) return false;
        setStatus('blocked');
        return false;
      }

      if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

      audio.muted = true;
      audio.volume = 0;

      if (audio.paused) {
        await audio.play();
      }

      if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

      localStorage.setItem(AUDIO_ENABLED_KEY, '1');
      setStatus('primed');

      // Si la reproducción terminó de arrancar justo después de ocultar la
      // pestaña, la pausamos aquí también. visibilitychange pudo dispararse
      // antes de que play() resolviera.
      if (document.visibilityState === 'hidden') {
        visibilityResumeModeRef.current = 'primed';
        audio.pause();
      }

      return true;
    } catch (error) {
      if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

      if (isAutoplayBlocked(error)) {
        setStatus('blocked');
        return false;
      }

      if (await markMissingOnlyIfConfirmed()) return false;

      // AbortError, interrupciones de carga y otros rechazos transitorios no
      // significan que el archivo falte. Permitimos reintentar con gesto.
      setStatus('blocked');
      return false;
    }
  }, [ensureAudio, markMissingOnlyIfConfirmed]);

  const unlockAudio = useCallback(
    async (reason: UnlockReason) => {
      if (!desiredEnabledRef.current || unlockingRef.current) return false;

      unlockingRef.current = true;
      const audio = ensureAudio();
      const attemptId = ++attemptIdRef.current;

      try {
        if (audio.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
          try {
            await waitForPlayable(audio);
          } catch {
            if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;
            if (await markMissingOnlyIfConfirmed()) return false;
            setStatus('blocked');
            return false;
          }
        }

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

        audio.muted = true;

        if (isAutoplayBlocked(error)) {
          setStatus('blocked');
          return false;
        }

        if (await markMissingOnlyIfConfirmed()) return false;

        setStatus('blocked');
        return false;
      } finally {
        unlockingRef.current = false;
      }
    },
    [ensureAudio, fadeTo, markMissingOnlyIfConfirmed],
  );

  const stopAudio = useCallback(() => {
    desiredEnabledRef.current = false;
    visibilityResumeModeRef.current = null;
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

    void primeAudio();

    const unlockOnGesture = () => {
      if (!desiredEnabledRef.current || document.visibilityState === 'hidden') return;

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

  /**
   * La pausa visual del Canvas no afecta al HTMLAudioElement. Este listener
   * mantiene ambos comportamientos sincronizados y conserva currentTime.
   */
  useEffect(() => {
    const handleVisibilityChange = async () => {
      const audio = audioRef.current;
      if (!audio || !desiredEnabledRef.current) return;

      if (document.visibilityState === 'hidden') {
        cancelFade();

        if (!audio.paused) {
          visibilityResumeModeRef.current =
            status === 'on' && !audio.muted ? 'audible' : 'primed';
          audio.pause();
        }

        return;
      }

      const resumeMode = visibilityResumeModeRef.current;
      visibilityResumeModeRef.current = null;

      if (!resumeMode || !desiredEnabledRef.current) return;

      try {
        if (resumeMode === 'audible') {
          audio.muted = false;
          audio.volume = 0;
          await audio.play();

          if (!mountedRef.current) return;
          setStatus('on');
          fadeTo(audio, volumeRef.current, VISIBILITY_FADE_DURATION_MS);
          return;
        }

        audio.muted = true;
        audio.volume = 0;
        await audio.play();

        if (mountedRef.current) setStatus('primed');
      } catch (error) {
        if (!mountedRef.current) return;

        if (isAutoplayBlocked(error)) {
          audio.muted = true;
          setStatus('blocked');
          return;
        }

        if (!(await markMissingOnlyIfConfirmed())) {
          setStatus('blocked');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [cancelFade, fadeTo, markMissingOnlyIfConfirmed, status]);

  useEffect(() => {
    volumeRef.current = volume;

    const audio = audioRef.current;
    if (!audio || status !== 'on') return;
    fadeTo(audio, volume, 260);
  }, [fadeTo, status, volume]);

  useEffect(() => {
    return () => {
      cancelFade();
      visibilityResumeModeRef.current = null;
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
          La pista está preparada. El primer clic, toque o tecla habilita el sonido.
        </span>
      )}

      {status === 'missing' && (
        <span className={styles.audioHint}>
          Verifica que exista public/audio/galaxy-ambient.mp3 y que Vercel lo publique correctamente.
        </span>
      )}
    </div>
  );
}
