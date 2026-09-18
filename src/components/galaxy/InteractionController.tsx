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

type ActivePointer = {
  id: number;
  x: number;
  y: number;
  pointerType: string;
};

const MOBILE_BREAKPOINT = 640;
const DESKTOP_MIN_ZOOM = 5.5;
const MOBILE_MIN_ZOOM = 3.8;
const DESKTOP_MAX_ZOOM = 19.5;
const MOBILE_MAX_ZOOM = 27;

function getPointerDistance(a: ActivePointer, b: ActivePointer) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export default function InteractionController({
  enabled,
  interactionRef,
}: {
  enabled: boolean;
  interactionRef: RefObject<InteractionState>;
}) {
  const gl = useThree((state) => state.gl);
  const width = useThree((state) => state.size.width);

  useEffect(() => {
    const element = gl.domElement;
    const isMobile = width < MOBILE_BREAKPOINT;
    const minZoom = isMobile ? MOBILE_MIN_ZOOM : DESKTOP_MIN_ZOOM;
    const maxZoom = isMobile ? MOBILE_MAX_ZOOM : DESKTOP_MAX_ZOOM;
    const activePointers = new Map<number, ActivePointer>();

    let dragging = false;
    let dragPointerId: number | null = null;
    let previousX = 0;
    let previousY = 0;

    let pinchStartDistance = 0;
    let pinchStartZoom = 0;

    const getTouchPointers = () =>
      Array.from(activePointers.values()).filter((pointer) => pointer.pointerType === 'touch');

    const beginPinch = () => {
      const touches = getTouchPointers();
      const interaction = interactionRef.current;
      if (!interaction || touches.length < 2) return;

      pinchStartDistance = Math.max(1, getPointerDistance(touches[0], touches[1]));
      pinchStartZoom = interaction.targetZoom;
      dragging = false;
      dragPointerId = null;
      element.style.cursor = 'grabbing';
    };

    const beginSinglePointerDrag = (pointer: ActivePointer) => {
      dragging = true;
      dragPointerId = pointer.id;
      previousX = pointer.x;
      previousY = pointer.y;
      pinchStartDistance = 0;
      element.style.cursor = 'grabbing';
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!enabled || (event.pointerType === 'mouse' && event.button !== 0)) return;

      const pointer: ActivePointer = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        pointerType: event.pointerType,
      };

      activePointers.set(event.pointerId, pointer);
      element.setPointerCapture?.(event.pointerId);

      const touches = getTouchPointers();
      if (touches.length >= 2) {
        beginPinch();
        return;
      }

      beginSinglePointerDrag(pointer);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!enabled) return;

      const storedPointer = activePointers.get(event.pointerId);
      if (storedPointer) {
        storedPointer.x = event.clientX;
        storedPointer.y = event.clientY;
      }

      const interaction = interactionRef.current;
      if (!interaction) return;

      const touches = getTouchPointers();

      // Two-finger pinch zoom on touch devices. Increasing the distance between
      // fingers moves the camera closer (smaller orbit radius), while closing
      // the fingers moves it farther away.
      if (touches.length >= 2) {
        const distance = Math.max(1, getPointerDistance(touches[0], touches[1]));

        if (pinchStartDistance <= 0) {
          beginPinch();
          return;
        }

        const scale = distance / pinchStartDistance;
        interaction.targetZoom = THREE.MathUtils.clamp(
          pinchStartZoom / scale,
          minZoom,
          maxZoom,
        );
        return;
      }

      if (!dragging || dragPointerId !== event.pointerId) return;

      const dx = event.clientX - previousX;
      const dy = event.clientY - previousY;
      previousX = event.clientX;
      previousY = event.clientY;

      // Horizontal orbit is intentionally unbounded: the camera can now
      // complete full 360° turns (and continue rotating) in either direction.
      interaction.targetYaw -= dx * 0.0036;
      interaction.targetPitch = THREE.MathUtils.clamp(
        interaction.targetPitch + dy * 0.0032,
        -0.18,
        0.42,
      );
    };

    const stopPointer = (event: PointerEvent) => {
      if (!activePointers.has(event.pointerId)) return;

      activePointers.delete(event.pointerId);
      element.releasePointerCapture?.(event.pointerId);

      const touches = getTouchPointers();

      if (touches.length >= 2) {
        beginPinch();
        return;
      }

      if (activePointers.size === 1) {
        const remaining = Array.from(activePointers.values())[0];
        beginSinglePointerDrag(remaining);
        return;
      }

      dragging = false;
      dragPointerId = null;
      pinchStartDistance = 0;
      element.style.cursor = enabled ? 'grab' : '';
    };

    const onWheel = (event: WheelEvent) => {
      if (!enabled) return;
      const interaction = interactionRef.current;
      if (!interaction) return;

      event.preventDefault();
      interaction.targetZoom = THREE.MathUtils.clamp(
        interaction.targetZoom + event.deltaY * 0.008,
        minZoom,
        maxZoom,
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
          interaction.targetYaw += 0.08;
          break;
        case 'ArrowRight':
          interaction.targetYaw -= 0.08;
          break;
        case 'ArrowUp':
          interaction.targetPitch = THREE.MathUtils.clamp(interaction.targetPitch - 0.055, -0.18, 0.42);
          break;
        case 'ArrowDown':
          interaction.targetPitch = THREE.MathUtils.clamp(interaction.targetPitch + 0.055, -0.18, 0.42);
          break;
        case '+':
        case '=':
          interaction.targetZoom = THREE.MathUtils.clamp(interaction.targetZoom - 0.8, minZoom, maxZoom);
          break;
        case '-':
        case '_':
          interaction.targetZoom = THREE.MathUtils.clamp(interaction.targetZoom + 0.8, minZoom, maxZoom);
          break;
        case 'Home':
          interaction.targetYaw = DEFAULT_CAMERA.yaw;
          interaction.targetPitch = DEFAULT_CAMERA.pitch;
          interaction.targetZoom = THREE.MathUtils.clamp(DEFAULT_CAMERA.zoom, minZoom, maxZoom);
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
    element.addEventListener('pointerup', stopPointer);
    element.addEventListener('pointercancel', stopPointer);
    element.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKeyDown);

    return () => {
      element.style.cursor = '';
      element.style.touchAction = '';
      activePointers.clear();
      element.removeEventListener('pointerdown', onPointerDown);
      element.removeEventListener('pointermove', onPointerMove);
      element.removeEventListener('pointerup', stopPointer);
      element.removeEventListener('pointercancel', stopPointer);
      element.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [enabled, gl, interactionRef, width]);

  return null;
}
