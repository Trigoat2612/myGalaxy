# Galaxia Responsive V2.4.2 · Cinematic Galaxy Experience

Evolución de la V2.3.2 orientada a presentación cinematográfica sin alterar la galaxia, los hotspots premium ni la distribución estelar estabilizada.

## Novedades

- Intro cinematográfica breve (7.4 s).
- Cámara desde espacio profundo hacia la galaxia.
- Aproximación al núcleo y apertura posterior a vista general.
- Aparición progresiva de capas: estrellas profundas, nebulosa/galaxia y estrellas fugaces.
- Overlay cinematográfico con estado y barra de progreso.
- Botón `Saltar intro`.
- La intro se reproduce una sola vez por sesión usando `sessionStorage`.
- `prefers-reduced-motion` evita la cinemática automáticamente.
- El modo exploración queda bloqueado mientras corre la intro y se habilita al finalizar.

## Archivos principales

- `src/components/galaxy/GalaxyBackground.tsx`
- `src/components/galaxy/GalaxyCinematicOverlay.tsx`
- `src/components/galaxy/GalaxyBackground.module.css`

## Ejecutar

```bash
npm install
npm run dev
```

## Validar producción

```bash
npm run build
```


## V2.4.2 - Cinemática fluida
- Duración reducida a 5 s.
- Trayectoria Catmull-Rom continua para posición y objetivo de cámara.
- Se elimina el lag acumulado de `camera.position.lerp` durante la intro.
- Fases más cortas y usadas solo como información visual.
- Overlay y barra de progreso con transiciones más rápidas.


## V2.4.2 - Transición al núcleo sin salto

- Trayectoria de cámara cambiada a una única `THREE.CubicBezierCurve3`.
- Se elimina el nudo interno que podía percibirse como tirón al pasar de Aproximación a Núcleo galáctico.
- La inversión de profundidad alrededor del núcleo ahora es gradual.
- `PerformanceMonitor` no cambia la densidad/quality durante la cinemática para evitar regeneraciones visibles de partículas.
- Duración ajustada a 4.85 s.
- Clave de sesión: `galaxy-cinematic-v2.4.2-seen`.
