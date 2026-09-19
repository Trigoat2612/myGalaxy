# Galaxia Responsive v3.7.4.15.2

Corrección de compilación sobre la v3.7.4.15.1 estable.

## Error corregido
Next/TypeScript reportaba `TS2503: Cannot find namespace THREE` en las aserciones de tipo `THREE.BufferAttribute`.

La causa era que `THREE` se carga dentro del renderer como valor mediante `await import('three/webgpu')`; ese identificador local no puede utilizarse como namespace TypeScript para anotaciones de tipo.

## Corrección
- se añadió `import type { BufferAttribute } from 'three';`
- las 8 aserciones `as THREE.BufferAttribute` fueron reemplazadas por `as BufferAttribute`
- no se modificó la lógica visual de la v3.7.4.15.1
- se eliminó `tsconfig.tsbuildinfo` del paquete para evitar reutilizar caché incremental anterior
