'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './GalaxyBackground.module.css';

const AUDIO_URL = '/audio/galaxy-ambient.mp3';
const AUDIO_ENABLED_KEY = 'galaxy-audio-v2.5.1-enabled';
const AUDIO_VOLUME_KEY = 'galaxy-audio-v2.5.1-volume';
const LEGACY_ENABLED_KEY = 'galaxy-audio-v2.5-enabled';
const LEGACY_VOLUME_KEY = 'galaxy-audio-v2.5-volume';
const DEFAULT_VOLUME = 0.14;
const AUTO_FADE_DURATION_MS = 2400;
const GESTURE_FADE_DURATION_MS = 1400;
const STOP_FADE_DURATION_MS = 520;

type AudioStatus = 'off' | 'starting' | 'on' | 'blocked' | 'missing';
type StartReason = 'autoplay' | 'gesture' | 'manual';

function clampVolume(value: number) {
  return Math.min(0.35, Math.max(0, value));
}

function isAutoplayBlocked(error: unknown) {
  return error instanceof DOMException && error.name === 'NotAllowedError';
}

export default function GalaxyAudioController({ hidden = false }: { hidden?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const attemptIdRef = useRef(0);
  const desiredEnabledRef = useRef(true);
  const mountedRef = useRef(true);

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
    audio.volume = 0;

    audio.addEventListener('error', () => {
      if (!mountedRef.current) return;
      attemptIdRef.current += 1;
      setStatus('missing');
    });

    audioRef.current = audio;
    return audio;
  }, []);

  const startAudio = useCallback(
    async (reason: StartReason) => {
      if (!desiredEnabledRef.current) return false;

      const audio = ensureAudio();
      const attemptId = ++attemptIdRef.current;

      setStatus('starting');

      try {
        if (audio.paused) {
          audio.volume = 0;
        }

        await audio.play();

        if (!mountedRef.current || attemptId !== attemptIdRef.current) return false;

        localStorage.setItem(AUDIO_ENABLED_KEY, '1');
        setStatus('on');

        const fadeDuration = reason === 'autoplay' ? AUTO_FADE_DURATION_MS : GESTURE_FADE_DURATION_MS;
        fadeTo(audio, volume, fadeDuration);
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
    },
    [ensureAudio, fadeTo, volume],
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

    fadeTo(audio, 0, STOP_FADE_DURATION_MS, () => {
      audio.pause();
      if (mountedRef.current) setStatus('off');
    });
  }, [fadeTo]);

  useEffect(() => {
    mountedRef.current = true;

    const storedVolumeRaw =
      localStorage.getItem(AUDIO_VOLUME_KEY) ?? localStorage.getItem(LEGACY_VOLUME_KEY);
    const storedVolume = Number(storedVolumeRaw);
    const initialVolume =
      Number.isFinite(storedVolume) && storedVolume >= 0
        ? clampVolume(storedVolume)
        : DEFAULT_VOLUME;

    setVolume(initialVolume);

    const currentPreference = localStorage.getItem(AUDIO_ENABLED_KEY);
    const legacyPreference = localStorage.getItem(LEGACY_ENABLED_KEY);

    // Primera visita: el audio queda habilitado por defecto y se intenta autoplay.
    // Si el usuario lo había desactivado en V2.5, respetamos esa decisión.
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

    // Primer intento: si la política del navegador lo permite, comienza sin gesto.
    void startAudio('autoplay');

    // Fallback transparente: cualquier primer gesto válido vuelve a intentar play().
    const unlockOnGesture = () => {
      if (!desiredEnabledRef.current) return;

      const audio = audioRef.current;
      if (audio && !audio.paused) return;

      void startAudio('gesture');
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
  }, [startAudio]);

  useEffect(() => {
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
    const audio = audioRef.current;

    if (status === 'on' || (status === 'starting' && audio && !audio.paused)) {
      stopAudio();
      return;
    }

    desiredEnabledRef.current = true;
    localStorage.setItem(AUDIO_ENABLED_KEY, '1');
    void startAudio('manual');
  };

  const changeVolume = (value: number) => {
    const next = clampVolume(value);
    setVolume(next);
    localStorage.setItem(AUDIO_VOLUME_KEY, String(next));
  };

  if (hidden) return null;

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
            ? 'Iniciando…'
            : status === 'on'
              ? 'Ambientación'
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

      {status === 'blocked' && (
        <span className={styles.audioHint}>Se activará con tu primer clic, toque o tecla.</span>
      )}

      {status === 'missing' && (
        <span className={styles.audioHint}>Añade public/audio/galaxy-ambient.mp3</span>
      )}
    </div>
  );
}
