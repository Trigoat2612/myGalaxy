# Galaxia Responsive V3.1.7 — Mobile Cinematic Zoom

V3.1.7 mantiene la experiencia estable de V3.1.6 y añade una trayectoria cinematográfica específica para móvil con un encuadre más cercano y mayor impacto visual.

## Cambios V3.1.7

- Cinemática móvil con trayectoria Bézier propia.
- Inicio móvil más cercano: cámara Z aproximada `21.1` frente al arranque desktop `24.8`.
- Aproximación más intensa al núcleo mediante un control point Z `1.55`.
- FOV cinematográfico móvil dinámico: aproximadamente `50 → 45.5 → 54`.
- El tramo `core` recibe el encuadre más cerrado.
- Durante `reveal`, el FOV vuelve suavemente al valor móvil normal (`54`).
- Al terminar la intro, la cámara entrega el control exactamente en la vista general móvil (`21.5`).
- Desktop conserva su cinematografía anterior.
- No se modifican pinch zoom, labels móviles, audio, hotspots, presentación automática ni `/webgpu-lab`.

## Vista móvil

- Zoom general: `21.5`.
- FOV general: `54`.
- FOV cinematográfico mínimo: `45.5`.
- Zoom de exploración móvil: `3.8 → 27`.

## Repetir cinemática

```js
sessionStorage.removeItem('galaxy-cinematic-v3.1.7-seen');
location.reload();
```

## Audio

Conservar manualmente:

```text
public/audio/galaxy-ambient.mp3
```

## Pruebas

```bash
npm install
npm run build
npm run dev
```

Validar en móvil:

1. Reproducir la intro completa.
2. Confirmar mayor presencia de la galaxia durante `approach`.
3. Confirmar un close-up más fuerte durante `Núcleo galáctico`.
4. Verificar que `reveal` vuelve progresivamente a la vista general.
5. Confirmar que no existe salto al finalizar la cinemática.
6. Entrar en exploración y validar pinch zoom hasta `3.8`.
7. Confirmar audio, hotspots y presentación automática.
8. Probar `/webgpu-lab` por separado.
