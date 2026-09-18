'use client';

import { useEffect, useRef, useState } from 'react';

import {
  GPU_PARTICLE_PROFILES,
  detectGPUParticleQuality,
  type GPUParticleQuality,
} from './particleEngineConfig';

type RuntimeState = 'initializing' | 'running' | 'unsupported' | 'error';

type MigrationStats = {
  backend: string;
  quality: GPUParticleQuality;
  stars: number;
  migratedLayers: number;
};

type LayerData = {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  phases: Float32Array;
};

type ShootingState = {
  group: any;
  delay: number;
  speed: number;
  angle: number;
  startX: number;
  startY: number;
  startZ: number;
};

function createRandom(seed = 92837) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function signedNoise(random: () => number) {
  return (random() + random() + random() - 1.5) / 1.5;
}

function clampCount(value: number) {
  return Math.max(1, Math.floor(value));
}

export default function WebGPUVisualGalaxy() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<RuntimeState>('initializing');
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [message, setMessage] = useState('Inicializando la escena visual WebGPU + TSL…');

  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};

    async function start() {
      const host = mountRef.current;
      if (!host) return;

      if (!('gpu' in navigator)) {
        setState('unsupported');
        setMessage('WebGPU no está disponible en este navegador. La ruta principal continúa funcionando con WebGL2.');
        return;
      }

      try {
        const THREE = await import('three/webgpu');
        const TSL = await import('three/tsl');

        if (disposed) return;

        const quality = detectGPUParticleQuality();
        const profile = GPU_PARTICLE_PROFILES[quality];
        const totalBudget = profile.count;

        const farCount = clampCount(totalBudget * 0.16);
        const nearCount = clampCount(totalBudget * 0.09);
        const galaxyCount = clampCount(totalBudget * 0.39);
        const dustCount = clampCount(totalBudget * 0.08);
        const coreCount = clampCount(totalBudget * 0.12);
        const clusterCount = clampCount(totalBudget * 0.16);
        const totalStars = farCount + nearCount + galaxyCount + dustCount + coreCount + clusterCount;

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

        const isMobile = host.clientWidth < 640;
        const camera = new THREE.PerspectiveCamera(
          isMobile ? 54 : 44,
          Math.max(1, host.clientWidth) / Math.max(1, host.clientHeight),
          0.1,
          160,
        );
        camera.position.set(0.05, isMobile ? 2.5 : 2.0, isMobile ? 20.5 : 16.8);
        camera.lookAt(0, 0, 0);

        const root = new THREE.Group();
        root.rotation.x = -0.05;
        scene.add(root);

        const geometries: Array<{ dispose: () => void }> = [];
        const materials: Array<{ dispose: () => void }> = [];
        const shootingStates: ShootingState[] = [];

        function trackGeometry<T extends { dispose: () => void }>(geometry: T) {
          geometries.push(geometry);
          return geometry;
        }

        function trackMaterial<T extends { dispose: () => void }>(material: T) {
          materials.push(material);
          return material;
        }

        function createParticleLayer(
          data: LayerData,
          options: {
            opacity: number;
            rotationSpeed: number;
            verticalMotion: number;
            twinkleSpeed: number;
          },
        ) {
          const count = data.sizes.length;
          const positionAttribute = new THREE.InstancedBufferAttribute(data.positions, 3);
          const colorAttribute = new THREE.InstancedBufferAttribute(data.colors, 3);
          const sizeAttribute = new THREE.InstancedBufferAttribute(data.sizes, 1);
          const phaseAttribute = new THREE.InstancedBufferAttribute(data.phases, 1);

          const instancePosition = TSL.instancedBufferAttribute(positionAttribute);
          const instanceColor = TSL.instancedBufferAttribute(colorAttribute);
          const instanceSize = TSL.instancedBufferAttribute(sizeAttribute);
          const instancePhase = TSL.instancedBufferAttribute(phaseAttribute);

          const material = trackMaterial(new THREE.SpriteNodeMaterial());
          material.transparent = true;
          material.depthWrite = false;
          material.blending = THREE.AdditiveBlending;

          material.positionNode = TSL.Fn(() => {
            const angle = TSL.time.mul(options.rotationSpeed).add(instancePhase.mul(0.0015));
            const c = TSL.cos(angle);
            const s = TSL.sin(angle);
            const x = instancePosition.x.mul(c).sub(instancePosition.z.mul(s));
            const z = instancePosition.x.mul(s).add(instancePosition.z.mul(c));
            const y = instancePosition.y.add(
              TSL.sin(TSL.time.mul(0.16).add(instancePhase)).mul(options.verticalMotion),
            );
            return TSL.vec3(x, y, z);
          })();

          material.scaleNode = TSL.vec2(
            instanceSize.mul(
              TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
                .mul(0.10)
                .add(1.0),
            ),
          );

          material.colorNode = TSL.Fn(() => {
            const twinkle = TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
              .mul(0.07)
              .add(0.93);
            return instanceColor.mul(twinkle);
          })();

          material.opacityNode = TSL.Fn(() => {
            const centered = TSL.uv().sub(TSL.vec2(0.5));
            const radius = centered.length();
            const circle = TSL.step(radius, 0.5);
            const core = TSL.smoothstep(0.5, 0.04, radius);
            const halo = TSL.smoothstep(0.5, 0.16, radius);
            const twinkle = TSL.sin(TSL.time.mul(options.twinkleSpeed).add(instancePhase))
              .mul(0.08)
              .add(0.92);
            return circle
              .mul(core.mul(0.56).add(halo.mul(0.34)).add(0.08))
              .mul(twinkle)
              .mul(options.opacity);
          })();

          const geometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
          const mesh = new THREE.InstancedMesh(geometry, material, count);
          mesh.frustumCulled = false;
          return mesh;
        }

        function createDepthLayer(
          count: number,
          radiusMin: number,
          radiusMax: number,
          seed: number,
          palette: string[],
          sizeMin: number,
          sizeMax: number,
        ): LayerData {
          const random = createRandom(seed + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const paletteColors = palette.map((value) => new THREE.Color(value));

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const theta = random() * Math.PI * 2;
            const cosPhi = random() * 2 - 1;
            const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
            const radius = radiusMin + Math.pow(random(), 0.82) * (radiusMax - radiusMin);

            positions[i3] = radius * sinPhi * Math.cos(theta);
            positions[i3 + 1] = radius * cosPhi * 0.58;
            positions[i3 + 2] = radius * sinPhi * Math.sin(theta);

            const color = paletteColors[Math.min(paletteColors.length - 1, Math.floor(random() * paletteColors.length))];
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;

            sizes[i] = random() > 0.992
              ? sizeMax * (1.3 + random() * 0.65)
              : sizeMin + Math.pow(random(), 2.25) * (sizeMax - sizeMin);
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createGalaxyLayer(count: number, dust = false): LayerData {
          const random = createRandom((dust ? 18871 : 99211) + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const branches = 4;
          const maxRadius = dust ? 14.2 : 13.4;
          const warm = new THREE.Color('#ffd7a5');
          const neutral = new THREE.Color('#eef3ff');
          const blue = new THREE.Color('#a8c7ff');
          const dusty = new THREE.Color('#7182a7');
          const current = new THREE.Color();

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const radius = Math.pow(random(), dust ? 0.72 : 0.64) * maxRadius;
            const branch = i % branches;
            const branchAngle = (branch / branches) * Math.PI * 2;
            const spin = radius * (dust ? 0.30 : 0.31);
            const armAngle = branchAngle + spin;
            const freeAngle = random() * Math.PI * 2.3;
            const branchStrength = dust ? 0.58 : 0.46;
            const armBlend = branchStrength * (0.70 + (1 - Math.min(1, radius / maxRadius)) * 0.24);
            const angle = freeAngle + (armAngle - freeAngle) * armBlend + signedNoise(random) * (dust ? 0.20 : 0.13);
            const thickness = 0.025 + radius * (dust ? 0.010 : 0.0075);

            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = signedNoise(random) * thickness;
            positions[i3 + 2] = Math.sin(angle) * radius * (0.76 + random() * 0.08);

            if (dust) {
              current.copy(dusty).offsetHSL(0, 0, (random() - 0.5) * 0.08);
            } else {
              const roll = random();
              current.copy(roll < 0.24 ? blue : roll < 0.79 ? neutral : warm);
              current.offsetHSL((random() - 0.5) * 0.01, 0, (random() - 0.5) * 0.065);
            }

            colors[i3] = current.r;
            colors[i3 + 1] = current.g;
            colors[i3 + 2] = current.b;
            sizes[i] = dust
              ? 0.018 + Math.pow(random(), 2.0) * 0.032
              : random() > 0.991
                ? 0.095 + random() * 0.075
                : 0.022 + Math.pow(random(), 2.3) * 0.050;
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createCoreLayer(count: number): LayerData {
          const random = createRandom(71341 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);
          const hot = new THREE.Color('#fff2d8');
          const warm = new THREE.Color('#ffd5a0');
          const cool = new THREE.Color('#d8e4ff');
          const current = new THREE.Color();

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const angle = random() * Math.PI * 2;
            const radius = Math.pow(random(), 1.75) * 2.65;
            const flatten = 0.72 + random() * 0.18;

            positions[i3] = Math.cos(angle) * radius;
            positions[i3 + 1] = signedNoise(random) * (0.035 + radius * 0.018);
            positions[i3 + 2] = Math.sin(angle) * radius * flatten;

            const mix = random();
            current.copy(mix < 0.56 ? hot : mix < 0.88 ? warm : cool);
            current.offsetHSL((random() - 0.5) * 0.008, 0, (random() - 0.5) * 0.07);
            colors[i3] = current.r;
            colors[i3 + 1] = current.g;
            colors[i3 + 2] = current.b;

            sizes[i] = random() > 0.986
              ? 0.11 + random() * 0.09
              : 0.028 + Math.pow(random(), 2.5) * 0.055;
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createClusterLayer(count: number): LayerData {
          const random = createRandom(44017 + count);
          const positions = new Float32Array(count * 3);
          const colors = new Float32Array(count * 3);
          const sizes = new Float32Array(count);
          const phases = new Float32Array(count);

          const centers = Array.from({ length: 9 }, () => {
            const radius = 3.0 + random() * 7.7;
            const angle = random() * Math.PI * 2.3;
            return {
              x: Math.cos(angle) * radius,
              z: Math.sin(angle) * radius * 0.78,
              spread: 0.22 + random() * 0.52,
            };
          });

          const hotBlue = new THREE.Color('#b7d7ff');
          const neutralWhite = new THREE.Color('#f4f6ff');
          const warmWhite = new THREE.Color('#ffe3b5');
          const redGiant = new THREE.Color('#ffb39e');

          for (let i = 0; i < count; i++) {
            const i3 = i * 3;
            const center = centers[i % centers.length];
            const spread = center.spread * (0.36 + Math.pow(random(), 1.7));
            const localAngle = random() * Math.PI * 2;
            const localRadius = spread * Math.sqrt(random());

            positions[i3] = center.x + Math.cos(localAngle) * localRadius;
            positions[i3 + 1] = signedNoise(random) * (0.03 + spread * 0.07);
            positions[i3 + 2] = center.z + Math.sin(localAngle) * localRadius;

            const roll = random();
            const source = roll < 0.26
              ? hotBlue
              : roll < 0.82
                ? neutralWhite
                : roll < 0.975
                  ? warmWhite
                  : redGiant;

            colors[i3] = source.r;
            colors[i3 + 1] = source.g;
            colors[i3 + 2] = source.b;
            sizes[i] = random() > 0.98
              ? 0.10 + random() * 0.08
              : 0.026 + Math.pow(random(), 2.4) * 0.054;
            phases[i] = random() * Math.PI * 2;
          }

          return { positions, colors, sizes, phases };
        }

        function createTSLGalaxyDisc() {
          const material = trackMaterial(new THREE.MeshBasicNodeMaterial());
          material.transparent = true;
          material.depthWrite = false;
          material.depthTest = false;
          material.blending = THREE.NormalBlending;

          const centered = TSL.uv().sub(TSL.vec2(0.5));
          const elliptical = TSL.vec2(centered.x.div(0.50), centered.y.div(0.43));
          const radius = elliptical.length();
          const edge = TSL.smoothstep(1.0, 0.60, radius);
          const coreGlow = TSL.smoothstep(0.44, 0.0, radius);
          const innerGlow = TSL.smoothstep(0.72, 0.12, radius);
          const waveA = TSL.sin(
            elliptical.x.mul(15.0)
              .add(elliptical.y.mul(11.0))
              .add(radius.mul(18.0))
              .sub(TSL.time.mul(0.025)),
          ).mul(0.5).add(0.5);
          const waveB = TSL.sin(
            elliptical.x.mul(-9.0)
              .add(elliptical.y.mul(17.0))
              .add(radius.mul(23.0))
              .add(1.7),
          ).mul(0.5).add(0.5);
          const filament = waveA.mul(waveB).mul(edge);

          material.colorNode = TSL.vec3(0.20, 0.28, 0.50)
            .mul(edge.mul(0.42))
            .add(TSL.vec3(1.0, 0.76, 0.46).mul(coreGlow.mul(0.68)))
            .add(TSL.vec3(0.56, 0.68, 1.0).mul(innerGlow.mul(0.22)))
            .add(TSL.vec3(0.38, 0.52, 0.94).mul(filament.mul(0.12)));

          material.opacityNode = edge
            .mul(0.16)
            .add(coreGlow.mul(0.20))
            .add(innerGlow.mul(0.08))
            .add(filament.mul(0.035));

          const geometry = trackGeometry(new THREE.PlaneGeometry(27.5, 25.5));
          const mesh = new THREE.Mesh(geometry, material);
          mesh.rotation.x = -Math.PI / 2;
          mesh.scale.set(1.24, 0.92, 1);
          mesh.renderOrder = -1;
          return mesh;
        }

        function createTSLNebula() {
          const material = trackMaterial(new THREE.MeshBasicNodeMaterial());
          material.transparent = true;
          material.side = THREE.BackSide;
          material.depthWrite = false;
          material.depthTest = false;
          material.blending = THREE.AdditiveBlending;

          const q = TSL.uv();
          const cloudA = TSL.sin(
            q.x.mul(19.0).add(q.y.mul(13.0)).add(TSL.time.mul(0.015)),
          ).mul(0.5).add(0.5);
          const cloudB = TSL.sin(
            q.x.mul(-11.0).add(q.y.mul(27.0)).sub(TSL.time.mul(0.010)).add(2.1),
          ).mul(0.5).add(0.5);
          const cloudC = TSL.sin(
            q.x.mul(31.0).sub(q.y.mul(7.0)).add(TSL.time.mul(0.006)).add(4.0),
          ).mul(0.5).add(0.5);
          const cloud = cloudA.mul(0.45).add(cloudB.mul(0.35)).add(cloudC.mul(0.20));
          const structure = TSL.smoothstep(0.48, 0.88, cloud);

          material.colorNode = TSL.vec3(0.12, 0.18, 0.42)
            .mul(cloud.mul(0.65))
            .add(TSL.vec3(0.31, 0.20, 0.48).mul(structure.mul(0.34)));
          material.opacityNode = cloud.mul(0.035).add(structure.mul(0.055));

          const geometry = trackGeometry(new THREE.SphereGeometry(46, 32, 20));
          const mesh = new THREE.Mesh(geometry, material);
          mesh.renderOrder = -10;
          return mesh;
        }

        function createTSLShootingStars() {
          const random = createRandom(55591);
          const group = new THREE.Group();
          group.rotation.x = 0.035;
          const count = isMobile ? 2 : quality === 'high' ? 5 : quality === 'balanced' ? 4 : 3;

          for (let i = 0; i < count; i++) {
            const starGroup = new THREE.Group();
            const tailLength = 1.35 + random() * 1.45;
            const tailWidth = 0.07 + random() * 0.045;

            const tailMaterial = trackMaterial(new THREE.MeshBasicNodeMaterial());
            tailMaterial.transparent = true;
            tailMaterial.depthWrite = false;
            tailMaterial.depthTest = false;
            tailMaterial.blending = THREE.AdditiveBlending;

            const tailUv = TSL.uv();
            const longitudinal = tailUv.x.mul(tailUv.x).mul(tailUv.x);
            const centeredY = TSL.abs(tailUv.y.sub(0.5));
            const vertical = TSL.smoothstep(0.5, 0.0, centeredY);
            const tailAlpha = longitudinal.mul(vertical).mul(0.36);
            tailMaterial.colorNode = TSL.vec3(0.43, 0.58, 0.96)
              .mul(TSL.float(1.0).sub(tailUv.x).mul(0.35).add(0.65))
              .add(TSL.vec3(0.90, 0.94, 1.0).mul(tailUv.x.mul(0.45)));
            tailMaterial.opacityNode = tailAlpha;

            const tailGeometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
            const tail = new THREE.Mesh(tailGeometry, tailMaterial);
            tail.scale.set(tailLength, tailWidth, 1);
            tail.position.x = tailLength * 0.5;
            starGroup.add(tail);

            const headMaterial = trackMaterial(new THREE.SpriteNodeMaterial());
            headMaterial.transparent = true;
            headMaterial.depthWrite = false;
            headMaterial.depthTest = false;
            headMaterial.blending = THREE.AdditiveBlending;
            const headUv = TSL.uv().sub(TSL.vec2(0.5));
            const headRadius = headUv.length();
            const headCore = TSL.smoothstep(0.18, 0.0, headRadius);
            const headHalo = TSL.smoothstep(0.5, 0.10, headRadius);
            const twinkle = TSL.sin(TSL.time.mul(3.1).add(i * 1.73)).mul(0.08).add(0.92);
            headMaterial.colorNode = TSL.vec3(0.68, 0.78, 1.0)
              .mul(headHalo.mul(0.52))
              .add(TSL.vec3(1.0, 0.94, 0.82).mul(headCore.mul(1.15)));
            headMaterial.opacityNode = headCore.mul(0.72).add(headHalo.mul(0.42)).mul(twinkle);
            headMaterial.scaleNode = TSL.vec2(0.19);

            const headGeometry = trackGeometry(new THREE.PlaneGeometry(1, 1));
            const head = new THREE.InstancedMesh(headGeometry, headMaterial, 1);
            head.position.x = tailLength;
            head.frustumCulled = false;
            starGroup.add(head);

            const angle = -0.20 - random() * 0.33;
            const startX = -17 - random() * 7;
            const startY = random() > 0.26 ? 2.8 + random() * 8.2 : -0.5 + random() * 4.0;
            const startZ = -5.5 + random() * 10.5;
            starGroup.position.set(startX, startY, startZ);
            starGroup.rotation.z = angle;
            starGroup.visible = false;
            group.add(starGroup);

            shootingStates.push({
              group: starGroup,
              delay: 1.5 + i * 1.15 + random() * 5.0,
              speed: 4.4 + random() * 3.5,
              angle,
              startX,
              startY,
              startZ,
            });
          }

          return group;
        }

        const nebula = createTSLNebula();
        scene.add(nebula);

        const disc = createTSLGalaxyDisc();
        root.add(disc);

        const farStars = createParticleLayer(
          createDepthLayer(farCount, 24, 54, 1103, ['#8095c5', '#aab9d9', '#d5ddf0'], 0.018, 0.045),
          { opacity: 0.44, rotationSpeed: 0.0011, verticalMotion: 0.004, twinkleSpeed: 0.34 },
        );

        const nearStars = createParticleLayer(
          createDepthLayer(nearCount, 15, 32, 7411, ['#aec4f5', '#d9e4fb', '#f1f5ff'], 0.022, 0.062),
          { opacity: 0.52, rotationSpeed: 0.0018, verticalMotion: 0.006, twinkleSpeed: 0.42 },
        );

        const galaxyStars = createParticleLayer(createGalaxyLayer(galaxyCount), {
          opacity: 0.84,
          rotationSpeed: 0.010,
          verticalMotion: 0.0035,
          twinkleSpeed: 0.46,
        });

        const galaxyDust = createParticleLayer(createGalaxyLayer(dustCount, true), {
          opacity: 0.23,
          rotationSpeed: 0.008,
          verticalMotion: 0.002,
          twinkleSpeed: 0.22,
        });

        const core = createParticleLayer(createCoreLayer(coreCount), {
          opacity: 0.90,
          rotationSpeed: 0.020,
          verticalMotion: 0.003,
          twinkleSpeed: 0.55,
        });

        const clusters = createParticleLayer(createClusterLayer(clusterCount), {
          opacity: 0.78,
          rotationSpeed: 0.008,
          verticalMotion: 0.004,
          twinkleSpeed: 0.62,
        });

        farStars.renderOrder = -5;
        nearStars.renderOrder = -3;
        galaxyDust.renderOrder = 0;
        galaxyStars.renderOrder = 1;
        core.renderOrder = 2;
        clusters.renderOrder = 3;
        root.add(farStars, nearStars, galaxyDust, galaxyStars, core, clusters);

        const shootingStars = createTSLShootingStars();
        scene.add(shootingStars);

        let pointerX = 0;
        let pointerY = 0;
        let targetX = 0;
        let targetY = 0;
        let running = document.visibilityState !== 'hidden';

        const onPointerMove = (event: PointerEvent) => {
          targetX = (event.clientX / window.innerWidth) * 2 - 1;
          targetY = -((event.clientY / window.innerHeight) * 2 - 1);
        };

        const resize = () => {
          const width = host.clientWidth;
          const height = host.clientHeight;
          if (!width || !height) return;

          const mobile = width < 640;
          camera.aspect = width / height;
          camera.fov = mobile ? 54 : 44;
          camera.position.z = mobile ? 20.5 : 16.8;
          camera.position.y = mobile ? 2.5 : 2.0;
          camera.updateProjectionMatrix();

          renderer.setSize(width, height);
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioMax));
        };

        const onVisibility = () => {
          running = document.visibilityState !== 'hidden';
        };

        const clock = new THREE.Clock();

        renderer.setAnimationLoop(() => {
          if (!running) return;

          const delta = Math.min(clock.getDelta(), 0.05);
          const easing = 1 - Math.exp(-delta * 2.0);
          pointerX += (targetX - pointerX) * easing;
          pointerY += (targetY - pointerY) * easing;

          root.rotation.y += delta * 0.0045;
          root.rotation.z = THREE.MathUtils.lerp(root.rotation.z, pointerX * 0.018, easing * 0.4);
          root.rotation.x = THREE.MathUtils.lerp(root.rotation.x, -0.05 + pointerY * 0.012, easing * 0.4);

          camera.position.x = THREE.MathUtils.lerp(camera.position.x, pointerX * 0.34, easing * 0.26);
          camera.lookAt(0, 0, 0);

          for (const shooting of shootingStates) {
            shooting.delay -= delta;
            if (shooting.delay > 0) {
              shooting.group.visible = false;
              continue;
            }

            shooting.group.visible = true;
            shooting.group.position.x += Math.cos(shooting.angle) * shooting.speed * delta;
            shooting.group.position.y += Math.sin(shooting.angle) * shooting.speed * delta;

            if (shooting.group.position.x > 18.5 || shooting.group.position.y < -8.5) {
              shooting.group.position.set(shooting.startX, shooting.startY, shooting.startZ);
              shooting.delay = 2.2 + Math.random() * 7.5;
              shooting.group.visible = false;
            }
          }

          renderer.render(scene, camera);
        });

        window.addEventListener('resize', resize, { passive: true });
        window.addEventListener('pointermove', onPointerMove, { passive: true });
        document.addEventListener('visibilitychange', onVisibility);

        setStats({
          backend: 'WebGPU + TSL',
          quality,
          stars: totalStars,
          migratedLayers: 7,
        });
        setState('running');
        setMessage('Disco galáctico, nebulosa y estrellas fugaces ya se suman a las cuatro capas TSL de V3.2.');

        cleanup = () => {
          renderer.setAnimationLoop(null);
          window.removeEventListener('resize', resize);
          window.removeEventListener('pointermove', onPointerMove);
          document.removeEventListener('visibilitychange', onVisibility);

          geometries.forEach((geometry) => geometry.dispose());
          materials.forEach((material) => material.dispose());
          renderer.dispose();

          if (renderer.domElement.parentElement === host) {
            host.removeChild(renderer.domElement);
          }
        };
      } catch (error) {
        console.error('[Galaxy WebGPU Full TSL Visual Stack]', error);
        setState('error');
        setMessage('WebGPU está disponible, pero la escena TSL no pudo inicializarse. Revisa la consola del navegador.');
      }
    }

    void start();

    return () => {
      disposed = true;
      cleanup();
    };
  }, []);

  return (
    <main className="webgpuMigration" aria-label="Migración visual WebGPU de la galaxia">
      <div ref={mountRef} className="webgpuMigrationCanvas" />

      <div className="webgpuMigrationHud">
        <span className="webgpuLabEyebrow">GALAXY ENGINE · V3.3</span>
        <h1>Full TSL Visual Stack</h1>
        <p>{message}</p>

        {stats && (
          <div className="webgpuLabStats">
            <span>{stats.backend}</span>
            <span>{stats.quality}</span>
            <span>{stats.stars.toLocaleString()} partículas</span>
            <span>{stats.migratedLayers}/7 capas visuales</span>
          </div>
        )}

        <div className="webgpuMigrationProgress" aria-label="Progreso de migración visual">
          <div className="webgpuMigrationProgressBar" />
        </div>

        <div className="webgpuMigrationStatus">
          <span className="isDone">StarField</span>
          <span className="isDone">DepthStarLayers</span>
          <span className="isDone">GalacticCore</span>
          <span className="isDone">StarClusters</span>
          <span className="isDone">GalaxyShader / Disc</span>
          <span className="isDone">NebulaShader</span>
          <span className="isDone">ShootingStars</span>
        </div>

        <div className="webgpuMigrationActions">
          <a className="webgpuLabBack" href="/">
            Galaxia estable
          </a>
          <a className="webgpuLabBack" href="/webgpu-lab">
            Particle Lab
          </a>
        </div>

        {state === 'unsupported' && (
          <small>Necesitas un navegador con WebGPU para ejecutar esta ruta experimental.</small>
        )}

        {state === 'error' && (
          <small>La página principal permanece disponible con el renderer WebGL2 estable.</small>
        )}
      </div>
    </main>
  );
}
