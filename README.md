# Galaxia Responsive V2.6.2

Revisión de estabilidad de audio sobre V2.6.

## Correcciones

- La precarga ya no interpreta automáticamente cualquier rechazo de `audio.play()` como archivo inexistente.
- El estado `Audio no encontrado` solo aparece cuando una verificación HTTP de `/audio/galaxy-ambient.mp3` confirma `404` o `410`.
- Los errores transitorios de `HTMLAudioElement`, abortos de carga y bloqueos de autoplay ya no se clasifican como archivo faltante.
- Se espera `loadeddata` / `canplay` antes de la reproducción cuando es necesario.
- Al ocultar la pestaña, el audio se pausa conservando `currentTime`.
- Al volver a la pestaña, el audio retoma desde la misma posición si estaba activo.
- Si estaba únicamente precargado/muted, vuelve al estado primed.
- Si el usuario apagó el audio manualmente, cambiar de pestaña no lo reactiva.

## Archivo de audio

Este paquete NO incluye la canción del usuario. Debes conservar/copiar:

```text
public/audio/galaxy-ambient.mp3
```

Después del despliegue prueba directamente:

```text
https://TU-DOMINIO/audio/galaxy-ambient.mp3
```

Si el navegador muestra/reproduce el MP3, Vercel publicó correctamente el archivo.
Si devuelve 404, el problema es de archivo/ruta y no del controlador React.

## Repetir cinemática

```js
sessionStorage.removeItem('galaxy-cinematic-v2.6.2-seen');
location.reload();
```

## Build

```bash
npm install
npm run build
npm run dev
```
