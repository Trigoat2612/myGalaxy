# Galaxia Responsive V2.5.1 · Auto Audio Unlock

Evolución de V2.5.

## Audio automático con fallback

Coloca tu pista en:

```text
public/audio/galaxy-ambient.mp3
```

La V2.5.1 intenta iniciar la ambientación automáticamente al cargar la página.

- Si el navegador permite autoplay con sonido, comienza de inmediato con fade-in.
- Si el navegador lo bloquea, queda preparada y se desbloquea con el primer clic, toque o pulsación de tecla.
- Si el usuario desactiva el sonido, esa preferencia se guarda y no vuelve a iniciarse automáticamente.
- Se conserva la preferencia de volumen.
- Se migra la preferencia previa de V2.5 si existe.

### Comportamiento

```text
Carga
  ↓
Intento autoplay
  ↓
Permitido ─────→ fade-in 2.4 s
  ↓ bloqueado
Esperar primer gesto
  ↓
play() + fade-in 1.4 s
```

### Parámetros

- Loop continuo
- Volumen inicial: 0.14
- Volumen máximo desde UI: 0.35
- Fade-in autoplay: 2.4 s
- Fade-in tras gesto: 1.4 s
- Fade-out: 0.52 s
- Preferencias guardadas en `localStorage`

## UX heredada de V2.5

- Control de ambientación
- Volumen ajustable
- Feedback visual de enfoque
- Microanimaciones de paneles y botones
- Presentación automática entre hotspots
- Controles responsive
- `prefers-reduced-motion` respetado

## Cinemática

Se conserva la trayectoria fluida corregida de V2.4.2 y la experiencia V2.5.

La clave de sesión continúa siendo:

```text
galaxy-cinematic-v2.5-seen
```

Para repetirla:

```js
sessionStorage.removeItem('galaxy-cinematic-v2.5-seen');
location.reload();
```

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
```
