'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import styles from './GalaxyBackground.module.css';

const AUDIO_URL = '/audio/galaxy-ambient.mp3';
const AUDIO_ENABLED_KEY = 'galaxy-audio-v2.5-enabled';
const AUDIO_VOLUME_KEY = 'galaxy-audio-v2.5-volume';
const DEFAULT_VOLUME = 0.14;
const FADE_DURATION_MS = 1800;

type AudioStatus = 'off' | 'starting' | 'on' | 'missing';

function clampVolume(value: number) {
  return Math.min(0.35, Math.max(0, value));
}

export default function GalaxyAudioController({ hidden = false }: { hidden?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const fadeFrameRef = useRef<number | null>(null);
  const [status, setStatus] = useState<AudioStatus>('off');
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
    audio.preload = 'metadata';
    audio.volume = 0;
    audioRef.current = audio;
    return audio;
  }, []);

  const startAudio = useCallback(async () => {
    const audio = ensureAudio();
    setStatus('starting');

    try {
      audio.volume = 0;
      await audio.play();
      setStatus('on');
      localStorage.setItem(AUDIO_ENABLED_KEY, '1');
      fadeTo(audio, volume, FADE_DURATION_MS);
    } catch {
      setStatus('missing');
      localStorage.setItem(AUDIO_ENABLED_KEY, '0');
    }
  }, [ensureAudio, fadeTo, volume]);

  const stopAudio = useCallback(() => {
    const audio = audioRef.current;
    localStorage.setItem(AUDIO_ENABLED_KEY, '0');

    if (!audio) {
      setStatus('off');
      return;
    }

    fadeTo(audio, 0, 520, () => {
      audio.pause();
      setStatus('off');
    });
  }, [fadeTo]);

  useEffect(() => {
    const storedVolume = Number(localStorage.getItem(AUDIO_VOLUME_KEY));
    if (Number.isFinite(storedVolume) && storedVolume >= 0) {
      setVolume(clampVolume(storedVolume));
    }

    // We intentionally do not autoplay here. If the user previously left sound
    // enabled, the preference is preserved, but playback still waits for a real
    // user gesture to comply with browser autoplay rules.
    if (localStorage.getItem(AUDIO_ENABLED_KEY) !== '1') return;

    const resumeOnGesture = () => {
      void startAudio();
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
    };

    window.addEventListener('pointerdown', resumeOnGesture, { once: true });
    window.addEventListener('keydown', resumeOnGesture, { once: true });

    return () => {
      window.removeEventListener('pointerdown', resumeOnGesture);
      window.removeEventListener('keydown', resumeOnGesture);
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
    if (status === 'on' || status === 'starting') {
      stopAudio();
      return;
    }
    void startAudio();
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
              : status === 'missing'
                ? 'Audio no encontrado'
                : 'Activar sonido'}
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

      {status === 'missing' && (
        <span className={styles.audioHint}>Añade public/audio/galaxy-ambient.mp3</span>
      )}
    </div>
  );
}
