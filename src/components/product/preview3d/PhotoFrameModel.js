'use client';

/**
 * Procedural photo-frame body + configurable backside hardware.
 * Opening size drives PhotoPlane; borders from Admin-resolved dims.
 * Hardware millimetre sizes are APPROXIMATE from references — not tape-verified CAD.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import SafePhotoMaterial from './SafePhotoMaterial';

function TexturedOrColor({ url, color, roughness = 0.7, metalness = 0.05 }) {
  if (!url) {
    return <meshStandardMaterial color={color} roughness={roughness} metalness={metalness} />;
  }
  return <SafePhotoMaterial url={url} color={color} roughness={roughness} metalness={metalness} />;
}

/** Black plastic-ish keyhole hanger bracket (visual approx). */
function HookBracket({ position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 }) {
  return (
    <group position={position} rotation={rotation} scale={scale}>
      <mesh castShadow receiveShadow position={[0, 0, 0.008]}>
        <boxGeometry args={[0.09, 0.055, 0.012]} />
        <meshStandardMaterial color="#111111" roughness={0.55} metalness={0.15} />
      </mesh>
      {/* keyhole plate */}
      <mesh position={[0, 0.012, 0.016]}>
        <boxGeometry args={[0.035, 0.028, 0.006]} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.018, 0.02]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.004, 12]} />
        <meshStandardMaterial color="#222" roughness={0.4} metalness={0.3} />
      </mesh>
    </group>
  );
}

/** Fold-out easel stand — real extruded geometry, not a flat image. */
function RearStand({ position = [0, 0, 0], length = 0.42, deployed = false }) {
  const tilt = deployed ? 0.55 : 0.08;
  return (
    <group position={position}>
      <group rotation={[tilt, 0, 0]} position={[0, 0, -0.012]}>
        <mesh castShadow receiveShadow position={[0, -length / 2, -0.02]}>
          <boxGeometry args={[0.07, length, 0.014]} />
          <meshStandardMaterial color="#101010" roughness={0.6} metalness={0.12} />
        </mesh>
        <mesh position={[0, 0.01, -0.018]}>
          <boxGeometry args={[0.085, 0.04, 0.02]} />
          <meshStandardMaterial color="#0d0d0d" roughness={0.55} metalness={0.18} />
        </mesh>
        <mesh position={[0, -length * 0.78, -0.028]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.012, 0.012, 0.004, 16]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.1} />
        </mesh>
      </group>
    </group>
  );
}

/** Wall spacer bush — physical cylinder, not a texture stamp. */
function Bush({ position = [0, 0, 0], radius = 0.028 }) {
  return (
    <mesh castShadow receiveShadow position={position} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[radius, radius * 0.92, 0.016, 20]} />
      <meshStandardMaterial color="#0f0f0f" roughness={0.65} metalness={0.1} />
    </mesh>
  );
}

/**
 * Reusable backside hardware only — used by procedural frames and optional custom_glb attach.
 * Placement is relative to a local panel size; millimetre sizes remain APPROXIMATE.
 */
export function PhotoFrameHardwareAttach({
  panelW = 1,
  panelH = 1.2,
  hardware = {},
  includeBacking = false,
  backingThickness = 0.018,
  uniformScale = 1,
}) {
  const hw = {
    stand: hardware.stand?.enabled,
    centerHook: hardware.centerHook?.enabled,
    leftHook: hardware.leftHook?.enabled,
    rightHook: hardware.rightHook?.enabled,
    leftBush: hardware.leftBush?.enabled,
    rightBush: hardware.rightBush?.enabled,
    backingPanel: includeBacking && hardware.backingPanel?.enabled !== false,
  };
  const hookY = panelH * 0.38;
  const bushY = -panelH * 0.36;
  const sideX = panelW * 0.34;
  const standLen = Math.min(0.55, panelH * 0.58);
  const partScale = Math.max(0.55, Math.min(1.6, uniformScale));

  return (
    <group>
      {hw.backingPanel ? (
        <mesh castShadow receiveShadow position={[0, 0, 0]} name="BackingPanel">
          <boxGeometry args={[panelW, panelH, backingThickness]} />
          <meshStandardMaterial color="#d2c09a" roughness={0.92} metalness={0.02} />
        </mesh>
      ) : null}
      <group position={[0, 0, hw.backingPanel ? -(backingThickness * 0.5 + 0.01) : -0.01]}>
        {hw.centerHook ? <HookBracket position={[0, hookY, 0]} scale={1.15 * partScale} /> : null}
        {hw.leftHook ? <HookBracket position={[-sideX, hookY, 0]} scale={1.15 * partScale} /> : null}
        {hw.rightHook ? <HookBracket position={[sideX, hookY, 0]} scale={1.15 * partScale} /> : null}
        {hw.leftBush ? <Bush position={[-sideX, bushY, 0.01]} radius={0.032 * partScale} /> : null}
        {hw.rightBush ? <Bush position={[sideX, bushY, 0.01]} radius={0.032 * partScale} /> : null}
        {hw.stand ? (
          <RearStand
            position={[0, hw.centerHook ? hookY * 0.05 : panelH * 0.05, 0]}
            length={standLen}
            deployed
          />
        ) : null}
      </group>
    </group>
  );
}

/**
 * Bounds-based attach for custom_glb: place hardware on the rear face (-Z of AABB).
 * Does not invent absolute millimetres — proportions follow loaded model bounds.
 */
export function PhotoFrameHardwareOnBounds({
  modelBounds = null,
  hardware = {},
  includeBacking = false,
}) {
  if (!modelBounds?.min || !modelBounds?.max || !modelBounds?.center) return null;
  const min = modelBounds.min;
  const max = modelBounds.max;
  const center = modelBounds.center;
  const panelW = Math.max(0.08, (max[0] - min[0]) * 0.82);
  const panelH = Math.max(0.08, (max[1] - min[1]) * 0.82);
  const depth = Math.max(0.02, max[2] - min[2]);
  const uniformScale = Math.max(panelW, panelH) / 1.1;
  // Sit just behind the rear face of the GLB AABB (more negative Z).
  const z = min[2] - Math.max(0.008, depth * 0.02);
  return (
    <group position={[center[0], center[1], z]}>
      <PhotoFrameHardwareAttach
        panelW={panelW}
        panelH={panelH}
        hardware={hardware}
        includeBacking={includeBacking}
        backingThickness={Math.max(0.01, depth * 0.08)}
        uniformScale={uniformScale}
      />
    </group>
  );
}

function makeFrameShape(outerW, outerH, holeW, holeH) {
  const shape = new THREE.Shape();
  const hx = outerW / 2;
  const hy = outerH / 2;
  shape.moveTo(-hx, -hy);
  shape.lineTo(hx, -hy);
  shape.lineTo(hx, hy);
  shape.lineTo(-hx, hy);
  shape.closePath();
  const hole = new THREE.Path();
  const ix = holeW / 2;
  const iy = holeH / 2;
  hole.moveTo(-ix, -iy);
  hole.lineTo(-ix, iy);
  hole.lineTo(ix, iy);
  hole.lineTo(ix, -iy);
  hole.closePath();
  if (holeW > 0.002 && holeH > 0.002 && holeW < outerW - 0.002 && holeH < outerH - 0.002) {
    shape.holes.push(hole);
  }
  return shape;
}

function FrameMaterial({ color, roughness, metalness }) {
  return (
    <meshStandardMaterial
      color={color}
      roughness={roughness}
      metalness={metalness}
      envMapIntensity={0.42}
    />
  );
}

function ExtrudedRing({
  outerW,
  outerH,
  holeW,
  holeH,
  depth,
  z = 0,
  color,
  roughness,
  metalness,
  bevel = false,
}) {
  const geometry = useMemo(() => {
    if (!(outerW > 0) || !(outerH > 0) || !(depth > 0)) return null;
    const shape = makeFrameShape(outerW, outerH, holeW, holeH);
    const bevelSize = bevel ? Math.min(outerW - holeW, outerH - holeH) * 0.08 : 0;
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: bevel && bevelSize > 0.001,
      bevelThickness: bevel ? Math.min(depth * 0.14, 0.012) : 0,
      bevelSize,
      bevelSegments: bevel ? 2 : 1,
      curveSegments: 1,
    });
    geo.translate(0, 0, -depth);
    return geo;
  }, [outerW, outerH, holeW, holeH, depth, bevel]);

  useLayoutEffect(() => () => geometry?.dispose?.(), [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} position={[0, 0, z]} castShadow receiveShadow>
      <FrameMaterial color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
}

/**
 * Continuous extruded moulding (mitered corners from a single holed profile).
 * Stepped/beveled profiles are still schematic — not carved botanical relief.
 */
function ParametricMoulding({
  ow,
  oh,
  bl,
  br,
  bt,
  bb,
  depth,
  color,
  roughness,
  metalness,
  profile = 'stepped',
}) {
  const outerW = ow + bl + br;
  const outerH = oh + bt + bb;
  const step = Math.min(bl, br, bt, bb) * (profile === 'beveled' ? 0.42 : 0.3);
  const stepDepth = Math.max(0.006, depth * (profile === 'beveled' ? 0.36 : 0.24));

  return (
    <group>
      <ExtrudedRing
        outerW={outerW}
        outerH={outerH}
        holeW={ow}
        holeH={oh}
        depth={depth}
        z={0}
        color={color}
        roughness={roughness}
        metalness={metalness}
        bevel={profile === 'beveled'}
      />
      {profile === 'flat' ? null : (
        <ExtrudedRing
          outerW={ow + step * 2}
          outerH={oh + step * 2}
          holeW={ow}
          holeH={oh}
          depth={stepDepth}
          z={stepDepth * 0.15}
          color={color}
          roughness={Math.min(1, roughness + 0.05)}
          metalness={metalness}
          bevel={profile === 'beveled'}
        />
      )}
    </group>
  );
}

/**
 * Full procedural photo frame (body + photo + optional hardware).
 */
export default function PhotoFrameModel({
  sceneOpening = [1, 1.2],
  sceneBorders = { left: 0.08, right: 0.08, top: 0.08, bottom: 0.08 },
  sceneDepth = 0.06,
  sceneBacking = 0.018,
  textureUrl = '',
  placeholderUrl = '',
  frameColor = '#1a1a1a',
  accentColor = '#2a2a2a',
  material = { roughness: 0.72, metalness: 0.08 },
  hardware = {},
  selected = false,
  onSelect,
  mouldingProfile = 'stepped',
  onModelBounds,
}) {
  const [ow, oh] = sceneOpening;
  const bl = Math.max(0.01, sceneBorders.left || 0.08);
  const br = Math.max(0.01, sceneBorders.right || 0.08);
  const bt = Math.max(0.01, sceneBorders.top || 0.08);
  const bb = Math.max(0.01, sceneBorders.bottom || 0.08);
  const outerW = ow + bl + br;
  const outerH = oh + bt + bb;
  const depth = Math.max(0.02, sceneDepth);
  const lip = Math.min(bl, br, bt, bb) * 0.18;
  // ExtrudedRing translates the moulding by -depth, so the body occupies [−depth, 0].
  const mouldingBackFace = -depth;
  const backingCenterZ = mouldingBackFace - sceneBacking / 2;
  const panelW = outerW * 0.92;
  const panelH = outerH * 0.92;
  const roughness = material?.roughness ?? 0.72;
  const metalness = material?.metalness ?? 0.08;
  const profile = ['stepped', 'beveled', 'flat'].includes(mouldingProfile) ? mouldingProfile : 'stepped';
  const groupRef = useRef(null);

  useLayoutEffect(() => {
    const group = groupRef.current;
    if (!group) return undefined;
    const box = new THREE.Box3().setFromObject(group);
    if (box.isEmpty()) return undefined;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const payload = {
      min: [box.min.x, box.min.y, box.min.z],
      max: [box.max.x, box.max.y, box.max.z],
      center: [center.x, center.y, center.z],
      size: [size.x, size.y, size.z],
    };
    if (typeof window !== 'undefined') window.__preview3dModelBounds = payload;
    onModelBounds?.(payload);
    return undefined;
  }, [outerW, outerH, depth, sceneBacking, backingCenterZ, textureUrl, placeholderUrl, onModelBounds]);

  return (
    <group
      ref={groupRef}
      onClick={(event) => {
        event.stopPropagation();
        onSelect?.();
      }}
    >
      <ParametricMoulding
        ow={ow}
        oh={oh}
        bl={bl}
        br={br}
        bt={bt}
        bb={bb}
        depth={depth}
        color={frameColor}
        roughness={roughness}
        metalness={metalness}
        profile={profile}
      />

      <ExtrudedRing
        outerW={ow + lip * 2}
        outerH={oh + lip * 2}
        holeW={ow}
        holeH={oh}
        depth={Math.max(0.005, depth * 0.08)}
        z={0}
        color="#f3efe6"
        roughness={0.92}
        metalness={0.02}
      />

      <mesh key={`photo-${textureUrl || placeholderUrl || 'empty'}`} position={[0, 0, -Math.min(0.004, depth * 0.04)]} castShadow name="PhotoPlane">
        <planeGeometry args={[ow * 0.995, oh * 0.995]} />
        <TexturedOrColor
          url={textureUrl || placeholderUrl}
          color={accentColor}
          roughness={0.62}
          metalness={0.03}
        />
      </mesh>

      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[ow, oh]} />
        <meshStandardMaterial
          color="#e8f2fb"
          transparent
          opacity={0.11}
          roughness={0.08}
          metalness={0.12}
          envMapIntensity={0.8}
        />
      </mesh>

      <group position={[0, 0, backingCenterZ]}>
        <PhotoFrameHardwareAttach
          panelW={panelW}
          panelH={panelH}
          hardware={hardware}
          includeBacking={hardware.backingPanel?.enabled !== false}
          backingThickness={sceneBacking}
          uniformScale={Math.max(panelW, panelH) / 1.1}
        />
      </group>

      {selected ? (
        <mesh position={[0, 0, 0.04]}>
          <boxGeometry args={[outerW + 0.04, outerH + 0.04, 0.01]} />
          <meshBasicMaterial color="#c45c26" transparent opacity={0.22} />
        </mesh>
      ) : null}
    </group>
  );
}

/** Convert resolved inch dims to scene units. Inspect fits the canvas; wall keeps relative physical scale. */
export function photoFrameDimsToScene(resolved, { maxSide = 1.35, wallRelative = false } = {}) {
  const unit = resolved.unit || 'inch';
  const toInch = unit === 'mm' ? 0.0393701 : unit === 'cm' ? 0.393701 : 1;
  const owIn = Math.max(0.05, Number(resolved.openingWidth) || 1) * toInch;
  const ohIn = Math.max(0.05, Number(resolved.openingHeight) || 1) * toInch;
  const blIn = Math.max(0, Number(resolved.borderLeft) || 0) * toInch;
  const brIn = Math.max(0, Number(resolved.borderRight) || 0) * toInch;
  const btIn = Math.max(0, Number(resolved.borderTop) || 0) * toInch;
  const bbIn = Math.max(0, Number(resolved.borderBottom) || 0) * toInch;
  const depthIn = Math.max(0.08, Number(resolved.depth) || 0.35) * toInch;
  const backingIn = Math.max(0.04, Number(resolved.rearBackingThickness) || 0.12) * toInch;
  // Wall: 1 inch ≈ 0.042 scene units so 5×7 stays smaller than 24×36 on the same room.
  // Inspect: normalize longest outer side to maxSide so every size fits the viewport.
  const outerMax = Math.max(owIn + blIn + brIn, ohIn + btIn + bbIn, 0.01);
  const scale = wallRelative ? 0.042 : (maxSide / outerMax);
  return {
    opening: [owIn * scale, ohIn * scale],
    borders: {
      left: Math.max(0.008, blIn * scale),
      right: Math.max(0.008, brIn * scale),
      top: Math.max(0.008, btIn * scale),
      bottom: Math.max(0.008, bbIn * scale),
    },
    depth: Math.max(0.012, depthIn * scale),
    backing: Math.max(0.006, backingIn * scale),
    mouldingProfile: resolved.mouldingProfileKey || 'stepped',
    scale,
    wallRelative: wallRelative === true,
  };
}
