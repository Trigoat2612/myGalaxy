# Galaxia Responsive v3.6.4

Evolución aplicada: **Color grading galáctico + perfiles visuales**

## Qué cambia
- Se agregan tres perfiles visuales persistentes: **Cinemático**, **Realista** y **Vibrante**.
- Cada perfil ajusta brillo, saturación, calidez, bloom y lectura del núcleo.
- El disco galáctico, el núcleo, la nebulosa y las estrellas reaccionan al perfil elegido.
- El selector se guarda en `localStorage`, así que conserva la preferencia del usuario.

## Archivos tocados
- `src/components/galaxy/GalaxyBackground.tsx`
- `src/components/galaxy/GalaxyBackground.module.css`
- `src/components/galaxy/GalaxyVisualProfileOverlay.tsx`
- `src/components/galaxy/visualProfiles.ts`
- `src/components/galaxy/GalaxyShader.tsx`
- `src/components/galaxy/GalaxyDisc.tsx`
- `src/components/galaxy/GalacticCore.tsx`
- `src/components/galaxy/NebulaShader.tsx`
- `src/components/galaxy/StarClusters.tsx`
- `src/components/galaxy/shaders.ts`


## Corrección v3.6.4.1

- Se unificó el anclaje visual de **Cuna estelar** y **Corriente** para que sus formas acompañen a sus centros como una sola unidad.
- Se eliminó la rotación independiente que provocaba deriva visual en los hotspots.
- Se incrementó el brillo y la presencia de la galaxia en móvil.
- Se aumentó la densidad y legibilidad de las capas de estrellas de fondo en móvil.


## Corrección v3.6.4.2 · Hotspot Lock + 360° Orbit

- **Cuna estelar** y **Corriente** ahora toman su centro directamente desde `GALAXY_HOTSPOTS`, eliminando coordenadas duplicadas.
- La capa que contiene sus formas ya **no rota de forma independiente** alrededor del núcleo. Se mueve únicamente junto con la galaxia, por lo que forma, centro y etiqueta permanecen unidos.
- Se conserva una animación interna leve (twinkle/movimiento vertical), sin alterar la posición conceptual del hotspot.
- El giro horizontal del modo exploración deja de estar limitado a `[-0.9, 0.9]` radianes.
- Mouse, touch y teclas izquierda/derecha permiten ahora **órbita horizontal continua de 360°** en ambos sentidos.
- El fallback WebGL/R3F usa el mismo comportamiento de órbita completa.
