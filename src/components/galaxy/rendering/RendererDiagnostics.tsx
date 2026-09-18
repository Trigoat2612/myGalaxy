'use client';

import { useEffect, useState } from 'react';
import { detectGalaxyRendererCapabilities, type GalaxyRendererCapabilities } from './rendererCapabilities';

const SHOW_DIAGNOSTICS = process.env.NEXT_PUBLIC_GALAXY_RENDERER_DEBUG === '1';

export default function RendererDiagnostics() {
  const [capabilities, setCapabilities] = useState<GalaxyRendererCapabilities | null>(null);

  useEffect(() => {
    if (!SHOW_DIAGNOSTICS) return;
    setCapabilities(detectGalaxyRendererCapabilities());
  }, []);

  if (!SHOW_DIAGNOSTICS || !capabilities) return null;

  return (
    <aside
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 30,
        padding: '9px 10px',
        border: '1px solid rgba(190, 210, 255, 0.18)',
        borderRadius: 10,
        background: 'rgba(3, 7, 18, 0.82)',
        color: 'rgba(225, 235, 255, 0.82)',
        font: '11px/1.45 Arial, sans-serif',
        backdropFilter: 'blur(10px)',
      }}
      aria-live="polite"
    >
      <strong style={{ display: 'block', color: '#fff' }}>Renderer · V3.6</strong>
      <span>WebGPU: {capabilities.webgpuAvailable ? 'available' : 'unavailable'}</span>
      <br />
      <span>WebGL2: {capabilities.webgl2Available ? 'available' : 'unavailable'}</span>
      <br />
      <span>Active: WebGL2 · fallback/direct</span>
      <br />
      <a
        href="/webgpu-galaxy"
        style={{
          display: 'inline-block',
          marginTop: 5,
          marginRight: 8,
          color: '#dce8ff',
          pointerEvents: 'auto',
        }}
      >
        Open WebGPU Direct
      </a>
      <a
        href="/webgpu-lab"
        style={{
          display: 'inline-block',
          marginTop: 5,
          color: '#b9caef',
          pointerEvents: 'auto',
        }}
      >
        Particle Lab
      </a>
    </aside>
  );
}
