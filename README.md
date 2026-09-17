# Galaxia Responsive V3.1.1 — GPU Particle Engine / Mobile Explorer Fix

V3.1 mantiene la experiencia principal sobre WebGL2 para no romper las capas GLSL todavía activas, pero incorpora un laboratorio WebGPU + TSL real y ejecutable.

## V3.1.1 · Ajuste móvil

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
