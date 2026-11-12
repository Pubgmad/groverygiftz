'use client';

/**
 * DB-free performance bench for Universal 3D.
 * Enabled in development always. Production builds require server layout
 * unlock via PREVIEW3D_BENCH=1 (non-public). Client also checks
 * NEXT_PUBLIC_PREVIEW3D_BENCH for UX copy only — not a security boundary.
 * Query-string unlock removed — never publicly exposable via ?bench=1.
 * Uses synthetic textures — never customer or production data.
 */
import { useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { createAdminSampleTextureDataUrl } from '@/lib/preview3dCropTexture';

const Preview3dScene = dynamic(() => import('@/components/product/preview3d/Preview3dScene'), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-sm">Loading scene chunk…</div>,
});

const PILOTS = [
  { id: 'frame', label: 'Pilot A — Wall frame', geometryType: 'single_plane', environment: 'studio' },
  { id: 'cylinder', label: 'Pilot B — Cylinder', geometryType: 'cylinder', environment: 'studio' },
  { id: 'pendant', label: 'Pilot C — Pendant', geometryType: 'pendant', environment: 'studio' },
  {
    id: 'combo',
    label: 'Multi-frame wall grid',
    geometryType: 'multi_grid',
    environment: 'wall',
    layout: { mode: 'wall_grid', columns: 5, gap: 0.14, cellScale: 0.82, positions: [] },
    slots: 10,
  },
];

export default function Preview3dBenchPage() {
  const [allowed, setAllowed] = useState(false);
  const [pilotId, setPilotId] = useState('frame');
  const [open, setOpen] = useState(false);
  const [marks, setMarks] = useState([]);
  const [sceneReadyAt, setSceneReadyAt] = useState(0);

  useEffect(() => {
    const ok = process.env.NODE_ENV !== 'production'
      || process.env.NEXT_PUBLIC_PREVIEW3D_BENCH === '1';
    setAllowed(ok);
  }, []);

  const pilot = PILOTS.find((p) => p.id === pilotId) || PILOTS[0];
  const slotCount = pilot.slots || 1;

  const textures = useMemo(() => {
    if (typeof document === 'undefined') return [];
    return Array.from({ length: slotCount }, (_, index) => ({
      slotKey: `bench:${index}`,
      areaLabel: slotCount > 1 ? `Frame ${index + 1}` : 'Front',
      index,
      surfaceId: `face_${index + 1}`,
      textureUrl: createAdminSampleTextureDataUrl(`P${index + 1}`, 24 + index * 18),
      isPlaceholder: false,
      placeholderUrl: '',
      aspect: { width: 8, height: 10 },
    }));
  }, [slotCount, open, pilotId]);

  const startOpen = () => {
    setSceneReadyAt(0);
    const started = performance.now();
    performance.mark('bench-open-start');
    setMarks((prev) => [...prev, { event: 'open_click', t: 0 }]);
    setOpen(true);
    import('@/components/product/preview3d/Preview3dScene').then(() => {
      const ms = Math.round(performance.now() - started);
      setMarks((prev) => [...prev, { event: 'chunk_evaluated', t: ms }]);
    });
  };

  if (!allowed) {
    return (
      <main className="mx-auto max-w-lg p-8 text-sm text-gray-700">
        <h1 className="text-xl font-bold">3D bench disabled</h1>
        <p className="mt-2">Production unlock requires PREVIEW3D_BENCH=1 on the server process. Query-string unlock is disabled.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-4 p-4 sm:p-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900">Phase 2A · 3D performance bench</h1>
        <p className="mt-1 text-sm text-gray-600">
          Isolated synthetic pilots — no database writes, no customer images.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {PILOTS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => { setPilotId(p.id); setOpen(false); }}
            className={`rounded-xl border px-3 py-2 text-xs font-semibold ${pilotId === p.id ? 'border-primary-500 bg-primary-50' : 'bg-white'}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={startOpen} className="rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white">
          Open cold View in 3D
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border px-4 py-2.5 text-sm font-semibold">
          Close
        </button>
      </div>

      <pre className="overflow-auto rounded-xl border bg-gray-50 p-3 text-[11px] text-gray-700">
        {JSON.stringify({ pilot: pilotId, marks, sceneReadyAt }, null, 2)}
      </pre>

      {open ? (
        <div className="h-[70vh] overflow-hidden rounded-2xl border bg-[#f4f0e8]">
          <Preview3dScene
            geometryType={pilot.geometryType}
            modelUrl=""
            textures={textures}
            surfaces={textures.map((t) => ({ id: t.surfaceId, label: t.areaLabel, kind: 'plane', hasUvs: true }))}
            layout={pilot.layout || { mode: 'auto_grid', columns: 0, gap: 0.16, cellScale: 0.9, positions: [] }}
            frameColor="#c4a574"
            accentColor="#8b7355"
            environment={pilot.environment}
            autoRotate={false}
            focusedIndex={0}
            camera={{ minDistance: 1.2, maxDistance: 6, autoRotate: false }}
            viewPreset="front"
            onSceneReady={() => {
              const ms = marks[0] ? Math.round(performance.now() - (performance.getEntriesByName('bench-open-start')[0]?.startTime || performance.now())) : 0;
              setSceneReadyAt(ms || Math.round(performance.now()));
              setMarks((prev) => [...prev, { event: 'scene_ready', t: ms }]);
            }}
          />
        </div>
      ) : null}
    </main>
  );
}
