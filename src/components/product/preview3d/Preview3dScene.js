'use client';

import { Component, Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import {
  buildMeshPath,
  buildMeshSurfaceId,
  findMeshForSurface,
  inspectSceneMeshes,
} from '@/lib/preview3dGlb';
import {
  computeArrangementPositions,
  dimensionsToSceneSize,
  normalizePreview3dDimensions,
  normalizePreview3dLayout,
} from '@/lib/preview3d';
import PhotoFrameModel, {
  PhotoFrameHardwareOnBounds,
  photoFrameDimsToScene,
} from './PhotoFrameModel';

const Preview3dAtmosphere = lazy(() => import('./Preview3dAtmosphere'));

const WALL_PRESENTATION_OFFSET = [0, 0.12, -0.06];
export const WALL_ROOM_Z = -0.125;

function offsetModelBounds(payload, offset) {
  if (!payload?.min || !payload?.max || !payload?.center || !offset) return payload;
  const [dx, dy, dz] = offset;
  return {
    ...payload,
    min: [payload.min[0] + dx, payload.min[1] + dy, payload.min[2] + dz],
    max: [payload.max[0] + dx, payload.max[1] + dy, payload.max[2] + dz],
    center: [payload.center[0] + dx, payload.center[1] + dy, payload.center[2] + dz],
  };
}

/** Contains R3F / GLB load failures so the product page purchase path stays usable. */
class Preview3dErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error: error || true };
  }

  componentDidCatch() {
    try { this.props.onError?.(this.state.error); } catch { /* ignore */ }
  }

  render() {
    if (this.state.error) {
      return this.props.fallback || (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-700">
          This 3D model could not be loaded. Close the viewer and continue with the normal product page.
        </div>
      );
    }
    return this.props.children;
  }
}

function SlotTextureMaterial({ url, placeholderUrl, color = '#d9d2c5' }) {
  const mapUrl = url || placeholderUrl || '';
  if (!mapUrl) {
    return <meshStandardMaterial color={color} roughness={0.85} metalness={0.05} />;
  }
  return <TexturedMaterial url={mapUrl} fallbackColor={color} />;
}

function TexturedMaterial({ url, fallbackColor }) {
  const texture = useTexture(url);
  useMemo(() => {
    if (texture) {
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = 4;
      texture.needsUpdate = true;
    }
  }, [texture]);
  return (
    <meshStandardMaterial
      map={texture || null}
      color={texture ? '#ffffff' : fallbackColor}
      roughness={0.68}
      metalness={0.04}
    />
  );
}

function planeSizeForAspect(aspect, fallback = [1.2, 1.2], sceneSize = null) {
  if (sceneSize?.width && sceneSize?.height) {
    return [sceneSize.width, sceneSize.height];
  }
  const w = Math.max(0.05, Number(aspect?.width) || fallback[0]);
  const h = Math.max(0.05, Number(aspect?.height) || fallback[1]);
  const maxSide = 1.2;
  const scale = maxSide / Math.max(w, h);
  return [w * scale, h * scale];
}

/** Premium wall-frame: outer moulding + mat + photo plane. */
function FramePlane({
  position,
  size = [1, 1],
  depth = 0.1,
  textureUrl,
  placeholderUrl,
  frameColor,
  accentColor,
  selected,
  onSelect,
  scale = 1,
}) {
  const [w, h] = size;
  const moulding = 0.1;
  const matInset = 0.05;
  return (
    <group position={position} scale={scale}>
      <mesh
        castShadow
        receiveShadow
        position={[0, 0, -depth / 2]}
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
      >
        <boxGeometry args={[w + moulding * 2, h + moulding * 2, depth]} />
        <meshStandardMaterial color={frameColor} roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh position={[0, 0, 0.002]}>
        <boxGeometry args={[w + matInset * 2, h + matInset * 2, 0.012]} />
        <meshStandardMaterial color="#f4f0e8" roughness={0.9} metalness={0.02} />
      </mesh>
      <mesh
        position={[0, 0, 0.014]}
        castShadow
        onClick={(event) => {
          event.stopPropagation();
          onSelect?.();
        }}
      >
        <planeGeometry args={[w, h]} />
        <SlotTextureMaterial url={textureUrl} placeholderUrl={placeholderUrl} color={accentColor} />
      </mesh>
      {selected ? (
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[w + 0.05, h + 0.05, 0.01]} />
          <meshBasicMaterial color="#c45c26" transparent opacity={0.26} />
        </mesh>
      ) : null}
    </group>
  );
}

function MultiGridFrames({
  textures,
  surfaces,
  layout,
  frameColor,
  accentColor,
  focusedIndex,
  onSelectSurface,
  sceneSize = null,
}) {
  const positions = useMemo(
    () => computeArrangementPositions(textures.length, layout, surfaces),
    [textures.length, layout, surfaces],
  );
  const cell = normalizePreview3dLayout(layout).cellScale;
  const depth = sceneSize?.depth || 0.1;

  return (
    <group>
      {textures.map((slot, index) => {
        const pos = positions[index] || { x: 0, y: 0, z: 0, scale: 1 };
        const size = planeSizeForAspect(slot.aspect, [cell * 0.85, cell * 0.85], sceneSize);
        return (
          <FramePlane
            key={slot.slotKey || index}
            position={[pos.x, pos.y, pos.z]}
            size={size}
            depth={depth}
            scale={pos.scale || 1}
            textureUrl={slot.textureUrl}
            placeholderUrl={slot.placeholderUrl}
            frameColor={frameColor}
            accentColor={accentColor}
            selected={focusedIndex === index}
            onSelect={() => onSelectSurface?.(slot.surfaceId, index)}
          />
        );
      })}
    </group>
  );
}

/** Bottle / mug style cylindrical wrap with body + subtle rim. */
function CylinderWrap({ textures, frameColor, accentColor, onSelectSurface, sceneSize = null }) {
  const slot = textures[0] || {};
  const height = Math.max(0.6, Number(sceneSize?.height) || 1.35);
  const radius = Math.max(0.18, (Number(sceneSize?.width) || 1.05) / 2);
  const rimY = height * 0.53;
  const baseY = -height * 0.58;
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        onSelectSurface?.(slot.surfaceId, 0);
      }}
    >
      <mesh castShadow receiveShadow position={[0, -0.05, 0]}>
        <cylinderGeometry args={[radius * 0.93, radius, height, 64, 1, true]} />
        <SlotTextureMaterial url={slot.textureUrl} placeholderUrl={slot.placeholderUrl} color={accentColor} />
      </mesh>
      <mesh castShadow position={[0, rimY, 0]}>
        <cylinderGeometry args={[radius * 0.5, radius * 0.75, height * 0.2, 48]} />
        <meshStandardMaterial color={frameColor} roughness={0.4} metalness={0.18} />
      </mesh>
      <mesh castShadow position={[0, baseY, 0]}>
        <cylinderGeometry args={[radius * 1.04, radius * 1.04, height * 0.06, 48]} />
        <meshStandardMaterial color={frameColor} roughness={0.45} metalness={0.2} />
      </mesh>
      <mesh castShadow>
        <cylinderGeometry args={[radius * 1.01, radius * 1.03, height * 1.02, 64]} />
        <meshStandardMaterial color={frameColor} roughness={0.5} metalness={0.15} transparent opacity={0.14} />
      </mesh>
    </group>
  );
}

/** Locket / keychain: metal bail + thicker oval body. */
function PendantFace({ textures, frameColor, accentColor, focusedIndex, onSelectSurface, sceneSize = null }) {
  const slot = textures[0] || {};
  const size = planeSizeForAspect(slot.aspect, [0.62, 0.78], sceneSize);
  const depth = Math.max(0.04, Number(sceneSize?.depth) || 0.05);
  const bailY = size[1] * 0.5 + 0.12;
  return (
    <group>
      <mesh castShadow position={[0, bailY, 0]}>
        <torusGeometry args={[0.075, 0.018, 14, 28]} />
        <meshStandardMaterial color={accentColor} metalness={0.72} roughness={0.22} />
      </mesh>
      <mesh castShadow position={[0, 0, -depth * 0.7]}>
        <boxGeometry args={[size[0] + 0.12, size[1] + 0.12, depth]} />
        <meshStandardMaterial color={frameColor} metalness={0.35} roughness={0.35} />
      </mesh>
      <FramePlane
        position={[0, 0, 0.02]}
        size={size}
        depth={depth}
        textureUrl={slot.textureUrl}
        placeholderUrl={slot.placeholderUrl}
        frameColor={frameColor}
        accentColor={accentColor}
        selected={focusedIndex === 0}
        onSelect={() => onSelectSurface?.(slot.surfaceId, 0)}
      />
    </group>
  );
}

function readPreview3dAppearance(mesh, surface = null) {
  // Explicit profile/surface/material configuration only — do not infer from mesh names
  // so other products are unaffected.
  const mat = mesh?.material;
  const fromExtras = surface?.preview3dAppearance
    || surface?.appearance
    || mat?.userData?.preview3dAppearance
    || mat?.userData?.extras?.preview3dAppearance;
  return fromExtras ? String(fromExtras) : 'photo';
}

/** World-space AABB for a loaded object (generic — not SKU-specific). */
function computeObjectBounds(object) {
  if (!object) return null;
  object.updateMatrixWorld?.(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) return null;
  return box;
}

/**
 * Distance that fits a world AABB into the current camera frustum with margin.
 * Uses on-screen projection axes for the active view preset (geometry-agnostic).
 */
function markPreview3dTiming(key) {
  if (typeof window === 'undefined' || typeof performance === 'undefined') return;
  const now = performance.now();
  const base = Number(window.__preview3dOpenAt) || now;
  window.__preview3dTimings = window.__preview3dTimings || {};
  window.__preview3dTimings[key] = Math.round(now - base);
}

function distanceToFitBounds(camera, box, viewPreset = 'front', margin = 1.2) {
  const size = box.getSize(new THREE.Vector3());
  const fov = THREE.MathUtils.degToRad(camera.fov || 40);
  const aspect = Math.max(0.2, Number(camera.aspect) || 1);
  const halfFov = fov / 2;
  let screenW = size.x;
  let screenH = size.y;
  if (viewPreset === 'side' || viewPreset === 'left' || viewPreset === 'right') {
    // Shallow 3/4 so a thin frame is a readable profile, not a centered knife-edge.
    screenW = Math.max(size.z * 2.4, size.x * 0.42);
    screenH = size.y * 0.92;
  } else if (viewPreset === 'top' || viewPreset === 'bottom') {
    screenW = size.x * 0.98;
    screenH = size.z * 1.05;
  } else if (viewPreset === 'closeup') {
    screenW = size.x * 0.68;
    screenH = size.y * 0.5;
  } else if (viewPreset === 'wall') {
    // Frame reads as the hero object; floor/baseboard still visible.
    screenW = size.x * 1.28;
    screenH = size.y * 1.18;
  } else if (viewPreset === 'angled') {
    screenW = size.x * 0.94;
    screenH = size.y * 0.9;
  } else if (viewPreset === 'rear' || viewPreset === 'back') {
    screenW = size.x * 0.94;
    screenH = size.y * 0.96;
  } else {
    // front / default — fill ~80% of the canvas on the limiting axis
    screenW = size.x * 0.9;
    screenH = size.y * 0.9;
  }
  const depthSlack = Math.max(size.z, size.x * 0.08) * (viewPreset === 'wall' ? 0.08 : 0.06);
  const distH = ((screenH + depthSlack) * margin) / (2 * Math.tan(halfFov));
  const distW = ((screenW + depthSlack) * margin) / (2 * Math.tan(halfFov) * aspect);
  return Math.max(distH, distW, 0.32);
}

/** Local XY aspect of a mesh bbox — used so UV textures are contain-fitted, not stretched. */
function meshPlaneAspect(mesh) {
  const geom = mesh?.geometry;
  if (!geom) return 1;
  if (!geom.boundingBox) geom.computeBoundingBox();
  const bb = geom.boundingBox;
  if (!bb) return 1;
  const w = Math.max(1e-6, bb.max.x - bb.min.x);
  const h = Math.max(1e-6, bb.max.y - bb.min.y);
  return w / h;
}

/**
 * Read-only canvas remap: customer photo → monochrome dark-on-silver engraving preview.
 * Does not mutate uploads, crops, or order payloads — viewer-only texture effect.
 * Canvas aspect matches the target mesh face; image is contain-fitted (no stretch).
 */
function loadEngravingStyleMap(textureUrl, onReady, planeAspect = 1) {
  const image = new Image();
  image.crossOrigin = 'anonymous';
  image.onload = () => {
    const aspect = Math.max(0.15, Math.min(4, Number(planeAspect) || 1));
    const base = 768;
    const canvas = document.createElement('canvas');
    if (aspect >= 1) {
      canvas.width = base;
      canvas.height = Math.max(64, Math.round(base / aspect));
    } else {
      canvas.height = base;
      canvas.width = Math.max(64, Math.round(base * aspect));
    }
    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#9aa3ad';
    ctx.fillRect(0, 0, w, h);
    const iw = image.naturalWidth || image.width || 1;
    const ih = image.naturalHeight || image.height || 1;
    const scale = Math.min(w / iw, h / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
    const frame = ctx.getImageData(0, 0, w, h);
    const d = frame.data;
    for (let i = 0; i < d.length; i += 4) {
      const luma = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
      const normalized = Math.max(0, Math.min(1, luma / 255));
      const etched = Math.round(42 + normalized * 148);
      d[i] = etched;
      d[i + 1] = etched + 2;
      d[i + 2] = etched + 4;
      d[i + 3] = 255;
    }
    ctx.putImageData(frame, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.flipY = false;
    map.anisotropy = 4;
    map.needsUpdate = true;
    onReady(map);
  };
  image.onerror = () => onReady(null);
  image.src = textureUrl;
}

function applyTextureToMesh(mesh, textureUrl, accentColor, surface = null) {
  if (!mesh) return null;
  const appearance = readPreview3dAppearance(mesh, surface);
  const loader = new THREE.TextureLoader();
  if (!textureUrl) {
    mesh.material = (mesh.material?.clone?.() || new THREE.MeshStandardMaterial());
    if (appearance === 'metal_engraving') {
      mesh.material.color = new THREE.Color('#8b949e');
      mesh.material.metalness = 0.96;
      mesh.material.roughness = 0.18;
    } else {
      mesh.material.color = new THREE.Color(accentColor || '#d9d2c5');
      mesh.material.metalness = 0.05;
      mesh.material.roughness = 0.85;
    }
    mesh.material.map = null;
    mesh.material.needsUpdate = true;
    return null;
  }

  mesh.material = mesh.material?.clone?.() || new THREE.MeshStandardMaterial();
  if (appearance === 'metal_engraving') {
    mesh.material.color = new THREE.Color('#9aa3ad');
    mesh.material.metalness = 0.96;
    mesh.material.roughness = 0.18;
    mesh.material.envMapIntensity = 0.9;
    mesh.material.needsUpdate = true;
    const tracked = [];
    loadEngravingStyleMap(textureUrl, (map) => {
      if (!map || !mesh.material) return;
      const prev = mesh.userData.__preview3dEngravingMap;
      if (prev && prev !== map) {
        try { prev.dispose(); } catch { /* ignore */ }
      }
      mesh.userData.__preview3dEngravingMap = map;
      mesh.material.map = map;
      mesh.material.color = new THREE.Color('#9aa3ad');
      mesh.material.metalness = 0.96;
      mesh.material.roughness = 0.18;
      mesh.material.envMapIntensity = 0.9;
      mesh.material.needsUpdate = true;
      tracked[0] = map;
    }, meshPlaneAspect(mesh));
    return {
      dispose() {
        const map = tracked[0] || mesh.userData.__preview3dEngravingMap;
        try { map?.dispose?.(); } catch { /* ignore */ }
        delete mesh.userData.__preview3dEngravingMap;
      },
    };
  }

  const map = loader.load(textureUrl);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;
  mesh.material.map = map;
  mesh.material.color = new THREE.Color('#ffffff');
  mesh.material.needsUpdate = true;
  return map;
}

/**
 * Former CustomGlbGate downloaded the entire GLB via fetch() before useGLTF
 * downloaded it again — doubling transfer and adding ~1–2s+ on every remount.
 * useGLTF already caches by URL; Suspense + error boundary handle load failure.
 */
function CustomGlbGate(props) {
  const { url } = props;
  useEffect(() => {
    if (url) {
      try { useGLTF.preload(String(url)); } catch { /* ignore */ }
    }
  }, [url]);
  return <CustomGlbModel {...props} />;
}

export function preloadPreview3dModel(url) {
  if (!url) return;
  try { useGLTF.preload(String(url)); } catch { /* ignore */ }
}

function CustomGlbModel({
  url,
  textures = [],
  surfaces = [],
  legacySequentialGlb = false,
  accentColor,
  selectedSurfaceId = '',
  pickMode = false,
  onMeshesInspected,
  onSelectSurface,
  onModelBounds,
  modelScale = null,
  hideMeshNamePrefixes = [],
  wallMount = false,
}) {
  const { scene } = useGLTF(url);
  const cloned = useMemo(() => scene.clone(true), [scene]);
  const mapsRef = useRef([]);
  const explicitScale = Number.isFinite(Number(modelScale)) && Number(modelScale) > 0
    ? Number(modelScale)
    : null;
  const hidePrefixes = Array.isArray(hideMeshNamePrefixes) ? hideMeshNamePrefixes : [];

  useEffect(() => {
    if (explicitScale) {
      cloned.scale.setScalar(explicitScale);
    } else {
      cloned.scale.set(1, 1, 1);
    }
    // Wall mount: seat frame just in front of the room wall (wallZ ≈ -0.12).
    if (wallMount) {
      cloned.position.set(0, 0.12, -0.06);
    } else {
      cloned.position.set(0, 0, 0);
    }
    cloned.traverse((obj) => {
      if (!obj.isMesh) return;
      const name = String(obj.name || '');
      const hide = hidePrefixes.some((prefix) => name.startsWith(String(prefix || '')));
      obj.visible = !hide;
    });
    const inspected = inspectSceneMeshes(cloned);
    onMeshesInspected?.(inspected);
    const box = computeObjectBounds(cloned);
    if (box) {
      const payload = {
        min: box.min.toArray(),
        max: box.max.toArray(),
        center: box.getCenter(new THREE.Vector3()).toArray(),
        size: box.getSize(new THREE.Vector3()).toArray(),
      };
      // Staging debug for framing verification (non-production).
      if (typeof window !== 'undefined') {
        window.__preview3dModelBounds = payload;
        markPreview3dTiming('glbBounds');
      }
      onModelBounds?.(payload);
    }
    cloned.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const meshName = String(obj.name || '');
      if (meshName === 'PhotoPlane') return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((mat) => {
        const isStand = meshName.startsWith('Stand');
        const isBack = meshName === 'BackPanel';
        const isMoulding = /^(Moulding|Wall(Top|Bottom|Left|Right))/.test(meshName);
        const isFastener = /Screw|Hinge|Keyhole/i.test(meshName);
        if (isStand) {
          mat.color = new THREE.Color('#161616');
          mat.roughness = 0.56;
          mat.metalness = 0.1;
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.18;
        } else if (isBack) {
          mat.roughness = Math.max(0.86, Number(mat.roughness) || 0.86);
          mat.metalness = Math.min(0.04, Number(mat.metalness) || 0);
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.2;
        } else if (isFastener) {
          mat.roughness = Math.min(0.32, Math.max(0.16, Number(mat.roughness) || 0.22));
          mat.metalness = Math.max(0.35, Number(mat.metalness) || 0.4);
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.55;
        } else if (isMoulding) {
          mat.roughness = Math.max(0.58, Number(mat.roughness) || 0.68);
          mat.metalness = Math.min(0.08, Number(mat.metalness) || 0.04);
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.36;
          if (mat.normalMap) {
            mat.normalScale = new THREE.Vector2(1.42, 1.42);
          }
        } else if (Number(mat.metalness) > 0.7) {
          mat.roughness = Math.min(0.22, Math.max(0.1, Number(mat.roughness) || 0.14));
          if (typeof mat.envMapIntensity === 'number') mat.envMapIntensity = 0.7;
        } else if (typeof mat.envMapIntensity === 'number') {
          mat.envMapIntensity = 0.4;
        }
        mat.needsUpdate = true;
      });
    });
  }, [cloned, onMeshesInspected, onModelBounds, explicitScale, wallMount, hidePrefixes.join('|')]);

  useEffect(() => {
    mapsRef.current.forEach((map) => {
      try { map.dispose(); } catch { /* ignore */ }
    });
    mapsRef.current = [];

    const namedSurfaces = (surfaces || []).filter((s) => s.meshName || s.meshPath || s.materialName || s.id);
    const useNamed = namedSurfaces.length > 0 && !legacySequentialGlb;

    if (useNamed) {
      namedSurfaces.forEach((surface) => {
        const mesh = findMeshForSurface(cloned, surface);
        if (!mesh) return;
        const slot = textures.find((t) => t.surfaceId === surface.id);
        const map = applyTextureToMesh(
          mesh,
          slot?.textureUrl || slot?.placeholderUrl || '',
          accentColor,
          surface,
        );
        if (map) mapsRef.current.push(map);
        if (selectedSurfaceId && surface.id === selectedSurfaceId) {
          mesh.material.emissive = new THREE.Color('#c45c26');
          mesh.material.emissiveIntensity = 0.18;
        } else if (mesh.material?.emissive) {
          mesh.material.emissiveIntensity = 0;
        }
      });
    } else if (legacySequentialGlb || !namedSurfaces.length) {
      let planeIndex = 0;
      cloned.traverse((obj) => {
        if (!obj.isMesh) return;
        const slot = textures[planeIndex];
        const map = applyTextureToMesh(obj, slot?.textureUrl || slot?.placeholderUrl || '', accentColor);
        if (map) mapsRef.current.push(map);
        planeIndex += 1;
      });
    }

    return () => {
      mapsRef.current.forEach((map) => {
        try { map.dispose(); } catch { /* ignore */ }
      });
      mapsRef.current = [];
    };
  }, [cloned, textures, surfaces, legacySequentialGlb, accentColor, selectedSurfaceId]);

  useEffect(() => {
    if (!pickMode) return undefined;
    const handlers = [];
    let index = 0;
    cloned.traverse((obj) => {
      if (!obj.isMesh) return;
      const meshIndex = index;
      const surfaceId = buildMeshSurfaceId(obj, meshIndex);
      obj.userData.__preview3dSurface = {
        id: surfaceId,
        label: obj.name || `Mesh ${meshIndex + 1}`,
        meshName: String(obj.name || ''),
        meshPath: buildMeshPath(obj),
        materialName: String(obj.material?.name || ''),
        hasUvs: !!(obj.geometry?.attributes?.uv?.count),
      };
      handlers.push(obj);
      index += 1;
    });
    return () => {
      handlers.forEach((obj) => {
        delete obj.userData.__preview3dSurface;
      });
    };
  }, [cloned, pickMode]);

  return (
    <primitive
      object={cloned}
      onClick={(event) => {
        if (!pickMode) return;
        event.stopPropagation();
        const mesh = event.object;
        if (!mesh?.isMesh) return;
        const meta = mesh.userData?.__preview3dSurface;
        if (meta) onSelectSurface?.(meta.id, 0, meta);
      }}
    />
  );
}

function CameraRig({
  viewPreset = 'front',
  geometryType = 'single_plane',
  textureCount = 1,
  layout,
  cameraConfig = null,
  modelBounds = null,
  resetNonce = 0,
}) {
  const { camera, controls, size: viewport } = useThree();
  useEffect(() => {
    // Keep projection aspect in sync so fit math matches the real canvas.
    if (viewport?.width && viewport?.height) {
      camera.aspect = viewport.width / Math.max(1, viewport.height);
      camera.updateProjectionMatrix();
    }

    const cols = geometryType === 'multi_grid'
      ? Math.max(1, normalizePreview3dLayout(layout).columns || Math.ceil(Math.sqrt(Math.max(1, textureCount))))
      : 1;

    const applyFit = () => {
      const hasBounds = modelBounds
        && Array.isArray(modelBounds.min)
        && Array.isArray(modelBounds.max)
        && Array.isArray(modelBounds.center);
      if (hasBounds) {
        const box = new THREE.Box3(
          new THREE.Vector3().fromArray(modelBounds.min),
          new THREE.Vector3().fromArray(modelBounds.max),
        );
        const sizeVec = box.getSize(new THREE.Vector3());
        const center = new THREE.Vector3().fromArray(modelBounds.center);
        // Slight downward look bias balances top/bottom margins on tall models in landscape canvases.
        if (viewPreset !== 'closeup' && viewPreset !== 'top' && viewPreset !== 'wall') {
          center.y -= sizeVec.y * 0.04;
        }
        // Admin minDistance is an OrbitControls zoom floor only — never push the
        // initial fit farther out (that made 5×7 frames look like postage stamps).
        const baseMargin = viewPreset === 'closeup'
          ? 1.06
          : viewPreset === 'front' || viewPreset === 'angled' || viewPreset === 'back' || viewPreset === 'rear'
            ? 1.05
            : viewPreset === 'wall'
              ? 1.12
              : 1.14;
        let dist = distanceToFitBounds(camera, box, viewPreset, baseMargin);
        if (viewPreset !== 'closeup' && viewPreset !== 'front' && viewPreset !== 'wall' && viewPreset !== 'angled') {
          dist *= 1.03;
        }

        if (viewPreset === 'side' || viewPreset === 'right') {
          camera.position.set(center.x + dist * 0.88, center.y, center.z + dist * 0.32);
        } else if (viewPreset === 'left') {
          camera.position.set(center.x - dist * 0.88, center.y, center.z + dist * 0.32);
        } else if (viewPreset === 'rear' || viewPreset === 'back') {
          camera.position.set(center.x, center.y, center.z - dist);
        } else if (viewPreset === 'top') {
          camera.position.set(center.x, center.y + dist, center.z + dist * 0.08);
        } else if (viewPreset === 'bottom') {
          camera.position.set(center.x, center.y - dist, center.z + dist * 0.08);
        } else if (viewPreset === 'closeup') {
          camera.position.set(center.x + dist * 0.08, center.y + dist * 0.02, center.z + dist);
        } else if (viewPreset === 'angled') {
          camera.position.set(center.x + dist * 0.38, center.y + dist * 0.06, center.z + dist * 0.95);
        } else if (viewPreset === 'wall') {
          // Room composition: frame large but clearly on a wall with floor/baseboard visible.
          const wallDist = dist;
          camera.position.set(center.x + wallDist * 0.1, center.y + sizeVec.y * 0.01, center.z + wallDist);
          camera.lookAt(center.x, center.y - sizeVec.y * 0.06, center.z - 0.05);
          if (controls) {
            const prevDamp = controls.enableDamping;
            controls.enableDamping = false;
            controls.target.set(center.x, center.y - sizeVec.y * 0.04, center.z - 0.04);
            controls.minDistance = Math.max(0.45, wallDist * 0.42);
            controls.maxDistance = Math.max(6, wallDist * 2.4);
            controls.update?.();
            controls.enableDamping = prevDamp;
          }
          if (typeof window !== 'undefined') {
            window.__preview3dCameraFit = {
              viewPreset,
              dist: wallDist,
              center: center.toArray(),
              cam: camera.position.toArray(),
              aspect: camera.aspect,
              fov: camera.fov,
              mode: 'wall_room_fit',
            };
          }
          return;
        } else {
          camera.position.set(center.x, center.y, center.z + dist);
        }
        camera.lookAt(center.x, center.y, center.z);
        // Apply after OrbitControls mounts — otherwise controls overwrite the fit.
        if (controls) {
          const prevDamp = controls.enableDamping;
          controls.enableDamping = false;
          controls.target.set(center.x, center.y, center.z);
          controls.minDistance = Math.max(0.42, dist * 0.72);
          controls.maxDistance = Math.max(Number(cameraConfig?.maxDistance) || 8, dist * 2.6);
          controls.update?.();
          controls.enableDamping = prevDamp;
        }
        if (typeof window !== 'undefined') {
          window.__preview3dCameraFit = {
            viewPreset,
            dist,
            center: center.toArray(),
            cam: camera.position.toArray(),
            aspect: camera.aspect,
            fov: camera.fov,
          };
        }
        return;
      }

      let gridSpan = geometryType === 'multi_grid'
        ? Math.max(3.6, cols * 1.35)
        : geometryType === 'cylinder'
          ? 3.6
          : geometryType === 'pendant'
            ? 1.95
            : 3.2;
      const lookY = cameraConfig?.targetY !== null
        && cameraConfig?.targetY !== undefined
        && cameraConfig?.targetY !== ''
        && Number.isFinite(Number(cameraConfig.targetY))
        ? Number(cameraConfig.targetY)
        : 0;
      if (viewPreset === 'side' || viewPreset === 'right') camera.position.set(gridSpan, lookY, 0.2);
      else if (viewPreset === 'left') camera.position.set(-gridSpan, lookY, 0.2);
      else if (viewPreset === 'rear' || viewPreset === 'back') camera.position.set(0, lookY + 0.04, -gridSpan);
      else if (viewPreset === 'top') camera.position.set(0, gridSpan + 0.1, 0.18);
      else if (viewPreset === 'bottom') camera.position.set(0, -(gridSpan + 0.1), 0.18);
      else if (viewPreset === 'closeup') camera.position.set(0.1, lookY + 0.02, Math.max(0.95, gridSpan * 0.52));
      else if (viewPreset === 'angled') camera.position.set(gridSpan * 0.45, lookY + 0.08, gridSpan * 0.95);
      else if (viewPreset === 'wall') camera.position.set(0.18, lookY + 0.04, Math.max(2.1, gridSpan * 1.05));
      else camera.position.set(0, lookY + 0.02, gridSpan);
      camera.lookAt(0, lookY, 0);
    };

    applyFit();
    // Re-apply on next frames so OrbitControls cannot leave a clipped framing.
    const raf1 = requestAnimationFrame(() => {
      applyFit();
      requestAnimationFrame(applyFit);
    });
    const t = setTimeout(applyFit, 50);
    return () => {
      cancelAnimationFrame(raf1);
      clearTimeout(t);
    };
  }, [camera, controls, viewPreset, geometryType, textureCount, layout, cameraConfig, modelBounds, viewport?.width, viewport?.height, resetNonce]);
  return null;
}

function SceneReadyPing({ onReady, waitForBounds = false, modelBounds = null }) {
  const { gl } = useThree();
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  const hasBounds = Boolean(modelBounds?.size || modelBounds?.center);
  useEffect(() => {
    markPreview3dTiming('webglReady');
    if (waitForBounds && !hasBounds) return undefined;
    let cancelled = false;
    const finish = () => {
      if (cancelled) return;
      onReadyRef.current?.({
        renderer: gl?.info?.render ? 'webgl' : 'unknown',
        at: Date.now(),
      });
      markPreview3dTiming('firstVisible');
      if (typeof window !== 'undefined' && Number.isFinite(Number(window.__preview3dOpenAt))) {
        window.__preview3dReadyMs = Math.round(performance.now() - Number(window.__preview3dOpenAt));
      }
    };
    // Let CameraRig + one presented frame land before dismissing the overlay.
    // Timeout fallback: headless/background tabs can stall rAF indefinitely.
    const raf = requestAnimationFrame(() => requestAnimationFrame(finish));
    const fallback = setTimeout(finish, 800);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [gl, waitForBounds, hasBounds]);
  return null;
}

/** After keep-alive pause (frameloop=never), force a few frames so reopen is not a blank buffer. */
function ResumeFrames({ active }) {
  const { invalidate } = useThree();
  useEffect(() => {
    if (!active) return undefined;
    invalidate();
    const a = requestAnimationFrame(() => {
      invalidate();
      requestAnimationFrame(() => invalidate());
    });
    const t = setTimeout(() => invalidate(), 50);
    return () => {
      cancelAnimationFrame(a);
      clearTimeout(t);
    };
  }, [active, invalidate]);
  return null;
}

function SceneContent({
  geometryType,
  modelUrl,
  textures,
  surfaces,
  layout,
  legacySequentialGlb,
  frameColor,
  accentColor,
  environment,
  autoRotate,
  focusedIndex,
  camera,
  selectedSurfaceId,
  pickMode,
  viewPreset,
  dimensions = null,
  photoFrameResolved = null,
  photoFrameHardware = null,
  photoFrameMaterial = null,
  photoFrameMoulding = 'stepped',
  attachProceduralHardware = false,
  includeProceduralBacking = false,
  presentationMode = 'inspect',
  hideMeshNamePrefixes = [],
  active = true,
  cameraResetNonce = 0,
  onMeshesInspected,
  onSelectSurface,
  onSceneReady,
}) {
  const [modelBounds, setModelBounds] = useState(null);
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const isWallPresentation = presentationMode === 'wall';
  const isPhotoFrameGeom = geometryType === 'custom_glb' || geometryType === 'photo_frame';
  // Wood/photo-frame GLBs look plastic under studio HDR and HDR is a cold-open cost.
  // Keep HDR for metal jewelry / tabletop only — never on wall rooms.
  const needsHdrAtmosphere = !isWallPresentation
    && !isPhotoFrameGeom
    && (environment === 'table' || environment === 'studio');
  const orbitTarget = modelBounds?.center || [0, 0, 0];
  const inspectMinDistance = isPhotoFrameGeom ? 0.28 : (Number(camera?.minDistance) || 0.5);
  const wallHidePrefixes = isWallPresentation
    ? [...new Set([...(hideMeshNamePrefixes || []), 'Stand'])]
    : (hideMeshNamePrefixes || []);
  const normalizedDims = normalizePreview3dDimensions(dimensions || {});
  const sceneSize = useMemo(
    () => dimensionsToSceneSize(normalizedDims, {
      maxSide: geometryType === 'pendant' ? 0.85 : geometryType === 'cylinder' ? 1.45 : 1.35,
    }),
    [normalizedDims.width, normalizedDims.height, normalizedDims.depth, normalizedDims.unit, geometryType],
  );
  const modelScale = normalizedDims.modelScale;

  return (
    <>
      <SceneReadyPing
        onReady={onSceneReady}
        waitForBounds={(geometryType === 'custom_glb' && !!modelUrl) || (geometryType === 'photo_frame' && !!photoFrameResolved)}
        modelBounds={modelBounds}
      />
      <ResumeFrames active={active !== false} />
      <CameraRig
        viewPreset={viewPreset}
        geometryType={geometryType}
        textureCount={Array.isArray(textures) ? textures.length : 1}
        layout={layout}
        cameraConfig={camera}
        modelBounds={modelBounds}
        resetNonce={cameraResetNonce}
      />
      <hemisphereLight args={isPhotoFrameGeom ? ['#f4ebe0', '#6a5a48', 0.48] : ['#e2e8f0', '#5a6068', 0.55]} />
      <ambientLight intensity={isPhotoFrameGeom ? 0.4 : 0.42} />
      <directionalLight
        position={[2.6, 4.4, 3.8]}
        intensity={isPhotoFrameGeom ? 1.08 : 1.05}
        castShadow
        color={isPhotoFrameGeom ? '#fff6ea' : '#ffffff'}
      />
      <directionalLight position={[-3.2, 1.8, 1.8]} intensity={isPhotoFrameGeom ? 0.48 : 0.32} color="#fff1e0" />
      {isPhotoFrameGeom ? (
        <>
          <directionalLight position={[0.15, 1.4, 3.6]} intensity={0.42} color="#fffaf4" />
          <directionalLight position={[0.2, 1.6, -3.4]} intensity={0.62} color="#e9ddd0" />
          <directionalLight position={[3.4, 0.5, 0.15]} intensity={0.28} color="#ffe8c8" />
        </>
      ) : null}
      {geometryType === 'multi_grid' ? (
        <MultiGridFrames
          textures={textures}
          surfaces={surfaces}
          layout={layout}
          frameColor={frameColor}
          accentColor={accentColor}
          focusedIndex={focusedIndex}
          onSelectSurface={onSelectSurface}
          sceneSize={sceneSize}
        />
      ) : geometryType === 'cylinder' ? (
        <CylinderWrap
          textures={textures}
          frameColor={frameColor}
          accentColor={accentColor}
          onSelectSurface={onSelectSurface}
          sceneSize={sceneSize}
        />
      ) : geometryType === 'pendant' ? (
        <PendantFace
          textures={textures}
          frameColor={frameColor}
          accentColor={accentColor}
          focusedIndex={focusedIndex}
          onSelectSurface={onSelectSurface}
          sceneSize={sceneSize}
        />
      ) : geometryType === 'photo_frame' && photoFrameResolved ? (
        (() => {
          const scene = photoFrameDimsToScene(photoFrameResolved, { wallRelative: isWallPresentation });
          const frame = (
            <PhotoFrameModel
              sceneOpening={scene.opening}
              sceneBorders={scene.borders}
              sceneDepth={scene.depth}
              sceneBacking={scene.backing}
              textureUrl={textures[0]?.textureUrl}
              placeholderUrl={textures[0]?.placeholderUrl}
              frameColor={frameColor}
              accentColor={accentColor}
              material={photoFrameMaterial || undefined}
              hardware={isWallPresentation ? { ...(photoFrameHardware || {}), stand: { enabled: false } } : (photoFrameHardware || {})}
              selected={focusedIndex === 0}
              onSelect={() => onSelectSurface?.(textures[0]?.surfaceId, 0)}
              mouldingProfile={photoFrameMoulding || scene.mouldingProfile || 'stepped'}
              onModelBounds={(payload) => setModelBounds(
                isWallPresentation ? offsetModelBounds(payload, WALL_PRESENTATION_OFFSET) : payload
              )}
            />
          );
          return isWallPresentation
            ? <group position={WALL_PRESENTATION_OFFSET}>{frame}</group>
            : frame;
        })()
      ) : geometryType === 'custom_glb' && modelUrl ? (
        <Preview3dErrorBoundary
          fallback={(
            <FramePlane
              position={[0, 0, 0]}
              size={planeSizeForAspect(textures[0]?.aspect, [1.2, 1.2], sceneSize)}
              depth={sceneSize.depth}
              textureUrl={textures[0]?.textureUrl}
              placeholderUrl={textures[0]?.placeholderUrl}
              frameColor={frameColor}
              accentColor={accentColor}
              selected={false}
              onSelect={() => onSelectSurface?.(textures[0]?.surfaceId, 0)}
            />
          )}
        >
          <Suspense fallback={null}>
            <CustomGlbGate
              url={modelUrl}
              textures={textures}
              surfaces={surfaces}
              legacySequentialGlb={legacySequentialGlb}
              accentColor={accentColor}
              selectedSurfaceId={selectedSurfaceId}
              pickMode={pickMode}
              modelScale={modelScale}
              hideMeshNamePrefixes={wallHidePrefixes}
              wallMount={isWallPresentation}
              onMeshesInspected={onMeshesInspected}
              onSelectSurface={onSelectSurface}
              onModelBounds={setModelBounds}
            />
            {attachProceduralHardware && photoFrameHardware && modelBounds && !isWallPresentation ? (
              <PhotoFrameHardwareOnBounds
                modelBounds={modelBounds}
                hardware={photoFrameHardware}
                includeBacking={includeProceduralBacking === true}
              />
            ) : null}
          </Suspense>
        </Preview3dErrorBoundary>
      ) : (
        <FramePlane
          position={isWallPresentation ? [0, 0.12, -0.06] : [0, 0, 0]}
          size={planeSizeForAspect(textures[0]?.aspect, [1.2, 1.2], sceneSize)}
          depth={sceneSize.depth}
          textureUrl={textures[0]?.textureUrl}
          placeholderUrl={textures[0]?.placeholderUrl}
          frameColor={frameColor}
          accentColor={accentColor}
          selected={textures.length > 1 && focusedIndex === 0}
          onSelect={() => onSelectSurface?.(textures[0]?.surfaceId, 0)}
        />
      )}
      <Suspense fallback={null}>
        <Preview3dAtmosphere
          environment={isWallPresentation ? 'wall' : environment}
          enableHdr={needsHdrAtmosphere}
          presentationMode={isWallPresentation ? 'wall' : 'inspect'}
          outerHint={modelBounds ? {
            liftY: 0.12,
            shadowY: Number(modelBounds.min?.[1]) || -0.62,
            wallZ: (Number(modelBounds.min?.[2]) || -0.07) - 0.006,
          } : null}
        />
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.12}
        rotateSpeed={0.82}
        target={orbitTarget}
        minDistance={inspectMinDistance}
        maxDistance={Math.max(Number(camera?.maxDistance) || 6, 8)}
        minPolarAngle={Math.PI * 0.08}
        maxPolarAngle={Math.PI * 0.92}
        autoRotate={autoRotate === true && !prefersReducedMotion && !isWallPresentation}
        autoRotateSpeed={0.7}
        enableRotate={!isWallPresentation}
      />
    </>
  );
}

export default function Preview3dScene(props) {
  const preserveDrawingBuffer = props.preserveDrawingBuffer === true;
  const [bootError, setBootError] = useState('');
  const modelFallbackNote = props.geometryType === 'custom_glb'
    ? 'The custom 3D model could not be loaded. Showing a simple preview instead — close anytime and continue shopping.'
    : '';
  const isWall = props.presentationMode === 'wall';
  const active = props.active !== false;
  return (
    <div
      data-preview3d-canvas={isWall ? 'wall' : 'inspect'}
      className={`relative h-full w-full min-h-[220px] touch-none ${isWall ? 'bg-[#b9aea0]' : 'bg-gradient-to-b from-[#f4f0e8] via-[#efe8dc] to-[#e4dccf]'}`}
    >
      {bootError ? (
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-gray-700">
          {bootError}
        </div>
      ) : (
        <Preview3dErrorBoundary
          onError={() => setBootError(modelFallbackNote || '3D preview failed to load. You can close this and continue shopping.')}
          fallback={(
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-gray-700">
              <p className="font-semibold text-gray-900">3D preview unavailable</p>
              <p>{modelFallbackNote || 'Close this viewer and continue with the normal product page and photo uploads.'}</p>
            </div>
          )}
        >
          <Canvas
            shadows
            dpr={(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)')?.matches) ? [1, 1.1] : [1, 1.25]}
            frameloop={active ? 'always' : 'never'}
            camera={{ position: [0, 0.06, 1.55], fov: 38, near: 0.05, far: 80 }}
            style={{ width: '100%', height: '100%', display: 'block' }}
            gl={{
              antialias: !(typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)')?.matches),
              alpha: true,
              powerPreference: 'high-performance',
              failIfMajorPerformanceCaveat: false,
              // Needed so Playwright/admin canvas screenshots capture the last presented frame.
              preserveDrawingBuffer: Boolean(preserveDrawingBuffer),
            }}
            onCreated={({ gl }) => {
              gl.outputColorSpace = THREE.SRGBColorSpace;
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.08;
            }}
            onError={() => setBootError('WebGL could not start on this device. You can close this and continue shopping.')}
          >
            <Suspense fallback={null}>
              <SceneContent {...props} />
            </Suspense>
          </Canvas>
        </Preview3dErrorBoundary>
      )}
    </div>
  );
}
