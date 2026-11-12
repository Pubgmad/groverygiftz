'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import {
  normalizePreview3dConfig,
  buildSurfacesForGeometry,
  resolvePreview3dDimensions,
} from '@/lib/preview3d';
import { createAdminSampleTextureDataUrl } from '@/lib/preview3dCropTexture';
import { diffSavedSurfaces } from '@/lib/preview3dGlb';

const Preview3dScene = dynamic(
  () => import('@/components/product/preview3d/Preview3dScene'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center text-sm text-gray-600">
        Loading admin 3D preview…
      </div>
    ),
  },
);

/**
 * Live admin 3D configuration stage.
 * Uses labeled sample textures — never customer photos.
 * Opening/editing never enables product.preview3d.
 */
export default function AdminPreview3dStage({
  value,
  slotCount = 1,
  onChangeSurfaces,
  onSelectSurface,
  selectedSurfaceId = '',
  className = '',
}) {
  const config = normalizePreview3dConfig(value || {});
  const resolvedDimensions = useMemo(
    () => resolvePreview3dDimensions({ config }),
    [config],
  );
  const [viewPreset, setViewPreset] = useState('front');
  const [autoRotate, setAutoRotate] = useState(false);
  const [inspectedMeshes, setInspectedMeshes] = useState([]);
  const [compatWarnings, setCompatWarnings] = useState([]);
  const [sceneError, setSceneError] = useState('');
  const [resetKey, setResetKey] = useState(0);

  const sampleUrls = useMemo(() => {
    if (typeof document === 'undefined') return [];
    const count = Math.max(1, Number(slotCount) || 1, config.surfaces?.length || 0);
    return Array.from({ length: count }, (_, index) => (
      createAdminSampleTextureDataUrl(`SAMPLE ${index + 1}`, 20 + index * 28)
    ));
  }, [slotCount, config.surfaces?.length]);

  const surfaces = useMemo(
    () => buildSurfacesForGeometry(config.geometryType, slotCount, config.surfaces),
    [config.geometryType, config.surfaces, slotCount],
  );

  const textures = useMemo(() => {
    const count = Math.max(surfaces.length || 1, Number(slotCount) || 1);
    return Array.from({ length: count }, (_, index) => {
      const surface = surfaces[index] || { id: `face_${index + 1}`, label: `Surface ${index + 1}` };
      return {
        slotKey: `admin:${index}`,
        areaLabel: surface.label || `Sample ${index + 1}`,
        index,
        surfaceId: surface.id,
        meshName: surface.meshName || '',
        meshPath: surface.meshPath || '',
        materialName: surface.materialName || '',
        textureUrl: sampleUrls[index] || sampleUrls[0] || '',
        textureSource: 'admin_sample',
        isPlaceholder: false,
        placeholderUrl: config.placeholderUrl || '',
        aspect: { width: 1, height: 1 },
      };
    });
  }, [surfaces, slotCount, sampleUrls, config.placeholderUrl]);

  useEffect(() => {
    if (!inspectedMeshes.length || config.geometryType !== 'custom_glb') {
      setCompatWarnings([]);
      return;
    }
    const diff = diffSavedSurfaces(config.surfaces || [], inspectedMeshes);
    setCompatWarnings(diff.warnings || []);
  }, [inspectedMeshes, config.surfaces, config.geometryType]);

  const handleMeshesInspected = useCallback((meshes) => {
    setInspectedMeshes(meshes || []);
  }, []);

  const handleSelectSurface = useCallback((surfaceId, _index, meta) => {
    onSelectSurface?.(surfaceId, meta);
  }, [onSelectSurface]);

  const importInspectedAsSurfaces = () => {
    if (!inspectedMeshes.length) return;
    onChangeSurfaces?.(inspectedMeshes.map((mesh) => ({
      id: mesh.id,
      label: mesh.label,
      kind: 'plane',
      meshName: mesh.meshName,
      meshPath: mesh.meshPath,
      materialName: mesh.materialName,
      hasUvs: mesh.hasUvs !== false,
      uvWarning: mesh.uvWarning || '',
    })));
  };

  const toggleSurfaceFromInspected = (mesh) => {
    const current = Array.isArray(config.surfaces) ? [...config.surfaces] : [];
    const exists = current.find((s) => s.id === mesh.id || (mesh.meshName && s.meshName === mesh.meshName));
    if (exists) {
      onChangeSurfaces?.(current.filter((s) => s.id !== exists.id));
      return;
    }
    onChangeSurfaces?.([
      ...current,
      {
        id: mesh.id,
        label: mesh.label,
        kind: 'plane',
        meshName: mesh.meshName,
        meshPath: mesh.meshPath,
        materialName: mesh.materialName,
        hasUvs: mesh.hasUvs !== false,
        uvWarning: mesh.uvWarning || '',
      },
    ]);
  };

  const canShowGlb = config.geometryType === 'custom_glb' && !!config.modelUrl;
  const canShowProcedural = config.geometryType !== 'custom_glb';

  return (
    <div className={`overflow-hidden rounded-2xl border bg-white ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
        <div>
          <p className="text-sm font-bold text-gray-900">Live 3D preview</p>
          <p className="text-[11px] text-gray-500">
            Sample textures only · does not enable customer 3D · rotate / zoom to inspect
          </p>
        </div>
        <div className="flex flex-wrap gap-1">
          {['front', 'back', 'left', 'right', 'top', 'bottom'].map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setViewPreset(preset)}
              className={`min-h-[36px] rounded-lg border px-2.5 text-[11px] font-semibold capitalize ${viewPreset === preset ? 'border-primary-500 bg-primary-50 text-primary-800' : 'bg-white'}`}
            >
              {preset}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className="min-h-[36px] rounded-lg border px-2.5 text-[11px] font-semibold"
          >
            {autoRotate ? 'Stop spin' : 'Spin'}
          </button>
          <button
            type="button"
            onClick={() => setResetKey((k) => k + 1)}
            className="min-h-[36px] rounded-lg border px-2.5 text-[11px] font-semibold"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_240px]">
        <div className="relative h-[280px] sm:h-[360px]">
          {sceneError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-4 text-center text-sm text-gray-700">
              <p className="font-semibold">3D preview unavailable</p>
              <p className="text-xs text-gray-500">{sceneError}</p>
            </div>
          ) : !canShowProcedural && !canShowGlb ? (
            <div className="flex h-full items-center justify-center px-4 text-center text-sm text-gray-600">
              Upload a GLB model to preview custom geometry, or choose a procedural type.
            </div>
          ) : (
            <div className="h-full w-full" onErrorCapture={() => setSceneError('WebGL failed to start in this browser.')}>
              <Preview3dScene
                key={`${resetKey}:${config.geometryType}:${config.modelUrl}:${config.dimensions?.width}x${config.dimensions?.height}`}
                geometryType={config.geometryType}
                modelUrl={config.modelUrl}
                textures={textures}
                surfaces={surfaces}
                layout={config.layout}
                legacySequentialGlb={false}
                frameColor={config.frameColor}
                accentColor={config.accentColor}
                environment={config.environment}
                autoRotate={autoRotate}
                focusedIndex={0}
                camera={config.camera}
                viewPreset={viewPreset}
                dimensions={resolvedDimensions}
                selectedSurfaceId={selectedSurfaceId}
                pickMode={config.geometryType === 'custom_glb'}
                onMeshesInspected={handleMeshesInspected}
                onSelectSurface={handleSelectSurface}
              />
            </div>
          )}
        </div>

        <aside className="max-h-[360px] overflow-y-auto border-t bg-gray-50 p-3 lg:border-l lg:border-t-0">
          {config.geometryType === 'custom_glb' ? (
            <>
              <p className="text-xs font-bold text-gray-900">GLB meshes</p>
              <p className="mt-1 text-[11px] text-gray-500">
                Click a mesh in the viewer or toggle below to mark customizable photo surfaces.
              </p>
              {compatWarnings.length ? (
                <ul className="mt-2 list-disc pl-4 text-[11px] text-amber-800">
                  {compatWarnings.map((w) => <li key={w}>{w}</li>)}
                </ul>
              ) : null}
              <button
                type="button"
                onClick={importInspectedAsSurfaces}
                disabled={!inspectedMeshes.length}
                className="mt-2 min-h-[36px] w-full rounded-lg border bg-white px-2 text-[11px] font-semibold disabled:opacity-50"
              >
                Use all inspected meshes as surfaces
              </button>
              <div className="mt-2 space-y-1">
                {!inspectedMeshes.length ? (
                  <p className="text-[11px] text-gray-500">Waiting for model inspection…</p>
                ) : inspectedMeshes.map((mesh) => {
                  const selected = (config.surfaces || []).some(
                    (s) => s.id === mesh.id || (mesh.meshName && s.meshName === mesh.meshName),
                  );
                  return (
                    <button
                      key={mesh.id}
                      type="button"
                      onClick={() => toggleSurfaceFromInspected(mesh)}
                      className={`w-full rounded-lg border px-2 py-2 text-left text-[11px] ${selected ? 'border-primary-500 bg-primary-50' : 'bg-white'}`}
                    >
                      <span className="block font-semibold text-gray-900">{mesh.label}</span>
                      <span className="block text-gray-500">{mesh.meshName || mesh.meshPath || mesh.id}</span>
                      {!mesh.hasUvs ? (
                        <span className="mt-1 block text-amber-700">No UVs — photos may not map</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs font-bold text-gray-900">Procedural surfaces</p>
              <ul className="mt-2 space-y-1 text-[11px] text-gray-600">
                {surfaces.map((surface) => (
                  <li key={surface.id} className="rounded-lg border bg-white px-2 py-1.5">
                    <span className="font-semibold text-gray-900">{surface.label}</span>
                    <span className="ml-1 text-gray-400">({surface.id})</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
