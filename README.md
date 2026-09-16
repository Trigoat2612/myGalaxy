# Galaxia Responsive V2.2 — Galaxia Viva

Evolución de la V2.1.7 Premium enfocada en **realismo, profundidad y vida visual**, sin cambiar la geometría que ya quedó estable.

## Se conserva

- Ajuste `freeAngle = random() * Math.PI * 2.3`.
- Estrellas fugaces Premium: cabeza con `ShaderMaterial` + cola texturizada.
- Galaxia inclinada tipo Andrómeda.
- Calidad adaptativa con `PerformanceMonitor`.
- `prefers-reduced-motion`.
- Next.js 15.5.25 + React 19.2.8 + R3F 9.7.0.

## V2.2 — Cambios principales

### Núcleo galáctico orgánico

Nuevo `GalacticCore.tsx` con shader procedural independiente. Añade un bulbo cálido irregular sin sobreexponer el centro.

### Cúmulos estelares

Nuevo `StarClusters.tsx`. Los cúmulos usan el mismo shader de las estrellas principales para conservar coherencia visual y se distribuyen dentro del disco.

### Temperaturas de estrellas

La población principal mezcla de forma sutil estrellas:

- azules calientes,
- blancas/neutras,
- amarillas cálidas,
- gigantes rojizas poco frecuentes.

El gradiente radial de la galaxia sigue siendo la base, así que el resultado no se convierte en confeti espacial, un riesgo que la humanidad ya ha explorado suficientemente.

### Rotación diferencial GPU

El `galaxyVertexShader` ahora hace que el núcleo rote ligeramente más rápido y el disco exterior más lento, calculado totalmente en GPU.

### Polvo con mayor profundidad

La capa de polvo tiene mayor dispersión vertical y menor dependencia de los brazos, dando sensación de volumen sin crear nuevas zonas angulares vacías.

### Parallax multicapa

Nuevo `DepthStarLayers.tsx`:

- campo lejano con movimiento mínimo,
- campo cercano con desplazamiento mayor,
- ambos reaccionan de forma independiente al puntero.

Esto añade profundidad sin mover miles de estrellas desde JavaScript.

## Estructura relevante

```text
src/components/galaxy/
├── DepthStarLayers.tsx
├── GalacticCore.tsx
├── StarClusters.tsx
├── GalaxyBackground.tsx
├── GalaxyDisc.tsx
├── GalaxyShader.tsx
├── NebulaShader.tsx
├── ShootingStars.tsx
├── StarField.tsx
└── shaders.ts
```

## Ejecutar

```bash
npm install
npm run dev
```

Abrir `http://localhost:3000`.

## Build

```bash
npm run build
```

## Stack

- Next.js 15.5.25
- React 19.2.8
- React Three Fiber 9.7.0
- Drei 10.7.8
- Three.js 0.180.0
- TypeScript 5.9.2
- GLSL shaders
