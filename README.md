# Galaxia Responsive v3.6.0

Cambios principales:
- Motor de perfiles adaptativos (Adaptive LOD) para variar densidad de estrellas según viewport, calidad y nivel de zoom.
- Nuevas capas verticales de estrellas de fondo para dar más profundidad en desktop y móvil.
- Ajuste automático del perfil de escena en modo exploración, close-up y macro.
- Base preparada para futuras mejoras de nitidez dinámica, bloom selectivo y calidad adaptativa por FPS.
- Se mantiene la experiencia estabilizada de la v3.5.13 como punto de partida visual.

Puntos técnicos:
- Nuevo helper: `src/components/galaxy/rendering/adaptiveSceneProfile.ts`.
- `GalaxyBackground.tsx` ahora calcula un `zoomBand` y lo usa para construir el perfil de render.
- `DepthStarLayers.tsx` ahora acepta múltiples capas configurables en lugar de solo dos planos fijos.
