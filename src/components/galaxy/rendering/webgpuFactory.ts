/**
 * WebGPU renderer factory for the TSL migration path.
 *
 * This module is intentionally lazy-loaded. V3.0 keeps the live galaxy on the
 * stable WebGL2 renderer because several visual layers still use ShaderMaterial.
 * V3.1 can start consuming this factory as those layers are ported to TSL.
 */
export async function createGalaxyWebGPURenderer(canvas?: HTMLCanvasElement) {
  const { WebGPURenderer } = await import('three/webgpu');

  const renderer = new WebGPURenderer({
    ...(canvas ? { canvas } : {}),
    antialias: false,
    alpha: true,
  });

  await renderer.init();
  return renderer;
}

export async function loadGalaxyTSL() {
  return import('three/tsl');
}
