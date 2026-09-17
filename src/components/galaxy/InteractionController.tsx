'use client';

import { useEffect, type RefObject } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

import { DEFAULT_CAMERA } from './galaxyConfig';

export type InteractionState = {
  yaw: number;
  pitch: number;
  zoom: number;
  targetYaw: number;
  targetPitch: number;
  targetZoom: number;
};

const MIN_ZOOM = 8.2;
const MAX_ZOOM = 19.5;

export default function InteractionController({
  enabled,
  interactionRef,
}: {
  enabled: boolean;
  interactionRef: RefObject<InteractionState>;
}) {
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const element = gl.domElement;
    let dragging = false;
    let previousX = 0;
    let previousY = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (!enabled || event.button !== 0) return;
      dragging = true;
      previousX = event.clientX;
      previousY = event.clientY;
      element.setPointerCapture?.(event.pointerId);
      element.style.cursor = 'grabbing';
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!enabled || !dragging) return;
      const interaction = interactionRef.current;
      if (!interaction) return;

      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      previousX = event.clientX;
      previousY = event.clientY;

      interaction.targetYaw = THREE.MathUtils.clamp(
        interaction.targetYaw - dx * 0.0036,
        -0.9,
        0.9,
      );
      interaction.targetPitch = THREE.MathUtils.clamp(
        interaction.targetPitch + dy * 0.0032,
        -0.18,
        0.42,
      );
    };

    const stopDragging = (event: PointerEvent) => {
      if (!dragging) return;
      dragging = false;
      element.releasePointerCapture?.(event.pointerId);
      element.style.cursor = enabled ? 'grab' : '';
    };

    const onWheel = (event: WheelEvent) => {
      if (!enabled) return;
      const interaction = interactionRef.current;
      if (!interaction) return;

      event.preventDefault();
      interaction.targetZoom = THREE.MathUtils.clamp(
        interaction.targetZoom + event.deltaY * 0.008,
        MIN_ZOOM,
        MAX_ZOOM,
      );
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!enabled) return;
      const interaction = interactionRef.current;
      if (!interaction) return;

      const target = event.target as HTMLElement | null;
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return;

      let handled = true;

      switch (event.key) {
        case 'ArrowLeft':
          interaction.targetYaw = THREE.MathUtils.clamp(interaction.targetYaw + 0.08, -0.9, 0.9);
          break;
        case 'ArrowRight':
          interaction.targetYaw = THREE.MathUtils.clamp(interaction.targetYaw - 0.08, -0.9, 0.9);
          break;
        case 'ArrowUp':
          interaction.targetPitch = THREE.MathUtils.clamp(interaction.targetPitch - 0.055, -0.18, 0.42);
          break;
        case 'ArrowDown':
          interaction.targetPitch = THREE.MathUtils.clamp(interaction.targetPitch + 0.055, -0.18, 0.42);
          break;
        case '+':
        case '=':
          interaction.targetZoom = THREE.MathUtils.clamp(interaction.targetZoom - 0.8, MIN_ZOOM, MAX_ZOOM);
          break;
        case '-':
        case '_':
          interaction.targetZoom = THREE.MathUtils.clamp(interaction.targetZoom + 0.8, MIN_ZOOM, MAX_ZOOM);
          break;
        case 'Home':
          interaction.targetYaw = DEFAULT_CAMERA.yaw;
          interaction.targetPitch = DEFAULT_CAMERA.pitch;
          interaction.targetZoom = DEFAULT_CAMERA.zoom;
          break;
        default:
          handled = false;
      }

      if (handled) event.preventDefault();
    };

    element.style.cursor = enabled ? 'grab' : '';
    element.style.touchAction = enabled ? 'none' : 'auto';

    element.addEventListener('pointerdown', onPointerDown);
    element.addEventListener('pointermove', onPointerMove);
    element.addEventListener('pointerup', stopDragging);
    element.addEventListener('pointercancel', stopDragging);
    element.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      element.style.cursor = '';
      element.style.touchAction = '';
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', stopDragging);
      element.removeEventListener('pointercancel', stopDragging);
      element.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, gl, interactionRef]);

  return null;
}
