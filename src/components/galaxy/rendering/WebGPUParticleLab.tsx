'use client';

import { useEffect, useRef, useState } from 'react';

import {
  GPU_PARTICLE_PROFILES,
  detectGPUParticleQuality,
  type GPUParticleQuality,
} from './particleEngineConfig';

type LabState = 'initializing' | 'running' | 'unsupported' | 'error';

type LabStats = {
  backend: string;
  quality: GPUParticleQuality;
  particles: number;
};

function createRandom(seed = 92837) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function WebGPUParticleLab() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<LabState>('initializing');
  const [stats, setStats] = useState<LabStats | null>(null);
  const [message, setMessage] = useState('Inicializando WebGPU + TSL…');

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function start() {
      const host = mountRef.current;
      if (!host) return;

      if (!('gpu' in navigator)) {
        setState('unsupported');
        setMessage('WebGPU no está disponible en este navegador. La galaxia principal sigue usando WebGL2.');
        return;
      }

      try {
        const THREE = await import('three/webgpu');
        const TSL = await import('three/tsl');

        if (disposed) return;

        const quality = detectGPUParticleQuality();
        const profile = GPU_PARTICLE_PROFILES[quality];

        const renderer = new THREE.WebGPURenderer({
          antialias: false,
          alpha: true,
          powerPreference: 'high-performance',
        });

        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioMax));
        renderer.setSize(host.clientWidth, host.clientHeight);
        renderer.setAnimationLoop(null);
        await renderer.init();

        if (disposed) {
          renderer.dispose();
          return;
        }

        host.replaceChildren(renderer.domElement);

        const scene = new THREE.Scene();
        scene.background = new THREE.Color('#010208');

        const camera = new THREE.PerspectiveCamera(
          52,
          Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
          0.1,
          120,
        );
        camera.position.set(0, 0.4, 16);

        const random = createRandom(31051989 + profile.count);
        const positions = new Float32Array(profile.count * 3);
        const colors = new Float32Array(profile.count * 3);
        const sizes = new Float32Array(profile.count);
        const phases = new Float32Array(profile.count);

        const cold = new THREE.Color('#8eaeff');
        const white = new THREE.Color('#edf3ff');
        const warm = new THREE.Color('#ffe0af');
        const current = new THREE.Color();

        for (let i = 0; i < profile.count; i++) {
          const i3 = i * 3;
          const theta = random() * Math.PI * 2;
          const cosPhi = random() * 2 - 1;
          const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
          const radius = profile.radiusMin + Math.pow(random(), 0.72) * (profile.radiusMax - profile.radiusMin);

          positions[i3] = radius * sinPhi * Math.cos(theta);
          positions[i3 + 1] = radius * cosPhi * 0.52;
          positions[i3 + 2] = radius * sinPhi * Math.sin(theta);

          const temperature = random();
          if (temperature < 0.18) current.copy(cold);
          else if (temperature < 0.82) current.copy(white);
          else current.copy(warm);

          current.offsetHSL((random() - 0.5) * 0.012, 0, (random() - 0.5) * 0.08);
          colors[i3] = current.r;
          colors[i3 + 1] = current.g;
          colors[i3 + 2] = current.b;

          sizes[i] = random() > 0.992 ? 0.11 + random() * 0.09 : 0.025 + Math.pow(random(), 2.3) * 0.055;
          phases[i] = random() * Math.PI * 2;
        }

        const positionAttribute = new THREE.InstancedBufferAttribute(positions, 3);
        const colorAttribute = new THREE.InstancedBufferAttribute(colors, 3);
        const sizeAttribute = new THREE.InstancedBufferAttribute(sizes, 1);
        const phaseAttribute = new THREE.InstancedBufferAttribute(phases, 1);

        const instancePosition = TSL.instancedBufferAttribute(positionAttribute);
        const instanceColor = TSL.instancedBufferAttribute(colorAttribute);
        const instanceSize = TSL.instancedBufferAttribute(sizeAttribute);
        const instancePhase = TSL.instancedBufferAttribute(phaseAttribute);

        const material = new THREE.SpriteNodeMaterial();
        material.transparent = true;
        material.depthWrite = false;
        material.blending = THREE.AdditiveBlending;

        material.positionNode = TSL.Fn(() => {
          const angle = TSL.time.mul(0.018).add(instancePhase.mul(0.018));
          const c = TSL.cos(angle);
          const s = TSL.sin(angle);
          const x = instancePosition.x.mul(c).sub(instancePosition.z.mul(s));
          const z = instancePosition.x.mul(s).add(instancePosition.z.mul(c));
          const vertical = TSL.sin(TSL.time.mul(0.18).add(instancePhase)).mul(0.012);
          return TSL.vec3(x, instancePosition.y.add(vertical), z);
        })();

        material.scaleNode = TSL.vec2(
          instanceSize.mul(
            TSL.sin(TSL.time.mul(0.65).add(instancePhase)).mul(0.12).add(1.0),
          ),
        );

        material.colorNode = TSL.Fn(() => {
          const twinkle = TSL.sin(TSL.time.mul(0.7).add(instancePhase)).mul(0.08).add(0.92);
          return instanceColor.mul(twinkle);
        })();

        material.opacityNode = TSL.Fn(() => {
          const centered = TSL.uv().sub(TSL.vec2(0.5));
          const circle = TSL.step(centered.length(), 0.5);
          const core = TSL.smoothstep(0.5, 0.05, centered.length());
          const twinkle = TSL.sin(TSL.time.mul(0.62).add(instancePhase)).mul(0.12).add(0.88);
          return circle.mul(core.mul(0.68).add(0.22)).mul(twinkle);
        })();

        const geometry = new THREE.PlaneGeometry(1, 1);
        const particles = new THREE.InstancedMesh(geometry, material, profile.count);
        particles.frustumCulled = false;
        scene.add(particles);

        let pointerX = 0;
        let pointerY = 0;
        let targetX = 0;
        let targetY = 0;
        let running = true;

        const onPointerMove = (event: PointerEvent) => {
          targetX = (event.clientX / window.innerWidth) * 2 - 1;
          targetY = -((event.clientY / window.innerHeight) * 2 - 1);
        };

        const resize = () => {
          if (!host.clientWidth || !host.clientHeight) return;
          camera.aspect = host.clientWidth / host.clientHeight;
          camera.updateProjectionMatrix();
          renderer.setSize(host.clientWidth, host.clientHeight);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioMax));
        };

        const onVisibility = () => {
          running = document.visibilityState !== 'hidden';
        };

        const clock = new THREE.Clock();

        renderer.setAnimationLoop(() => {
          if (!running) return;

          const delta = Math.min(clock.getDelta(), 0.05);
          const easing = 1 - Math.exp(-delta * 2.2);
          pointerX += (targetX - pointerX) * easing;
          pointerY += (targetY - pointerY) * easing;

          camera.position.x += (pointerX * 0.55 - camera.position.x) * easing * 0.35;
          camera.position.y += (0.4 + pointerY * 0.32 - camera.position.y) * easing * 0.35;
          camera.lookAt(0, 0, 0);

          renderer.render(scene, camera);
        });

        window.addEventListener('resize', resize, { passive: true });
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);

        setStats({
          backend: 'WebGPU + TSL',
          quality,
          particles: profile.count,
        });
        setState('running');
        setMessage('Motor de partículas TSL ejecutándose en GPU.');

        cleanup = () => {
          renderer.setAnimationLoop(null);
          window.removeEventListener('resize', resize);
          window.removeEventListener('pointermove', onPointerMove);
          document.removeEventListener('visibilitychange', onVisibility);
          geometry.dispose();
          material.dispose();
          renderer.dispose();
          if (renderer.domElement.parentElement === host) host.removeChild(renderer.domElement);
        };
      } catch (error) {
        console.error('[Galaxy WebGPU Lab]', error);
        setState('error');
        setMessage('WebGPU está disponible, pero el laboratorio TSL no pudo inicializarse. Revisa la consola del navegador.');
      }
    }

    void start();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <section className="webgpuLab" aria-label="Laboratorio WebGPU de partículas">
      <div ref={mountRef} className="webgpuLabCanvas" />

      <div className="webgpuLabHud">
        <span className="webgpuLabEyebrow">GALAXY ENGINE · V3.2</span>
        <h1>WebGPU Particle Lab</h1>
        <p>{message}</p>

        {stats && (
          <div className="webgpuLabStats">
            <span>{stats.backend}</span>
            <span>{stats.quality}</span>
            <span>{stats.particles.toLocaleString('es-PE')} partículas</span>
          </div>
        )}

        <a className="webgpuLabBack" href="/">
          Volver a la galaxia
        </a>

        {state === 'unsupported' && (
          <small>Este laboratorio requiere WebGPU. La experiencia principal permanece disponible mediante WebGL2.</small>
        )}
      </div>
    </section>
  );
}
