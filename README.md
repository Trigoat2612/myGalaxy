# Galaxia Responsive v3.7.1

Evolución: **Living Stellar Stream**.

Base utilizada: **v3.7.0.1 Differential Motion Safe**, versión estabilizada por el usuario.

## Qué cambia
- La **Corriente estelar** se separó del bloque estático de Cuna/otros cúmulos y ahora vive en un grupo local propio.
- El grupo de Corriente se posiciona usando exactamente `GALAXY_HOTSPOTS['inner-arm']`, por lo que su centro, etiqueta y objetivo de cámara comparten la misma referencia.
- Las partículas de la Corriente tienen ahora:
  - desplazamiento longitudinal sutil;
  - oscilación lateral pequeña;
  - variación vertical mínima;
  - pulso luminoso viajero;
  - fases correlacionadas con la posición a lo largo de la Corriente.
- La forma visual sigue siendo la misma base curvada ya aprobada; el movimiento se mantiene deliberadamente contenido para que no se desarme.
- La **Cuna estelar** permanece estática respecto a su centro. No se modifica todavía su respiración dinámica, reservada para v3.7.2.
- Se conserva el movimiento diferencial seguro de v3.7.0.1.
- Se conservan sin cambios la exploración 360°, Modo Foto, audio, hotspots, controles compactos y Adaptive Performance.

## Decisión técnica importante
Esta versión **no añade un nuevo atributo instanciado TSL**. La primera v3.7.0 demostró, con la sutileza de un meteorito, que esa ruta podía romper el render completo. La Corriente reutiliza los atributos ya estabilizados (`position`, `color`, `size`, `phase`) y solo aplica movimiento local en un material separado.

## Archivo principal modificado
- `src/components/galaxy/rendering/WebGPUInteractiveGalaxy.tsx`

## Resultado esperado
Al observar o acercarse a **Corriente**, las estrellas deben dar sensación de flujo interno continuo sin que la figura se separe de su hotspot ni cambie de posición respecto al centro seleccionado.
