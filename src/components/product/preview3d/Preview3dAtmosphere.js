'use client';

/**
 * Optional HDRI / room atmosphere.
 * Kept in a separate module so studio/none configs avoid pulling Environment
 * into the critical first-open path when not needed.
 *
 * presentationMode:
 *  - inspect: soft studio / table contact shadows
 *  - wall: dedicated indoor wall room (non-AR "View on Wall")
 */
import { useEffect, useState } from 'react';
import { ContactShadows, Environment } from '@react-three/drei';

function WallRoom({ outerHint = null }) {
  // Wall sits just behind the seated frame (frame ~ z=-0.06).
  const wallW = 5.6;
  const wallH = 3.6;
  const wallZ = -0.14;
  const frameLift = Number.isFinite(Number(outerHint?.liftY)) ? Number(outerHint.liftY) : 0.12;
  const floorY = -wallH / 2 + 0.05 + frameLift * 0.1;

  return (
    <group name="WallRoom">
      <mesh position={[0, frameLift * 0.15, wallZ]} receiveShadow>
        <planeGeometry args={[wallW, wallH]} />
        <meshStandardMaterial color="#f3ebe0" roughness={0.97} metalness={0} />
      </mesh>
      {[-2.4, -0.85, 0.85, 2.4].map((x) => (
        <mesh key={`panel-${x}`} position={[x, frameLift * 0.15, wallZ + 0.003]} receiveShadow>
          <planeGeometry args={[0.04, wallH * 0.9]} />
          <meshStandardMaterial color="#e4d8c6" roughness={0.98} metalness={0} />
        </mesh>
      ))}
      <mesh position={[0, -wallH / 2 + 0.14 + frameLift * 0.1, wallZ + 0.03]} receiveShadow>
        <boxGeometry args={[wallW * 0.98, 0.18, 0.06]} />
        <meshStandardMaterial color="#7a6a52" roughness={0.9} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, floorY, 0.55]} receiveShadow>
        <planeGeometry args={[wallW * 1.2, 4.8]} />
        <meshStandardMaterial color="#8c7860" roughness={0.94} metalness={0} />
      </mesh>
      <mesh rotation={[0, Math.PI / 2, 0]} position={[-wallW / 2 + 0.02, frameLift * 0.15, wallZ + 1.15]} receiveShadow>
        <planeGeometry args={[2.5, wallH]} />
        <meshStandardMaterial color="#eee4d6" roughness={0.96} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[wallW / 2 - 0.02, frameLift * 0.15, wallZ + 1.15]} receiveShadow>
        <planeGeometry args={[2.5, wallH]} />
        <meshStandardMaterial color="#eee4d6" roughness={0.96} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, wallH / 2 - 0.06 + frameLift * 0.1, wallZ + 0.85]}>
        <planeGeometry args={[wallW, 2.1]} />
        <meshStandardMaterial color="#f7f2ea" roughness={1} />
      </mesh>
      <ContactShadows
        position={[0, floorY + 0.01, 0.2]}
        opacity={0.22}
        scale={4.2}
        blur={2.8}
        far={3.4}
        frames={1}
      />
    </group>
  );
}

function DeferredEnvironment({ preset }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (!preset) return undefined;
    let cancelled = false;
    // Let the first product frame present before HDR fetch/parse blocks the GPU.
    const t = setTimeout(() => {
      if (!cancelled) {
        if (typeof window !== 'undefined' && typeof performance !== 'undefined') {
          const base = Number(window.__preview3dOpenAt) || performance.now();
          window.__preview3dTimings = window.__preview3dTimings || {};
          window.__preview3dTimings.hdrStart = Math.round(performance.now() - base);
        }
        setReady(true);
      }
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [preset]);
  if (!ready || !preset) return null;
  return <Environment preset={preset} />;
}

export default function Preview3dAtmosphere({
  environment = 'studio',
  enableHdr = false,
  presentationMode = 'inspect',
  outerHint = null,
}) {
  const isWall = presentationMode === 'wall' || environment === 'wall';
  const envPreset = isWall
    ? null
    : environment === 'table'
      ? (enableHdr ? 'apartment' : null)
      : environment === 'none'
        ? null
        : (enableHdr ? 'studio' : null);
  const inspectShadowY = Number.isFinite(Number(outerHint?.shadowY))
    ? Number(outerHint.shadowY) - 0.02
    : -1.05;

  return (
    <>
      {isWall ? (
        <WallRoom outerHint={outerHint} />
      ) : (
        <ContactShadows position={[0, inspectShadowY, 0]} opacity={0.28} scale={5.2} blur={2.2} frames={1} />
      )}
      {envPreset ? <DeferredEnvironment preset={envPreset} /> : null}
      {!isWall && environment === 'table' ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.16, 0]} receiveShadow>
          <circleGeometry args={[2.4, 48]} />
          <meshStandardMaterial color="#d8cfc0" roughness={0.9} />
        </mesh>
      ) : null}
    </>
  );
}
