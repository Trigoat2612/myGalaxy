'use client';

import { useCallback, useEffect, useState } from 'react';

import GalaxyBackground from '../GalaxyBackground';
import WebGPUInteractiveGalaxy from './WebGPUInteractiveGalaxy';
import { detectGalaxyRendererCapabilities } from './rendererCapabilities';

type ProductionBackend = 'detecting' | 'webgpu' | 'webgl2';

const WEBGPU_FAILURE_SESSION_KEY = 'galaxy-webgpu-v3.6.0-fallback';
const SHOW_DIAGNOSTICS = process.env.NEXT_PUBLIC_GALAXY_RENDERER_DEBUG === '1';

export default function ProductionGalaxyBackground() {
  const [backend, setBackend] = useState<ProductionBackend>('detecting');
  const [fallbackReason, setFallbackReason] = useState<'unsupported' | 'error' | 'session' | null>(null);

  useEffect(() => {
    const capabilities = detectGalaxyRendererCapabilities();
    const previousFailure = sessionStorage.getItem(WEBGPU_FAILURE_SESSION_KEY) === '1';

    if (previousFailure) {
      setFallbackReason('session');
      setBackend('webgl2');
      return;
    }

    if (capabilities.webgpuAvailable) {
      setBackend('webgpu');
      return;
    }

    setFallbackReason('unsupported');
    setBackend('webgl2');
  }, []);

  const activateFallback = useCallback((reason: 'unsupported' | 'error') => {
    sessionStorage.setItem(WEBGPU_FAILURE_SESSION_KEY, '1');
    setFallbackReason(reason);
    setBackend('webgl2');
  }, []);

  if (backend === 'detecting') {
    return <div className="galaxyProductionBoot" aria-hidden="true" />;
  }

  return (
    <>
      {backend === 'webgpu' ? (
        <WebGPUInteractiveGalaxy mode="production" onFallback={activateFallback} />
      ) : (
        <GalaxyBackground />
      )}

      {SHOW_DIAGNOSTICS && backend === 'webgpu' && (
        <aside className="rendererProductionDebug" aria-live="polite">
          <strong>Renderer · V3.6.0</strong>
          <span>Active: {backend === 'webgpu' ? 'WebGPU + TSL' : 'WebGL2 fallback'}</span>
          {fallbackReason && <span>Fallback: {fallbackReason}</span>}
          <div>
            <a href="/webgpu-galaxy">WebGPU direct</a>
            <a href="/webgl-galaxy">WebGL2 direct</a>
          </div>
        </aside>
      )}
    </>
  );
}
