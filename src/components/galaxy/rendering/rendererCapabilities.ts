'use client';

export type GalaxyRendererBackend = 'webgpu' | 'webgl2' | 'none';

export type GalaxyRendererCapabilities = {
  preferredBackend: GalaxyRendererBackend;
  webgpuAvailable: boolean;
  webgl2Available: boolean;
  legacyShaderCompatible: boolean;
};

function hasWebGL2() {
  if (typeof document === 'undefined') return true;

  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2'));
  } catch {
    return false;
  }
}

function hasWebGPU() {
  if (typeof navigator === 'undefined') return false;
  return 'gpu' in navigator && Boolean((navigator as Navigator & { gpu?: unknown }).gpu);
}

/**
 * V3.6 keeps WebGPU to the preferred production backend. WebGL2 remains
 * available as an automatic and explicitly addressable fallback.
 */
export function detectGalaxyRendererCapabilities(): GalaxyRendererCapabilities {
  const webgpuAvailable = hasWebGPU();
  const webgl2Available = hasWebGL2();

  return {
    preferredBackend: webgpuAvailable ? 'webgpu' : webgl2Available ? 'webgl2' : 'none',
    webgpuAvailable,
    webgl2Available,
    legacyShaderCompatible: webgl2Available,
  };
}
