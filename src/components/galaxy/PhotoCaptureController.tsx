'use client';

import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

export type PhotoCaptureApi = {
  capturePng: (filename?: string) => Promise<void>;
};

export default function PhotoCaptureController({
  apiRef,
}: {
  apiRef: { current: PhotoCaptureApi | null };
}) {
  const { gl, scene, camera, size } = useThree();

  useEffect(() => {
    apiRef.current = {
      capturePng: async (filename = 'galaxia-v3.6.5.png') => {
        const previousPixelRatio = gl.getPixelRatio();
        const previousSize = gl.getSize(new THREE.Vector2());
        const devicePixelRatio = window.devicePixelRatio || 1;
        const exportPixelRatio = Math.min(Math.max(devicePixelRatio * 1.75, 2), 3);

        try {
          gl.setPixelRatio(exportPixelRatio);
          gl.setSize(size.width, size.height, false);
          gl.render(scene, camera);

          await new Promise<void>((resolve, reject) => {
            gl.domElement.toBlob((blob) => {
              if (!blob) {
                reject(new Error('No se pudo generar la captura PNG.'));
                return;
              }

              const url = URL.createObjectURL(blob);
              const anchor = document.createElement('a');
              anchor.href = url;
              anchor.download = filename;
              document.body.appendChild(anchor);
              anchor.click();
              anchor.remove();
              URL.revokeObjectURL(url);
              resolve();
            }, 'image/png');
          });
        } finally {
          gl.setPixelRatio(previousPixelRatio);
          gl.setSize(previousSize.x, previousSize.y, false);
          gl.render(scene, camera);
        }
      },
    };

    return () => {
      apiRef.current = null;
    };
  }, [apiRef, camera, gl, scene, size.height, size.width]);

  return null;
}
