'use client';

import { useEffect, useState } from 'react';
import * as THREE from 'three';

const textureCache = new Map();

function cacheKey(url) {
  return String(url || '');
}

function loadTexture(url) {
  const key = cacheKey(url);
  if (!key) return Promise.resolve(null);
  const hit = textureCache.get(key);
  if (hit?.texture) return Promise.resolve(hit.texture);
  if (hit?.promise) return hit.promise;

  const promise = new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    try {
      const isRemoteHttp = /^https?:\/\//i.test(key);
      let sameOrigin = true;
      if (isRemoteHttp && typeof window !== 'undefined') {
        try { sameOrigin = new URL(key, window.location.href).origin === window.location.origin; } catch { sameOrigin = false; }
      }
      if (isRemoteHttp && !sameOrigin) loader.setCrossOrigin('anonymous');
    } catch { /* keep default */ }
    loader.load(
      key,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 4;
        texture.needsUpdate = true;
        textureCache.set(key, { texture, promise: null });
        resolve(texture);
      },
      undefined,
      () => {
        textureCache.delete(key);
        resolve(null);
      },
    );
  });
  textureCache.set(key, { texture: null, promise });
  return promise;
}

/**
 * Non-suspending photo material. A bad/revoked URL must never crash the Canvas.
 * Cached by URL so slot switches reuse GPU textures instead of reallocating.
 */
export default function SafePhotoMaterial({
  url = '',
  color = '#d9d2c5',
  roughness = 0.68,
  metalness = 0.04,
}) {
  const [map, setMap] = useState(() => textureCache.get(cacheKey(url))?.texture || null);

  useEffect(() => {
    const key = cacheKey(url);
    if (!key) {
      setMap(null);
      return undefined;
    }
    let cancelled = false;
    const cached = textureCache.get(key)?.texture;
    if (cached) {
      setMap(cached);
      return undefined;
    }
    loadTexture(key).then((texture) => {
      if (!cancelled) setMap(texture);
    });
    return () => { cancelled = true; };
  }, [url]);

  return (
    <meshStandardMaterial
      map={map || null}
      color={map ? '#ffffff' : color}
      roughness={roughness}
      metalness={metalness}
    />
  );
}
