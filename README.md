# Galaxia Responsive V2.5 · Ambientación + UX Premium

Evolución de V2.4.2.

## Audio

Coloca tu pista en:

```text
public/audio/galaxy-ambient.mp3
```

La reproducción no comienza automáticamente al cargar. El usuario la activa mediante el control de sonido.

- Loop continuo
- Fade-in de 1.8 s
- Fade-out de 0.52 s
- Volumen inicial: 0.14
- Volumen máximo desde UI: 0.35
- Preferencias guardadas en `localStorage`

## UX V2.5

- Control de ambientación
- Volumen ajustable
- Feedback visual de enfoque
- Microanimaciones de paneles y botones
- Presentación automática entre hotspots
- Controles responsive
- `prefers-reduced-motion` respetado

## Cinemática

Se conserva la trayectoria fluida corregida de V2.4.2. La clave de sesión ahora es:

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
