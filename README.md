# Galaxia Responsive V3.1.6 — Extended Deep Zoom + Compact Mobile Labels

V3.1.6 amplía el zoom táctil móvil hasta un radio de cámara 3.8 y compacta las etiquetas de hotspots durante la exploración.

## Cambios principales

- Pinch-to-zoom móvil hasta `5.5` unidades de cámara.
- Vista general móvil permanece en `21.5`.
- Alejamiento máximo móvil permanece en `27`.
- DPR adaptativo en close-up, con límite según calidad/hardware.
- Halos estelares más contenidos al acercarse.
- Núcleos estelares más definidos y brillantes en close-up.
- Tamaño aparente de partículas compensado para evitar estrellas gigantes y borrosas.
- Cúmulos estelares usan el mismo ajuste de detalle.
- La distribución histórica `freeAngle = random() * Math.PI * 2.3` permanece intacta.

## Se mantiene de V3.1.4

- Un dedo: orbitar.
- Dos dedos: pinch-to-zoom.
- Panel móvil compacto.
- Contenido principal oculto durante modo exploración.
- Audio ambiental y pausa al cambiar de pestaña.
- Cinemática.
- Hotspots premium.
- Presentación automática.
- Sección profesional/contacto.
- `/webgpu-lab` con WebGPU + TSL.

## Rangos de detalle

- `zoom > 12`: vista general, detalle estándar.
- `zoom 12 → 8`: detalle progresivo.
- `zoom < 8`: close-up, halo reducido y núcleo más definido.

## Audio

Conservar manualmente:

```text
public/audio/galaxy-ambient.mp3
```

## Diagnóstico WebGPU

Crear `.env.local` si se desea:

```env
NEXT_PUBLIC_GALAXY_RENDERER_DEBUG=1
```

## Pruebas

```bash
npm install
npm run build
npm run dev
```

Validar especialmente en móvil:

1. Entrar a modo exploración.
2. Hacer pinch con dos dedos hasta acercamiento máximo.
3. Confirmar que las estrellas ganan definición y el halo disminuye.
4. Volver a vista general con `General` o `Restablecer`.
5. Confirmar que el DPR vuelve a su nivel normal.
6. Verificar que audio, hotspots y presentación siguen funcionando.
7. Probar `/webgpu-lab` por separado.


## Cambios V3.1.6

- Zoom móvil mínimo: `3.8` (antes `5.5`).
- Desktop mantiene el límite anterior `5.5`.
- Etiquetas Núcleo / Corriente / Cuna estelar reducidas en móvil.
- `Html distanceFactor` móvil reducido de `11` a `6.4` para evitar labels gigantes en close-up.
- La nitidez adaptativa y DPR dinámico de V3.1.5 permanecen activos.
