# Galaxia Responsive V3.1.4 — GPU Particle Engine / Mobile Explorer Fix

V3.1 mantiene la experiencia principal sobre WebGL2 para no romper las capas GLSL todavía activas, pero incorpora un laboratorio WebGPU + TSL real y ejecutable.

## V3.1.4 · Ajuste móvil

El panel de exploración se compactó en pantallas de hasta 720px:

- altura máxima reducida,
- descripción limitada a dos líneas,
- regiones en carrusel horizontal,
- controles de teclado ocultos en móvil,
- audio compacto,
- ajuste adicional para pantallas de hasta 430px.

La experiencia desktop y el laboratorio WebGPU no cambian.

## Producción

La ruta `/` conserva:

- galaxia V2.6.2/V3.0 estable,
- cinemática,
- audio ambiental,
- exploración y hotspots,
- presentación automática,
- panel profesional y contacto,
- calidad adaptativa y pausa por visibilidad.

## WebGPU Particle Lab

Abrir:

```text
/webgpu-lab
```

El laboratorio usa:

- `WebGPURenderer`,
- `SpriteNodeMaterial`,
- TSL (`three/tsl`),
- atributos instanciados para posición, color, escala y fase,
- rotación y twinkle calculados en GPU,
- perfiles adaptativos de 18k / 42k / 72k partículas.

WebGPU no admite puntos grandes como los `gl_PointSize` tradicionales. Por ello el laboratorio usa sprites/instancing, que es el camino compatible con WebGPU para partículas estelares de tamaño visible.

## Diagnóstico

Crear `.env.local`:

```env
NEXT_PUBLIC_GALAXY_RENDERER_DEBUG=1
```

Reiniciar `npm run dev`. El panel de diagnóstico mostrará disponibilidad WebGPU/WebGL2 y un enlace al laboratorio.

## Importante

La escena principal aún no cambia a WebGPURenderer porque `GalaxyDisc`, `NebulaShader`, `GalacticCore`, `GalaxyHotspots`, `StarClusters` y `ShootingStars` todavía contienen `ShaderMaterial` GLSL.

V3.2 migrará esas capas a TSL. Solo después será seguro activar WebGPURenderer como backend principal.

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

Luego comprobar:

1. `/` funciona igual que V3.0.
2. `/webgpu-lab` abre en Chrome/Edge con WebGPU disponible.
3. El contador muestra el perfil de partículas seleccionado.
4. El movimiento del mouse produce parallax suave.
5. Cambiar de pestaña pausa el render del laboratorio.
6. Volver a `/` mantiene audio, cinemática y exploración.


## V3.1.4 · Mobile Full Galaxy View

- FOV móvil ampliado a 56°.
- Zoom general móvil aumentado a 22.5.
- Escala de la galaxia adaptativa: 0.30 en móviles pequeños y 0.33 hasta 639 px.
- El disco completo entra mejor en formato vertical sin afectar desktop/tablet.
- Reset, fin de cinemática y vista general usan el zoom responsive correcto.


## V3.1.4 · Mobile framing refinement

- Mobile general camera: zoom 21.5, FOV 54.
- Main galaxy scale: 0.36 below 430px and 0.40 from 430px to 639px.
- Keeps the full disk visible while using more of the portrait viewport.
- When exploration mode is active, the regular page content is fully hidden instead of remaining translucent.
- Exploration overlay, audio controls and galaxy remain visible.


## V3.1.4 - Mobile Pinch Zoom

- Zoom táctil con gesto de pellizco usando dos dedos en modo exploración.
- Un dedo conserva la órbita/drag existente.
- Zoom móvil continuo entre 8.2 y 27 unidades de cámara.
- La rueda de mouse y controles de teclado permanecen disponibles en escritorio.
- General y Restablecer continúan devolviendo el encuadre móvil base.
