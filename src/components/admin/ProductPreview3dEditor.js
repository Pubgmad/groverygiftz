'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import toast from 'react-hot-toast';
import {
  PREVIEW3D_APPEARANCES,
  PREVIEW3D_DIMENSION_UNITS,
  PREVIEW3D_ENVIRONMENTS,
  PREVIEW3D_GEOMETRY_TYPES,
  PREVIEW3D_LAYOUT_MODES,
  PREVIEW3D_RETAIL_STATUSES,
  buildSurfacesForGeometry,
  emptyPreview3dConfig,
  emptyPreview3dDimensions,
  getPreview3dRetailGate,
  listCustomizationSlotDescriptors,
  listVariantOverrideOptions,
  normalizePreview3dConfig,
  normalizePreview3dDimensions,
  normalizePreview3dLayout,
  normalizeVariantOverrides,
  validateSurfaceMappings,
  validateVariantOverrides,
} from '@/lib/preview3d';
import { emptyPhotoFrameConfig } from '@/lib/photoFrame3d';
import PhotoFrameAdminFields from '@/components/admin/preview3d/PhotoFrameAdminFields';

const AdminPreview3dStage = dynamic(
  () => import('@/components/admin/preview3d/AdminPreview3dStage'),
  { ssr: false, loading: () => <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">Loading 3D preview…</div> },
);

/**
 * Optional 3D Visualization section for product create/edit.
 * Does not affect pricing, stock, uploads, or checkout.
 */
export default function ProductPreview3dEditor({
  productLike,
  value,
  onChange,
  writable = true,
  suspendPreview = false,
}) {
  const config = normalizePreview3dConfig(value || emptyPreview3dConfig());
  const [profiles, setProfiles] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedSurfaceId, setSelectedSurfaceId] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showLivePreview, setShowLivePreview] = useState(false);

  const slots = useMemo(() => listCustomizationSlotDescriptors(productLike || {}), [productLike]);
  const variantOptions = useMemo(() => listVariantOverrideOptions(productLike || {}), [productLike]);
  const surfaces = useMemo(
    () => buildSurfacesForGeometry(config.geometryType, slots.length, config.surfaces),
    [config.geometryType, config.surfaces, slots.length],
  );
  const validation = useMemo(
    () => validateSurfaceMappings(productLike || {}, config),
    [productLike, config],
  );
  const variantValidation = useMemo(
    () => validateVariantOverrides(productLike || {}, config.variantOverrides || []),
    [productLike, config.variantOverrides],
  );
  const retailGate = useMemo(() => getPreview3dRetailGate(config), [config]);
  const dimensions = normalizePreview3dDimensions(config.dimensions || {});

  const loadAssets = useCallback(() => {
    setLoadingAssets(true);
    return fetch('/api/admin/preview-3d-assets', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { assets: [] }))
      .then((d) => setAssets(Array.isArray(d.assets) ? d.assets : []))
      .catch(() => setAssets([]))
      .finally(() => setLoadingAssets(false));
  }, []);

  useEffect(() => {
    if (!config.enabled || !showAdvanced) return undefined;
    let cancelled = false;
    setLoadingProfiles(true);
    fetch('/api/admin/preview-3d-profiles', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { profiles: [] }))
      .then((d) => {
        if (!cancelled) setProfiles((d.profiles || []).filter((p) => p.isActive !== false));
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingProfiles(false);
      });
    loadAssets();
    return () => { cancelled = true; };
  }, [config.enabled, showAdvanced, loadAssets]);

  const setField = (patch) => onChange(normalizePreview3dConfig({ ...config, ...patch }));

  const applyProfile = (profileId) => {
    const profile = profiles.find((p) => String(p._id) === String(profileId));
    if (!profile) {
      setField({ profileId: '' });
      return;
    }
    const nextSurfaces = Array.isArray(profile.surfaces) && profile.surfaces.length
      ? profile.surfaces
      : buildSurfacesForGeometry(profile.geometryType, slots.length);
    const autoMappings = slots.map((slot, index) => ({
      slotKey: slot.slotKey,
      areaLabel: slot.areaLabel,
      surfaceId: nextSurfaces[index]?.id || nextSurfaces[0]?.id || `face_${index + 1}`,
    }));
    // Product-specific retail readiness is preserved unless profile carries an explicit value
    // and product is still at default prototype with no prior enable.
    setField({
      profileId: String(profile._id),
      assetId: profile.assetId ? String(profile.assetId) : config.assetId,
      geometryType: profile.geometryType,
      modelUrl: profile.modelUrl || '',
      placeholderUrl: profile.placeholderUrl || '',
      environment: profile.environment || 'studio',
      frameColor: profile.frameColor || config.frameColor,
      accentColor: profile.accentColor || config.accentColor,
      camera: profile.camera || config.camera,
      dimensions: normalizePreview3dDimensions(profile.dimensions || config.dimensions || {}),
      layout: normalizePreview3dLayout(profile.layout || config.layout),
      surfaces: nextSurfaces,
      surfaceMappings: autoMappings,
      legacySequentialGlb: false,
      retailReadiness: profile.retailReadiness || config.retailReadiness || 'prototype',
    });
  };

  const setDimensions = (patch) => {
    setField({
      dimensions: normalizePreview3dDimensions({
        ...(config.dimensions || emptyPreview3dDimensions()),
        ...patch,
      }),
    });
  };

  const upsertVariantOverride = (optionKey, patch) => {
    const option = variantOptions.find((row) => row.key === optionKey);
    if (!option) return;
    const existing = normalizeVariantOverrides(config.variantOverrides || []);
    const index = existing.findIndex((row) => row.key === optionKey);
    const base = index >= 0
      ? existing[index]
      : {
        key: option.key,
        variantName: option.variantName,
        optionLabel: option.optionLabel,
        enabled: true,
        geometryType: '',
        modelUrl: '',
        assetId: '',
        profileId: '',
        frameColor: '',
        accentColor: '',
        dimensions: emptyPreview3dDimensions(),
      };
    const nextRow = {
      ...base,
      ...patch,
      key: option.key,
      variantName: option.variantName,
      optionLabel: option.optionLabel,
      dimensions: normalizePreview3dDimensions({
        ...(base.dimensions || {}),
        ...(patch.dimensions || {}),
      }),
    };
    const next = [...existing];
    if (index >= 0) next[index] = nextRow;
    else next.push(nextRow);
    setField({ variantOverrides: normalizeVariantOverrides(next) });
  };

  const removeVariantOverride = (optionKey) => {
    setField({
      variantOverrides: normalizeVariantOverrides(config.variantOverrides || [])
        .filter((row) => row.key !== optionKey),
    });
  };

  const applyAsset = (assetUrl) => {
    const asset = assets.find((row) => row.url === assetUrl);
    if (!asset) {
      setField({ modelUrl: '', assetId: '' });
      return;
    }
    if (!asset.isAccessible) {
      toast.error('That GLB file is missing from storage and cannot be selected');
      return;
    }
    const hints = Array.isArray(asset.surfaceHints) && asset.surfaceHints.length
      ? asset.surfaceHints
      : config.surfaces;
    const nextSurfaces = hints.length
      ? hints
      : buildSurfacesForGeometry('custom_glb', slots.length, []);
    const autoMappings = slots.map((slot, index) => ({
      slotKey: slot.slotKey,
      areaLabel: slot.areaLabel,
      surfaceId: nextSurfaces[index]?.id || nextSurfaces[0]?.id || `face_${index + 1}`,
    }));
    setField({
      assetId: asset._id || '',
      modelUrl: asset.url,
      geometryType: 'custom_glb',
      surfaces: nextSurfaces,
      surfaceMappings: autoMappings,
      // Selecting never auto-approves retail. Approved library assets still require product-level confirm.
      retailReadiness: asset.retailReadiness === 'approved_retail'
        ? 'awaiting_approval'
        : (asset.retailReadiness || 'prototype'),
      legacySequentialGlb: false,
    });
    toast.success(`Selected reusable model: ${asset.name}`);
  };

  const updateSelectedAssetReadiness = async (nextStatus) => {
    if (!writable || !config.modelUrl) {
      toast.error('Select a reusable GLB before changing asset approval');
      return;
    }
    const selected = assets.find((row) => row.url === config.modelUrl && row.kind !== 'placeholder');
    if (selected && selected.isAccessible === false) {
      toast.error('Cannot approve a missing GLB file');
      return;
    }
    try {
      const res = await fetch('/api/admin/preview-3d-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: config.modelUrl,
          assetId: config.assetId || selected?._id || '',
          retailReadiness: nextStatus,
          name: selected?.name || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to update asset approval');
      await loadAssets();
      if (data.asset?._id) {
        setField({ assetId: String(data.asset._id) });
      }
      toast.success(`Library asset marked ${nextStatus.replace(/_/g, ' ')}`);
    } catch (err) {
      toast.error(err.message || 'Asset approval update failed');
    }
  };

  const uploadAsset = async (file, kind) => {
    if (!file || !writable) return;
    if (kind === 'model') {
      const name = String(file.name || '').toLowerCase();
      if (!name.endsWith('.glb')) {
        toast.error('Please upload a .glb 3D model file.');
        return;
      }
      if (file.size > 25 * 1024 * 1024) {
        toast.error('3D model must be 25 MB or smaller.');
        return;
      }
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', kind);
      body.append('name', file.name || '');
      const res = await fetch('/api/admin/preview-3d-assets', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      if (kind === 'model') {
        setField({
          modelUrl: data.url,
          geometryType: 'custom_glb',
          assetId: data.asset?._id ? String(data.asset._id) : '',
          retailReadiness: 'prototype',
        });
        await loadAssets();
        toast.success('3D model uploaded as prototype (not retail-approved)');
      } else {
        setField({ placeholderUrl: data.url });
        toast.success('Placeholder uploaded');
      }
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const setMapping = (slotKey, surfaceId, areaLabel) => {
    const rest = (config.surfaceMappings || []).filter((row) => row.slotKey !== slotKey);
    const next = surfaceId
      ? [...rest, { slotKey, surfaceId, areaLabel: areaLabel || '' }]
      : rest;
    setField({ surfaceMappings: next });
  };

  const updateSurfaceMeta = (surfaceId, patch) => {
    const next = (config.surfaces || []).map((surface) => (
      surface.id === surfaceId ? { ...surface, ...patch } : surface
    ));
    setField({ surfaces: next });
  };

  const selectableAssets = assets.filter((asset) => asset.kind !== 'placeholder');

  return (
    <div className="space-y-4 rounded-2xl border border-primary-100 bg-primary-50/30 p-4">
      <div>
        <h3 className="text-lg font-bold text-gray-900">3D preview</h3>
        <p className="mt-1 text-sm text-gray-600">
          Optional visual reference. Customers can still customize and buy from the 2D editor without opening 3D.
        </p>
      </div>

      <label className="flex min-h-[44px] items-center gap-3 text-sm font-semibold">
        <input
          type="checkbox"
          disabled={!writable}
          checked={config.enabled === true}
          onChange={(e) => {
            const enabled = e.target.checked;
            if (!enabled) {
              setField({ enabled: false });
              return;
            }
            const alreadyConfigured = config.geometryType === 'custom_glb'
              || config.geometryType === 'photo_frame'
              || config.photoFrame?.enabled;
            setField({
              enabled: true,
              geometryType: alreadyConfigured ? config.geometryType : 'photo_frame',
              photoFrame: {
                ...(config.photoFrame || emptyPhotoFrameConfig()),
                enabled: true,
                designProfileKey: config.photoFrame?.designProfileKey || 'design_matte_black_procedural',
              },
            });
          }}
          className="h-5 w-5 accent-primary-600"
        />
        Enable 3D Preview
      </label>

      {!config.enabled ? (
        <p className="text-xs text-gray-500">3D is off. Customers will not see a View in 3D button.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <PhotoFrameAdminFields
            config={config}
            writable={writable}
            onChange={(patch) => setField(patch)}
          />

          {config.geometryType === 'custom_glb' ? (
            <label className="block text-sm font-semibold sm:col-span-2">
              Custom 3D model file
              <span className="mt-1 block text-xs font-normal text-gray-500">
                Upload a .glb only when this design needs its own decorative model. Do not stretch a 5×7 model onto other sizes.
              </span>
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input
                  disabled={!writable}
                  value={config.modelUrl || ''}
                  onChange={(e) => setField({ modelUrl: e.target.value, assetId: '', geometryType: 'custom_glb' })}
                  placeholder="Approved .glb file"
                  className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
                />
                <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border bg-white px-4 text-xs font-semibold">
                  {uploading ? 'Uploading…' : 'Upload GLB'}
                  <input
                    type="file"
                    accept=".glb,model/gltf-binary"
                    disabled={!writable || uploading}
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) uploadAsset(file, 'model');
                    }}
                  />
                </label>
              </div>
            </label>
          ) : null}

          <div className="sm:col-span-2">
            <button
              type="button"
              onClick={() => setShowLivePreview((v) => !v)}
              className="rounded-xl border bg-white px-3 py-2 text-xs font-semibold text-gray-800"
            >
              {showLivePreview ? 'Hide live preview' : 'Show live preview'}
            </button>
            {showLivePreview ? (
              <div className="mt-3">
                {suspendPreview ? (
                  <div className="flex h-[200px] items-center justify-center rounded-2xl border bg-white text-sm text-gray-600">
                    Live 3D preview paused while saving…
                  </div>
                ) : (
                  <AdminPreview3dStage
                    value={config}
                    slotCount={Math.max(1, slots.length || 1)}
                    selectedSurfaceId={selectedSurfaceId}
                    onChangeSurfaces={(nextSurfaces) => {
                      if (!writable) return;
                      const autoMappings = slots.map((slot, index) => ({
                        slotKey: slot.slotKey,
                        areaLabel: slot.areaLabel,
                        surfaceId: nextSurfaces[index]?.id || nextSurfaces[0]?.id || `face_${index + 1}`,
                      }));
                      setField({ surfaces: nextSurfaces, surfaceMappings: autoMappings, legacySequentialGlb: false });
                    }}
                    onSelectSurface={(surfaceId) => setSelectedSurfaceId(surfaceId || '')}
                  />
                )}
              </div>
            ) : null}
          </div>

          <details
            className="sm:col-span-2 rounded-xl border bg-white p-3"
            open={showAdvanced}
            onToggle={(e) => setShowAdvanced(e.currentTarget.open)}
          >
            <summary className="cursor-pointer text-sm font-semibold text-gray-800">Advanced 3D settings</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold sm:col-span-2">
            Reusable 3D profile
            <select
              disabled={!writable || loadingProfiles}
              value={config.profileId || ''}
              onChange={(e) => applyProfile(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
            >
              <option value="">Custom settings (no profile)</option>
              {profiles.map((p) => (
                <option key={p._id} value={p._id}>{p.name}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-gray-500">
              Manage reusable profiles under Admin → 3D Profiles.
            </span>
          </label>

          <label className="block text-sm font-semibold">
            Geometry / model type
            <select
              disabled={!writable}
              value={config.geometryType}
              onChange={(e) => {
                const geometryType = e.target.value;
                const nextSurfaces = buildSurfacesForGeometry(geometryType, slots.length, geometryType === 'custom_glb' ? config.surfaces : []);
                const autoMappings = slots.map((slot, index) => ({
                  slotKey: slot.slotKey,
                  areaLabel: slot.areaLabel,
                  surfaceId: nextSurfaces[index]?.id || nextSurfaces[0]?.id || `face_${index + 1}`,
                }));
                setField({ geometryType, surfaces: nextSurfaces, surfaceMappings: autoMappings, legacySequentialGlb: false });
              }}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
            >
              {PREVIEW3D_GEOMETRY_TYPES.map((g) => (
                <option key={g.id} value={g.id}>{g.label}</option>
              ))}
            </select>
          </label>

          <label className="block text-sm font-semibold">
            Retail readiness
            <select
              disabled={!writable}
              value={config.retailReadiness || 'prototype'}
              onChange={(e) => setField({ retailReadiness: e.target.value })}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
            >
              {PREVIEW3D_RETAIL_STATUSES.map((status) => (
                <option key={status.id} value={status.id}>{status.label}</option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-gray-500">
              {retailGate.customerVisible
                ? 'Customers will see View in 3D after you save this product.'
                : 'Turn on Enable 3D preview above to show View in 3D to customers.'}
            </span>
          </label>

          <label className="block text-sm font-semibold">
            Display environment
            <select
              disabled={!writable}
              value={config.environment}
              onChange={(e) => setField({ environment: e.target.value })}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
            >
              {PREVIEW3D_ENVIRONMENTS.map((env) => (
                <option key={env.id} value={env.id}>{env.label}</option>
              ))}
            </select>
          </label>

          {config.geometryType === 'multi_grid' ? (
            <>
              <label className="block text-sm font-semibold">
                Frame arrangement
                <select
                  disabled={!writable}
                  value={config.layout?.mode || 'auto_grid'}
                  onChange={(e) => setField({ layout: normalizePreview3dLayout({ ...config.layout, mode: e.target.value }) })}
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
                >
                  {PREVIEW3D_LAYOUT_MODES.map((mode) => (
                    <option key={mode.id} value={mode.id}>{mode.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold">
                Columns (0 = auto)
                <input
                  type="number"
                  min={0}
                  max={12}
                  disabled={!writable}
                  value={config.layout?.columns ?? 0}
                  onChange={(e) => setField({
                    layout: normalizePreview3dLayout({ ...config.layout, columns: Number(e.target.value) || 0 }),
                  })}
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
                />
              </label>
            </>
          ) : null}

          <label className="block text-sm font-semibold">
            Frame / body color
            <input
              type="color"
              disabled={!writable}
              value={config.frameColor || '#f5f0e8'}
              onChange={(e) => setField({ frameColor: e.target.value })}
              className="mt-1 h-11 w-full rounded-xl border bg-white px-2"
            />
          </label>
          <label className="block text-sm font-semibold">
            Accent color
            <input
              type="color"
              disabled={!writable}
              value={config.accentColor || '#8b7355'}
              onChange={(e) => setField({ accentColor: e.target.value })}
              className="mt-1 h-11 w-full rounded-xl border bg-white px-2"
            />
          </label>

          <label className="block text-sm font-semibold sm:col-span-2">
            Reuse existing approved / uploaded GLB
            <select
              disabled={!writable || loadingAssets}
              value={config.modelUrl || ''}
              onChange={(e) => applyAsset(e.target.value)}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
            >
              <option value="">Select a reusable model…</option>
              {selectableAssets.map((asset) => (
                <option
                  key={asset.url}
                  value={asset.url}
                  disabled={!asset.isAccessible}
                >
                  {asset.name}
                  {asset.isAccessible ? '' : ' (missing file)'}
                  {' · '}
                  {asset.retailReadiness || 'prototype'}
                  {asset.surfaceHints?.length ? ` · ${asset.surfaceHints.length} surfaces` : ''}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] font-normal text-gray-500">
              Reuses storage files without re-upload. Missing files cannot be selected. Retail approval is never automatic.
            </span>
          </label>

          {config.modelUrl ? (
            <label className="block text-sm font-semibold sm:col-span-2">
              Library asset approval (shared across products)
              <select
                disabled={!writable || loadingAssets}
                value={selectableAssets.find((row) => row.url === config.modelUrl)?.retailReadiness || 'prototype'}
                onChange={(e) => updateSelectedAssetReadiness(e.target.value)}
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
              >
                {PREVIEW3D_RETAIL_STATUSES.map((status) => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
              <span className="mt-1 block text-[11px] font-normal text-gray-500">
                Separate from this product&apos;s retail readiness. Upload success never auto-approves.
              </span>
            </label>
          ) : null}

          <label className="block text-sm font-semibold sm:col-span-2">
            Custom GLB model URL {config.geometryType === 'custom_glb' ? '*' : '(optional)'}
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                disabled={!writable}
                value={config.modelUrl || ''}
                onChange={(e) => setField({ modelUrl: e.target.value, assetId: '' })}
                placeholder="/media/preview3d/models/...."
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
              />
              <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border bg-white px-4 text-xs font-semibold">
                {uploading ? 'Uploading…' : 'Upload GLB'}
                <input
                  type="file"
                  accept=".glb,model/gltf-binary"
                  disabled={!writable || uploading}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) uploadAsset(file, 'model');
                  }}
                />
              </label>
            </div>
          </label>

          <label className="block text-sm font-semibold sm:col-span-2">
            Placeholder image (empty slots)
            <div className="mt-1 flex flex-col gap-2 sm:flex-row">
              <input
                disabled={!writable}
                value={config.placeholderUrl || ''}
                onChange={(e) => setField({ placeholderUrl: e.target.value })}
                placeholder="Optional image URL"
                className="w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
              />
              <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center rounded-xl border bg-white px-4 text-xs font-semibold">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  disabled={!writable || uploading}
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) uploadAsset(file, 'placeholder');
                  }}
                />
              </label>
            </div>
          </label>

          <div className="sm:col-span-2 rounded-xl border bg-white p-3 space-y-3">
            <div>
              <p className="text-sm font-bold text-gray-900">Physical dimensions (procedural templates)</p>
              <p className="mt-1 text-[11px] text-gray-500">
                Explicit Admin values win. Otherwise variant preview sizes or customization area sizes are reused.
                Never inferred from product titles. GLB native scale is kept unless Model scale is set.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block text-xs font-semibold">
                Width
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!writable}
                  value={dimensions.width ?? ''}
                  onChange={(e) => setDimensions({ width: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Auto"
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-semibold">
                Height
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!writable}
                  value={dimensions.height ?? ''}
                  onChange={(e) => setDimensions({ height: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Auto"
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-semibold">
                Depth
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  disabled={!writable}
                  value={dimensions.depth ?? ''}
                  onChange={(e) => setDimensions({ depth: e.target.value === '' ? null : Number(e.target.value) })}
                  placeholder="Auto"
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
                />
              </label>
              <label className="block text-xs font-semibold">
                Unit
                <select
                  disabled={!writable}
                  value={dimensions.unit || 'inch'}
                  onChange={(e) => setDimensions({ unit: e.target.value })}
                  className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
                >
                  {PREVIEW3D_DIMENSION_UNITS.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-xs font-semibold max-w-xs">
              Model scale (custom GLB only, optional)
              <input
                type="number"
                min={0.05}
                max={10}
                step="0.01"
                disabled={!writable}
                value={dimensions.modelScale ?? ''}
                onChange={(e) => setDimensions({ modelScale: e.target.value === '' ? null : Number(e.target.value) })}
                placeholder="Native GLB scale"
                className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
          </div>

          {variantOptions.length ? (
            <div className="sm:col-span-2 rounded-xl border bg-white p-3 space-y-3">
              <div>
                <p className="text-sm font-bold text-gray-900">Variant-specific 3D (optional)</p>
                <p className="mt-1 text-[11px] text-gray-500">
                  Only needed when a variant changes size, shape, or approved GLB. Keys use stable variantName::optionLabel.
                  Pricing, stock, and cart logic are unchanged.
                </p>
              </div>
              {!variantValidation.ok ? (
                <ul className="list-disc pl-4 text-[11px] text-amber-800">
                  {variantValidation.errors.map((err) => <li key={err}>{err}</li>)}
                </ul>
              ) : null}
              <div className="space-y-2">
                {variantOptions.map((option) => {
                  const override = (config.variantOverrides || []).find((row) => row.key === option.key);
                  const active = !!override;
                  return (
                    <div key={option.key} className="rounded-lg border bg-gray-50 p-2 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs font-semibold text-gray-800">
                          {option.variantName}: {option.optionLabel}
                          {option.previewWidth > 0 && option.previewHeight > 0
                            ? ` · preview ${option.previewWidth}×${option.previewHeight} ${option.previewUnit || 'inch'}`
                            : ''}
                        </p>
                        <label className="inline-flex items-center gap-2 text-[11px] font-semibold">
                          <input
                            type="checkbox"
                            disabled={!writable}
                            checked={active}
                            onChange={(e) => {
                              if (e.target.checked) {
                                upsertVariantOverride(option.key, {
                                  dimensions: option.previewWidth > 0 && option.previewHeight > 0
                                    ? {
                                      width: option.previewWidth,
                                      height: option.previewHeight,
                                      unit: option.previewUnit || 'inch',
                                      depth: null,
                                      modelScale: null,
                                    }
                                    : emptyPreview3dDimensions(),
                                });
                              } else {
                                removeVariantOverride(option.key);
                              }
                            }}
                          />
                          Override 3D
                        </label>
                      </div>
                      {active ? (
                        <div className="grid gap-2 sm:grid-cols-3">
                          <label className="block text-[11px] font-semibold">
                            Geometry
                            <select
                              disabled={!writable}
                              value={override.geometryType || ''}
                              onChange={(e) => upsertVariantOverride(option.key, { geometryType: e.target.value })}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
                            >
                              <option value="">Same as product</option>
                              {PREVIEW3D_GEOMETRY_TYPES.map((g) => (
                                <option key={g.id} value={g.id}>{g.label}</option>
                              ))}
                            </select>
                          </label>
                          <label className="block text-[11px] font-semibold sm:col-span-2">
                            Alternate GLB URL
                            <input
                              disabled={!writable}
                              value={override.modelUrl || ''}
                              onChange={(e) => upsertVariantOverride(option.key, { modelUrl: e.target.value, assetId: '' })}
                              placeholder="Leave blank to keep product model"
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
                            />
                          </label>
                          <label className="block text-[11px] font-semibold">
                            Width
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              disabled={!writable}
                              value={override.dimensions?.width ?? ''}
                              onChange={(e) => upsertVariantOverride(option.key, {
                                dimensions: { width: e.target.value === '' ? null : Number(e.target.value) },
                              })}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
                            />
                          </label>
                          <label className="block text-[11px] font-semibold">
                            Height
                            <input
                              type="number"
                              min={0}
                              step="0.01"
                              disabled={!writable}
                              value={override.dimensions?.height ?? ''}
                              onChange={(e) => upsertVariantOverride(option.key, {
                                dimensions: { height: e.target.value === '' ? null : Number(e.target.value) },
                              })}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
                            />
                          </label>
                          <label className="block text-[11px] font-semibold">
                            Unit
                            <select
                              disabled={!writable}
                              value={override.dimensions?.unit || 'inch'}
                              onChange={(e) => upsertVariantOverride(option.key, {
                                dimensions: { unit: e.target.value },
                              })}
                              className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
                            >
                              {PREVIEW3D_DIMENSION_UNITS.map((unit) => (
                                <option key={unit.id} value={unit.id}>{unit.label}</option>
                              ))}
                            </select>
                          </label>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              disabled={!writable}
              checked={config.camera?.autoRotate === true}
              onChange={(e) => setField({ camera: { ...config.camera, autoRotate: e.target.checked } })}
            />
            Auto-rotate when idle
          </label>

          <label className="block text-sm font-semibold">
            Camera look-at Y (optional)
            <input
              type="number"
              step="0.01"
              disabled={!writable}
              value={config.camera?.targetY === null || config.camera?.targetY === undefined ? '' : config.camera.targetY}
              onChange={(e) => setField({
                camera: {
                  ...config.camera,
                  targetY: e.target.value === '' ? null : Number(e.target.value),
                },
              })}
              placeholder="Auto (model center)"
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
            />
          </label>

          {config.geometryType === 'custom_glb' ? (
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input
                type="checkbox"
                disabled={!writable}
                checked={config.legacySequentialGlb === true}
                onChange={(e) => setField({ legacySequentialGlb: e.target.checked })}
              />
              Legacy sequential mesh mapping (Phase 1 compatibility — avoid for new products)
            </label>
          ) : null}

          {(config.surfaces || []).length ? (
            <div className="sm:col-span-2 space-y-2 rounded-xl border bg-white p-3">
              <p className="text-sm font-bold text-gray-900">Surface appearance</p>
              <p className="text-[11px] text-gray-500">
                Persisted per surface. Metal engraving uses contain-fit; mark approximate when rear/hidden geometry is incomplete.
              </p>
              {(config.surfaces || []).map((surface) => (
                <div key={surface.id} className="grid gap-2 rounded-lg border bg-gray-50 p-2 sm:grid-cols-[1fr_1fr_auto]">
                  <p className="text-xs font-semibold text-gray-800">
                    {surface.label || surface.id}
                    <span className="ml-1 font-normal text-gray-400">({surface.meshName || surface.id})</span>
                  </p>
                  <select
                    disabled={!writable}
                    value={surface.preview3dAppearance || ''}
                    onChange={(e) => updateSurfaceMeta(surface.id, { preview3dAppearance: e.target.value })}
                    className="rounded-lg border bg-white px-2 py-2 text-xs"
                  >
                    {PREVIEW3D_APPEARANCES.map((row) => (
                      <option key={row.id || 'standard'} value={row.id}>{row.label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-2 text-[11px] font-semibold">
                    <input
                      type="checkbox"
                      disabled={!writable}
                      checked={surface.approximateGeometry === true}
                      onChange={(e) => updateSurfaceMeta(surface.id, { approximateGeometry: e.target.checked })}
                    />
                    Approximate
                  </label>
                </div>
              ))}
            </div>
          ) : null}

          <div className="sm:col-span-2 space-y-2 rounded-xl border bg-white p-3">
            <p className="text-sm font-bold text-gray-900">Photo slot → 3D surface mapping</p>
            <p className="text-[11px] text-gray-500">
              Uses existing customization areas/slots as the source of truth. Slot keys are index-stable (`area:index:N`) so duplicate labels cannot silently collide. Legacy `area:Label` mappings still resolve.
            </p>
            {slots.some((slot) => slot.labelCollision) ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Duplicate area labels detected. 3D will not guess by label — confirm each index maps to the correct surface before enabling.
              </p>
            ) : null}
            {!slots.length ? (
              <p className="text-xs text-amber-800">
                Configure Customization Preview areas (or image counts) first so slots are available to map.
              </p>
            ) : (
              <div className="space-y-2">
                {slots.map((slot) => {
                  const current = (config.surfaceMappings || []).find(
                    (row) => row.slotKey === slot.slotKey || (slot.legacySlotKey && row.slotKey === slot.legacySlotKey),
                  );
                  return (
                    <label key={slot.slotKey} className="grid gap-1 text-xs font-semibold sm:grid-cols-[1fr_1fr]">
                      <span className={`rounded-lg px-2 py-2 ${slot.labelCollision ? 'bg-amber-50 text-amber-950' : 'bg-gray-50'}`}>
                        {slot.areaLabel}
                        <span className="font-normal text-gray-400"> ({slot.slotKey})</span>
                        {slot.labelCollision ? (
                          <span className="mt-1 block font-normal text-amber-800">Duplicate label — mapped by index, not name</span>
                        ) : null}
                      </span>
                      <select
                        disabled={!writable}
                        value={current?.surfaceId || ''}
                        onChange={(e) => {
                          setMapping(slot.slotKey, e.target.value, slot.areaLabel);
                          setSelectedSurfaceId(e.target.value || '');
                        }}
                        className="rounded-lg border bg-white px-2 py-2 font-normal"
                      >
                        <option value="">Auto / default</option>
                        {surfaces.map((surface) => (
                          <option key={surface.id} value={surface.id}>
                            {surface.label} ({surface.meshName || surface.id})
                            {surface.hasUvs === false ? ' · no UVs' : ''}
                          </option>
                        ))}
                      </select>
                    </label>
                  );
                })}
              </div>
            )}
            {!validation.ok ? (
              <ul className="list-disc pl-4 text-[11px] text-red-700">
                {validation.errors.map((err) => <li key={err}>{err}</li>)}
              </ul>
            ) : (
              <p className="text-[11px] text-green-700">Mappings look valid for the current geometry.</p>
            )}
            {(validation.warnings || []).length ? (
              <ul className="list-disc pl-4 text-[11px] text-amber-800">
                {validation.warnings.map((warn) => <li key={warn}>{warn}</li>)}
              </ul>
            ) : null}
          </div>

          <label className="block text-sm font-semibold sm:col-span-2">
            Internal notes
            <textarea
              disabled={!writable}
              value={config.notes || ''}
              onChange={(e) => setField({ notes: e.target.value })}
              rows={2}
              className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
              placeholder="Optional admin note"
            />
          </label>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}
