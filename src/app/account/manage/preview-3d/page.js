'use client';

import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { FiBox, FiPlus, FiTrash2 } from 'react-icons/fi';
import useAdminAccess from '@/hooks/useAdminAccess';
import ReadOnlyBanner from '@/components/admin/ReadOnlyBanner';
import {
  PREVIEW3D_DIMENSION_UNITS,
  PREVIEW3D_ENVIRONMENTS,
  PREVIEW3D_GEOMETRY_TYPES,
  PREVIEW3D_RETAIL_STATUSES,
  buildSurfacesForGeometry,
  emptyPreview3dDimensions,
  normalizePreview3dConfig,
  normalizePreview3dDimensions,
} from '@/lib/preview3d';

const AdminPreview3dStage = dynamic(
  () => import('@/components/admin/preview3d/AdminPreview3dStage'),
  { ssr: false, loading: () => <div className="rounded-2xl border bg-white p-6 text-sm text-gray-500">Loading 3D preview…</div> },
);

const emptyForm = () => ({
  name: '',
  description: '',
  isActive: true,
  geometryType: 'single_plane',
  modelUrl: '',
  placeholderUrl: '',
  assetId: '',
  retailReadiness: 'prototype',
  environment: 'studio',
  frameColor: '#f5f0e8',
  accentColor: '#8b7355',
  camera: { minDistance: 1.2, maxDistance: 6, autoRotate: false, targetY: null },
  dimensions: emptyPreview3dDimensions(),
  surfaces: buildSurfacesForGeometry('single_plane', 1),
  slotHint: 4,
});

export default function AdminPreview3dProfilesPage() {
  const { canRead, canWrite, accessStatus } = useAdminAccess();
  const readable = canRead('products');
  const writable = canWrite('products');
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedId, setSelectedId] = useState('new');
  const [selectedSurfaceId, setSelectedSurfaceId] = useState('');
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const [profileRes, assetRes] = await Promise.all([
      fetch('/api/admin/preview-3d-profiles', { cache: 'no-store' }),
      fetch('/api/admin/preview-3d-assets', { cache: 'no-store' }),
    ]);
    const data = await profileRes.json().catch(() => ({}));
    const assetData = await assetRes.json().catch(() => ({}));
    if (!profileRes.ok) {
      toast.error(data.error || 'Unable to load 3D profiles');
      setLoading(false);
      return;
    }
    setProfiles(data.profiles || []);
    setAssets(Array.isArray(assetData.assets) ? assetData.assets : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!readable) return;
    load();
  }, [readable, load]);

  useEffect(() => {
    if (selectedId === 'new') {
      setForm(emptyForm());
      return;
    }
    const profile = profiles.find((p) => String(p._id) === String(selectedId));
    if (!profile) return;
    const normalized = normalizePreview3dConfig(profile);
    setForm({
      name: profile.name || '',
      description: profile.description || '',
      isActive: profile.isActive !== false,
      geometryType: normalized.geometryType,
      modelUrl: normalized.modelUrl,
      placeholderUrl: normalized.placeholderUrl,
      assetId: normalized.assetId || '',
      retailReadiness: normalized.retailReadiness || 'prototype',
      environment: normalized.environment,
      frameColor: normalized.frameColor,
      accentColor: normalized.accentColor,
      camera: normalized.camera,
      dimensions: normalizePreview3dDimensions(normalized.dimensions || {}),
      surfaces: Array.isArray(profile.surfaces) && profile.surfaces.length
        ? profile.surfaces
        : buildSurfacesForGeometry(normalized.geometryType, 1),
      slotHint: Math.max(1, profile.surfaces?.length || 4),
    });
  }, [selectedId, profiles]);

  if (accessStatus === 'loading') return <p className="p-6 text-center text-gray-500">Loading…</p>;
  if (!readable) return <p className="p-6 text-center text-gray-500">You do not have access to products / 3D profiles.</p>;

  const save = async (event) => {
    event.preventDefault();
    if (!writable || saving) return;
    setSaving(true);
    const payload = {
      ...form,
      surfaces: form.geometryType === 'multi_grid'
        ? buildSurfacesForGeometry('multi_grid', Number(form.slotHint) || 4)
        : form.surfaces,
    };
    const isNew = selectedId === 'new';
    const res = await fetch(isNew ? '/api/admin/preview-3d-profiles' : `/api/admin/preview-3d-profiles/${selectedId}`, {
      method: isNew ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Unable to save profile');
      return;
    }
    toast.success(isNew ? '3D profile created' : '3D profile updated');
    await load();
    if (data.profile?._id) setSelectedId(data.profile._id);
  };

  const remove = async () => {
    if (!writable || selectedId === 'new') return;
    if (!window.confirm('Delete this reusable 3D profile? Products using it keep their saved settings.')) return;
    const res = await fetch(`/api/admin/preview-3d-profiles/${selectedId}`, { method: 'DELETE' });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error || 'Unable to delete');
      return;
    }
    toast.success('Profile deleted');
    setSelectedId('new');
    await load();
  };

  const uploadGlb = async (file) => {
    if (!file || !writable) return;
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      body.append('kind', 'model');
      const res = await fetch('/api/admin/preview-3d-assets', { method: 'POST', body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      setForm((p) => ({
        ...p,
        modelUrl: data.url,
        geometryType: 'custom_glb',
        assetId: data.asset?._id ? String(data.asset._id) : '',
        retailReadiness: 'prototype',
        surfaces: [],
      }));
      await load();
      toast.success('GLB uploaded as prototype — not retail-approved');
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const updateLibraryAssetReadiness = async (nextStatus) => {
    if (!writable || !form.modelUrl) {
      toast.error('Select a GLB before changing library approval');
      return;
    }
    const selected = assets.find((row) => row.url === form.modelUrl);
    if (selected && selected.isAccessible === false) {
      toast.error('Cannot approve a missing GLB file');
      return;
    }
    try {
      const res = await fetch('/api/admin/preview-3d-assets', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: form.modelUrl,
          assetId: form.assetId || selected?._id || '',
          retailReadiness: nextStatus,
          name: selected?.name || form.name || '',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Unable to update asset approval');
      if (data.asset?._id) {
        setForm((p) => ({ ...p, assetId: String(data.asset._id) }));
      }
      await load();
      toast.success(`Library asset marked ${String(nextStatus).replace(/_/g, ' ')}`);
    } catch (err) {
      toast.error(err.message || 'Asset approval update failed');
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-2xl font-bold"><FiBox className="text-primary-600" /> 3D Profiles</h1>
        <p className="mt-2 text-sm text-gray-500">
          Reusable geometries and GLB setups for the optional Universal 3D viewer. Assign a profile on each product when ready — existing catalog stays unchanged by default.
        </p>
        <Link
          href="/account/manage/photo-frame-3d"
          className="mt-3 inline-flex min-h-[40px] items-center rounded-xl border bg-white px-3 py-2 text-sm font-semibold text-primary-800"
        >
          Open Photo Frame 3D catalog
        </Link>
      </div>
      {!writable ? <ReadOnlyBanner /> : null}

      <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="rounded-2xl border bg-white p-3">
          <button
            type="button"
            onClick={() => setSelectedId('new')}
            className={`flex min-h-[44px] w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-semibold ${selectedId === 'new' ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}
          >
            <FiPlus /> New profile
          </button>
          <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
            {loading ? <p className="px-2 text-xs text-gray-500">Loading…</p> : null}
            {profiles.map((profile) => (
              <button
                key={profile._id}
                type="button"
                onClick={() => setSelectedId(profile._id)}
                className={`w-full rounded-xl px-3 py-2.5 text-left text-sm ${selectedId === profile._id ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50'}`}
              >
                <span className="block truncate font-semibold">{profile.name}</span>
                <span className="text-[11px] text-gray-500">{profile.geometryType} · {profile.isActive === false ? 'Inactive' : 'Active'}</span>
              </button>
            ))}
          </div>
        </aside>

        <form onSubmit={save} className="space-y-4 rounded-2xl border bg-white p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-xl font-bold">{selectedId === 'new' ? 'Create 3D profile' : 'Edit 3D profile'}</h2>
            {selectedId !== 'new' && writable ? (
              <button type="button" onClick={remove} className="inline-flex min-h-[40px] items-center gap-1 rounded-xl border border-red-200 px-3 text-sm font-semibold text-red-600">
                <FiTrash2 /> Delete
              </button>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm font-medium">Name
              <input required disabled={!writable} value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2.5" />
            </label>
            <label className="flex min-h-[52px] items-center gap-3 rounded-xl border px-4 text-sm font-semibold sm:mt-6">
              <input type="checkbox" disabled={!writable} checked={form.isActive} onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))} />
              Profile is active
            </label>
            <label className="block text-sm font-medium sm:col-span-2">Description
              <textarea disabled={!writable} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} rows={2} className="mt-1 w-full rounded-lg border px-3 py-2.5" />
            </label>
            <label className="block text-sm font-medium">Geometry
              <select
                disabled={!writable}
                value={form.geometryType}
                onChange={(e) => {
                  const geometryType = e.target.value;
                  setForm((p) => ({
                    ...p,
                    geometryType,
                    surfaces: buildSurfacesForGeometry(geometryType, Number(p.slotHint) || 4),
                  }));
                }}
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5"
              >
                {PREVIEW3D_GEOMETRY_TYPES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
              </select>
            </label>
            <label className="block text-sm font-medium">Environment
              <select disabled={!writable} value={form.environment} onChange={(e) => setForm((p) => ({ ...p, environment: e.target.value }))} className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5">
                {PREVIEW3D_ENVIRONMENTS.map((env) => <option key={env.id} value={env.id}>{env.label}</option>)}
              </select>
            </label>
            {form.geometryType === 'multi_grid' ? (
              <label className="block text-sm font-medium">Default slot count hint
                <input type="number" min="1" max="40" disabled={!writable} value={form.slotHint} onChange={(e) => setForm((p) => ({ ...p, slotHint: e.target.value, surfaces: buildSurfacesForGeometry('multi_grid', Number(e.target.value) || 1) }))} className="mt-1 w-full rounded-lg border px-3 py-2.5" />
              </label>
            ) : null}
            <label className="block text-sm font-medium">Retail readiness
              <select
                disabled={!writable}
                value={form.retailReadiness || 'prototype'}
                onChange={(e) => setForm((p) => ({ ...p, retailReadiness: e.target.value }))}
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5"
              >
                {PREVIEW3D_RETAIL_STATUSES.map((status) => (
                  <option key={status.id} value={status.id}>{status.label}</option>
                ))}
              </select>
            </label>
            <label className="block text-sm font-medium sm:col-span-2">Reuse existing GLB
              <select
                disabled={!writable}
                value={form.modelUrl || ''}
                onChange={(e) => {
                  const asset = assets.find((row) => row.url === e.target.value);
                  if (!asset) {
                    setForm((p) => ({ ...p, modelUrl: '', assetId: '' }));
                    return;
                  }
                  if (!asset.isAccessible) {
                    toast.error('GLB file is missing from storage');
                    return;
                  }
                  setForm((p) => ({
                    ...p,
                    modelUrl: asset.url,
                    assetId: asset._id || '',
                    geometryType: 'custom_glb',
                    surfaces: Array.isArray(asset.surfaceHints) && asset.surfaceHints.length
                      ? asset.surfaceHints
                      : p.surfaces,
                    retailReadiness: p.retailReadiness === 'approved_retail' ? 'awaiting_approval' : (p.retailReadiness || 'prototype'),
                  }));
                }}
                className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5"
              >
                <option value="">Select reusable model…</option>
                {assets.map((asset) => (
                  <option key={asset.url} value={asset.url} disabled={!asset.isAccessible}>
                    {asset.name}{asset.isAccessible ? '' : ' (missing)'} · {asset.retailReadiness || 'prototype'}
                  </option>
                ))}
              </select>
            </label>
            {form.modelUrl ? (
              <label className="block text-sm font-medium sm:col-span-2">Library asset approval
                <select
                  disabled={!writable}
                  value={assets.find((row) => row.url === form.modelUrl)?.retailReadiness || 'prototype'}
                  onChange={(e) => updateLibraryAssetReadiness(e.target.value)}
                  className="mt-1 w-full rounded-lg border bg-white px-3 py-2.5"
                >
                  {PREVIEW3D_RETAIL_STATUSES.map((status) => (
                    <option key={status.id} value={status.id}>{status.label}</option>
                  ))}
                </select>
                <span className="mt-1 block text-[11px] font-normal text-gray-500">
                  Shared across products. Separate from profile retail readiness. Never auto-approved on upload.
                </span>
              </label>
            ) : null}
            <label className="block text-sm font-medium sm:col-span-2">GLB model URL
              <div className="mt-1 flex flex-col gap-2 sm:flex-row">
                <input disabled={!writable} value={form.modelUrl} onChange={(e) => setForm((p) => ({ ...p, modelUrl: e.target.value, assetId: '' }))} className="w-full rounded-lg border px-3 py-2.5" placeholder="Optional — required for custom_glb" />
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
                      if (file) uploadGlb(file);
                    }}
                  />
                </label>
              </div>
            </label>
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-4 rounded-xl border bg-gray-50 p-3">
              <p className="sm:col-span-4 text-xs font-semibold text-gray-800">Default dimensions (optional)</p>
              {['width', 'height', 'depth'].map((field) => (
                <label key={field} className="block text-sm font-medium capitalize">{field}
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    disabled={!writable}
                    value={form.dimensions?.[field] ?? ''}
                    onChange={(e) => setForm((p) => ({
                      ...p,
                      dimensions: normalizePreview3dDimensions({
                        ...(p.dimensions || emptyPreview3dDimensions()),
                        [field]: e.target.value === '' ? null : Number(e.target.value),
                      }),
                    }))}
                    className="mt-1 w-full rounded-lg border px-3 py-2.5"
                  />
                </label>
              ))}
              <label className="block text-sm font-medium">Unit
                <select
                  disabled={!writable}
                  value={form.dimensions?.unit || 'inch'}
                  onChange={(e) => setForm((p) => ({
                    ...p,
                    dimensions: normalizePreview3dDimensions({
                      ...(p.dimensions || emptyPreview3dDimensions()),
                      unit: e.target.value,
                    }),
                  }))}
                  className="mt-1 w-full rounded-lg border px-3 py-2.5"
                >
                  {PREVIEW3D_DIMENSION_UNITS.map((unit) => (
                    <option key={unit.id} value={unit.id}>{unit.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block text-sm font-medium">Camera look-at Y
              <input
                type="number"
                step="0.01"
                disabled={!writable}
                value={form.camera?.targetY === null || form.camera?.targetY === undefined ? '' : form.camera.targetY}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  camera: { ...p.camera, targetY: e.target.value === '' ? null : Number(e.target.value) },
                }))}
                placeholder="Auto"
                className="mt-1 w-full rounded-lg border px-3 py-2.5"
              />
            </label>
            <label className="block text-sm font-medium sm:col-span-2">Placeholder image URL
              <input disabled={!writable} value={form.placeholderUrl} onChange={(e) => setForm((p) => ({ ...p, placeholderUrl: e.target.value }))} className="mt-1 w-full rounded-lg border px-3 py-2.5" />
            </label>
            <label className="block text-sm font-medium">Frame color
              <input type="color" disabled={!writable} value={form.frameColor} onChange={(e) => setForm((p) => ({ ...p, frameColor: e.target.value }))} className="mt-1 h-11 w-full rounded-lg border px-2" />
            </label>
            <label className="block text-sm font-medium">Accent color
              <input type="color" disabled={!writable} value={form.accentColor} onChange={(e) => setForm((p) => ({ ...p, accentColor: e.target.value }))} className="mt-1 h-11 w-full rounded-lg border px-2" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2">
              <input type="checkbox" disabled={!writable} checked={form.camera?.autoRotate === true} onChange={(e) => setForm((p) => ({ ...p, camera: { ...p.camera, autoRotate: e.target.checked } }))} />
              Auto-rotate by default
            </label>
          </div>

          <AdminPreview3dStage
            value={form}
            slotCount={Number(form.slotHint) || Math.max(1, form.surfaces?.length || 1)}
            selectedSurfaceId={selectedSurfaceId}
            onChangeSurfaces={(surfaces) => {
              if (!writable) return;
              setForm((p) => ({ ...p, surfaces, geometryType: p.geometryType === 'custom_glb' ? 'custom_glb' : p.geometryType }));
            }}
            onSelectSurface={(surfaceId) => setSelectedSurfaceId(surfaceId || '')}
          />

          <div className="rounded-xl border bg-gray-50 p-3 text-xs text-gray-600">
            <p className="font-semibold text-gray-800">Configured surfaces ({form.surfaces?.length || 0})</p>
            <ul className="mt-2 space-y-1">
              {(form.surfaces || []).map((surface) => (
                <li key={surface.id}>
                  {surface.label || surface.id}
                  {surface.meshName ? ` · mesh:${surface.meshName}` : ''}
                  {surface.hasUvs === false ? ' · UV warning' : ''}
                  {' · '}
                  <code>{surface.id}</code>
                </li>
              ))}
            </ul>
            <p className="mt-2">
              Workflow A: reuse this profile on products and map photo slots. Workflow B: upload a prepared GLB, pick named meshes here, then assign the profile to products — no code changes required.
            </p>
          </div>

          {writable ? (
            <button type="submit" disabled={saving} className="min-h-[48px] rounded-xl bg-primary-600 px-5 py-2.5 font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving…' : selectedId === 'new' ? 'Create profile' : 'Save profile'}
            </button>
          ) : null}
        </form>
      </div>
    </div>
  );
}
