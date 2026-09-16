# Galaxia Responsive V1.1

Evolución de la V1 construida con Next.js, TypeScript, React Three Fiber y Three.js.

## Novedades V1.1

- Parallax suave con mouse y touch usando eventos globales pasivos.
- Tres tamaños de estrella sin crear miles de componentes React.
- Estrellas fugaces con cola aditiva generada en GPU.
- Densidad de partículas responsive.
- Calidad y DPR adaptativos mediante `PerformanceMonitor`.
- Respeto a `prefers-reduced-motion`.
- Versiones de React fijadas para evitar el conflicto con React 19.3 y R3F 9.7.0.

## Requisitos

- Node.js 20.9+ recomendado.
- npm 10+.

## Instalación limpia

En Windows CMD:

```cmd
rmdir /s /q node_modules 2>nul
del package-lock.json 2>nul
npm install
npm run dev
```

En PowerShell:

```powershell
Remove-Item node_modules -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item package-lock.json -Force -ErrorAction SilentlyContinue
npm install
npm run dev
```

Abrir: http://localhost:3000

## Build de producción

```bash
npm run build
npm start
```

## Dependencias principales fijadas

- React 19.2.8
- React DOM 19.2.8
- @react-three/fiber 9.7.0
- @react-three/drei 10.7.8
- Three.js 0.180.0
- Next.js 15.5.3

## Arquitectura visual

La galaxia usa `BufferGeometry + Points`. Las estrellas se agrupan en tres capas por tamaño, por lo que miles de estrellas siguen representándose con pocos draw calls. Las estrellas fugaces son un conjunto pequeño de meshes reutilizados y animados mediante `useFrame`.
