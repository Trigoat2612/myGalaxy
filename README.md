# Galaxia Responsive V2.5.2 · Auto Audio Sync

Evolución de la V2.5.1 centrada en acercar al máximo el comportamiento del audio a una activación automática respetando las políticas reales de los navegadores.

## Audio

Coloca tu archivo aquí:

```text
public/audio/galaxy-ambient.mp3
```

### Flujo

1. Al cargar, la pista intenta comenzar **muted** y con volumen 0.
2. Si el navegador permite autoplay muted, la canción empieza a avanzar sincronizada con la cinemática.
3. En el primer `pointerdown`, `touchstart` o `keydown`, se desactiva `muted` y entra el audio con fade-in.
4. Si el navegador bloquea incluso el primer intento muted, el primer gesto intenta `play()` directamente.
5. El usuario conserva control de mute y volumen.

No existe una forma web fiable de forzar audio audible en la primera carga sin una interacción del usuario cuando el navegador lo bloquea por política.

## Cambios adicionales

- Preferencias V2.5.2 con migración desde V2.5.1/V2.5.
- Corrección integrada de `selected={selected}` en `GalaxyHotspots.tsx`.
- `Next.js 16.3.5` para alinearse con el despliegue actual en Vercel.
- Nueva clave de cinemática: `galaxy-cinematic-v2.5.2-seen`.

## Probar

```bash
npm install
npm run build
npm run dev
```
