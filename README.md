# Galaxia Responsive v3.6.5

Evolución aplicada: **Photo Mode + Premium Capture**.

## Qué cambia

- Se conserva intacta la base estable v3.6.4.2: hotspots anclados y giro horizontal 360°.
- Nuevo **Modo foto** disponible desde la interfaz principal.
- El modo foto oculta la interfaz secundaria y deja la galaxia limpia para composición.
- Presets rápidos de encuadre:
  - General
  - Núcleo
  - Corriente
  - Cuna estelar
- Cuadrícula opcional de tercios para composición visual.
- Exportación directa a **PNG de alta resolución** usando un DPR temporal de captura.
- Durante la captura se ocultan los hotspots para producir una imagen limpia.
- `Esc` sale del modo foto y restaura el estado de exploración previo.

## Archivos principales añadidos

- `src/components/galaxy/GalaxyPhotoModeOverlay.tsx`
- `src/components/galaxy/PhotoCaptureController.tsx`

## Archivos principales modificados

- `src/components/galaxy/GalaxyBackground.tsx`
- `src/components/galaxy/GalaxyBackground.module.css`
- `src/app/globals.css`

## Nota técnica

La captura incrementa temporalmente el pixel ratio del renderer y restaura el estado original inmediatamente después de guardar la imagen. No modifica la calidad normal de ejecución de la escena.


## Corrección v3.6.5.1
- El botón **Modo foto** ahora también se renderiza en el backend WebGPU de producción, que era la causa de que no apareciera.
- Photo Mode funciona tanto en WebGPU como en el fallback WebGL2.
- Se agregó **Volver al inicio** debajo de la sección profesional.
- El botón `Conoce al desarrollador` sigue desplazando a `#contacto` y el nuevo botón retorna suavemente a `#inicio`.
