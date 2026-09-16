# Galaxia Responsive V2.1.6

Corrección visual de la V2.1 orientada a una galaxia tipo Andrómeda.

## Correcciones principales

- Recupera la presencia visual de la galaxia sin volver a la sobreexposición de V2.
- Elimina la máscara oscura del hero que ocultaba el núcleo.
- Disco más elíptico e inclinado.
- Núcleo cálido controlado.
- Capa procedural continua para que la forma no dependa solo de puntos.
- Brazos más difusos y bandas de polvo más visibles.
- Estrellas individuales GLSL con brillo moderado.
- Nebulosa y fondo conservan profundidad sin competir con la galaxia.
- Parallax y calidad adaptativa continúan activos.

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
