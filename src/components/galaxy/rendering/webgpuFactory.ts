/**
 * Lazy WebGPU renderer factory used by the production TSL path and labs.
 * Keeping the import lazy avoids loading the WebGPU renderer on WebGL2 fallback
 * sessions that do not need it.
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
