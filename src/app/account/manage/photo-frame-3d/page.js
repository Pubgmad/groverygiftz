'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import useAdminAccess from '@/hooks/useAdminAccess';
import usePhotoFrame3dAdminPreview from '@/hooks/usePhotoFrame3dAdminPreview';

export default function PhotoFrame3dCatalogPage() {
  const { canRead, status: accessStatus } = useAdminAccess();
  const liveAdminPreview = usePhotoFrame3dAdminPreview();
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const res = await fetch('/api/admin/photo-frame-3d', { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to load catalog');
      setData(await res.json());
    } catch (e) {
      setError(e.message || 'Load failed');
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const seed = async () => {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/photo-frame-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed_defaults' }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Seed failed');
      toast.success('Seeded 19 sizes + 4 hardware + design profiles');
      await load();
    } catch (e) {
      toast.error(e.message || 'Seed failed');
    } finally {
      setBusy(false);
    }
  };

  if (accessStatus === 'loading') {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-gray-600">Checking admin access…</div>;
  }
  if (accessStatus !== 'authenticated' || !canRead('products')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-sm text-gray-600">
        Photo Frame 3D catalog is available only to administrators with Products access.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-primary-700">Universal 3D</p>
          <h1 className="text-2xl font-black text-gray-950">Photo frame 3D catalog</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-600">
            Admin-managed size/border rules and backside hardware profiles. Edit here, then assign on each product’s 3D section.
            No SKU hardcoding in the customer viewer.
          </p>
          <p className="mt-2 text-xs font-semibold text-amber-800">
            {liveAdminPreview
              ? 'Live admin 3D preview is on for authorized admins. Customers still cannot see unfinished 3D.'
              : 'Live admin 3D preview is off. Catalog edits do not change the customer product page.'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/account/manage/preview-3d" className="rounded-xl border px-3 py-2 text-sm font-semibold">
            3D Profiles
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={seed}
            className="rounded-xl bg-primary-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            Seed / refresh defaults
          </button>
        </div>
      </div>

      {error ? <p className="text-sm font-semibold text-red-600">{error}</p> : null}

      {data ? (
        <>
          <div className="rounded-2xl border bg-white p-4 text-sm">
            <p className="font-bold">Coverage</p>
            <p className="mt-1 text-gray-600">
              Sizes in response: {data.sizeRules?.length}
              {' · '}19-check: {data.nineteenCheck?.ok ? 'PASS' : 'FAIL'}
              {' · '}DB counts: sizes {data.fromDatabase?.sizeRules}, hardware {data.fromDatabase?.hardwareProfiles}, designs {data.fromDatabase?.designProfiles}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Border</th>
                  <th className="px-3 py-2">Opening</th>
                  <th className="px-3 py-2">Outer (computed)</th>
                  <th className="px-3 py-2">Hardware</th>
                  <th className="px-3 py-2">Membership</th>
                </tr>
              </thead>
              <tbody>
                {(data.matrix || []).map((row) => (
                  <tr key={row.sizeKey} className="border-t">
                    <td className="px-3 py-2 font-semibold">{row.sizeKey}</td>
                    <td className="px-3 py-2">{row.borderWidth}&quot; ({row.borderGroup})</td>
                    <td className="px-3 py-2">{row.openingWidth}×{row.openingHeight}</td>
                    <td className="px-3 py-2">{row.outerWidth}×{row.outerHeight}</td>
                    <td className="px-3 py-2">{row.hardwareProfileKey}</td>
                    <td className="px-3 py-2">{row.membershipExplicit ? 'explicit OK' : 'MISSING'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {(data.hardwareProfiles || []).map((hw) => (
              <div key={hw.key} className="rounded-2xl border bg-white p-4">
                <p className="font-bold text-gray-900">{hw.name}</p>
                <p className="mt-1 text-xs text-gray-500">{hw.description}</p>
                <p className="mt-2 text-[11px] font-semibold text-gray-700">
                  Sizes: {(hw.sizeRuleKeys || []).join(', ')}
                </p>
                <ul className="mt-2 grid grid-cols-2 gap-1 text-[11px]">
                  {Object.entries(hw.components || {}).map(([k, v]) => (
                    <li key={k}>{k}: {v?.enabled ? 'ON' : 'off'}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Parametric</th>
                  <th className="px-3 py-2">Decorative GLB</th>
                  <th className="px-3 py-2">Visual / physical</th>
                </tr>
              </thead>
              <tbody>
                {(data.coverage || []).map((row) => (
                  <tr key={row.sizeKey} className="border-t">
                    <td className="px-3 py-2 font-semibold">{row.sizeKey}</td>
                    <td className="px-3 py-2">{row.parametricReady ? 'ready' : 'gap'}</td>
                    <td className="px-3 py-2">{row.decorativeGlbReady?.length ? row.decorativeGlbReady.join(', ') : 'none — do not stretch 5×7'}</td>
                    <td className="px-3 py-2 text-amber-800">owner pending</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-2xl border bg-white p-4 space-y-3">
            <div>
              <p className="font-bold text-gray-900">Design profiles</p>
              <p className="mt-1 text-xs text-gray-500">
                Assign reusable GLB URLs here. Product editors load the modelUrl when a custom_glb design is selected — no SKU hardcoding.
              </p>
            </div>
            <div className="space-y-3">
              {(data.designProfiles || []).map((d) => (
                <DesignProfileEditor key={d.key} profile={d} onSaved={load} />
              ))}
            </div>
          </div>
        </>
      ) : (
        <p className="text-sm text-gray-500">Loading catalog…</p>
      )}
    </div>
  );
}

function DesignProfileEditor({ profile, onSaved }) {
  const [modelUrl, setModelUrl] = useState(profile.modelUrl || '');
  const [lockedSizeKey, setLockedSizeKey] = useState(profile.lockedSizeKey || '');
  const [compatibleText, setCompatibleText] = useState((profile.compatibleSizeKeys || []).join(', '));
  const [mouldingProfileKey, setMouldingProfileKey] = useState(profile.mouldingProfileKey || '');
  const [customerReadiness, setCustomerReadiness] = useState(profile.customerReadiness || 'draft');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setModelUrl(profile.modelUrl || '');
    setLockedSizeKey(profile.lockedSizeKey || '');
    setCompatibleText((profile.compatibleSizeKeys || []).join(', '));
    setMouldingProfileKey(profile.mouldingProfileKey || '');
    setCustomerReadiness(profile.customerReadiness || 'draft');
  }, [profile.modelUrl, profile.key, profile.lockedSizeKey, profile.compatibleSizeKeys, profile.mouldingProfileKey, profile.customerReadiness]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/photo-frame-3d', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert_design_profile',
          profile: {
            ...profile,
            modelUrl,
            lockedSizeKey,
            compatibleSizeKeysText: compatibleText,
            mouldingProfileKey,
            customerReadiness,
          },
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Save failed');
      toast.success(`Saved design ${profile.key}`);
      await onSaved?.();
    } catch (e) {
      toast.error(e.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-gray-900">{profile.name}</p>
          <p className="text-[11px] text-gray-500">{profile.key} · {profile.mode} · {profile.fidelity} · {customerReadiness}</p>
          <p className="mt-1 text-[11px] text-gray-600">{profile.description}</p>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save design'}
        </button>
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="block text-[11px] font-semibold text-gray-700 sm:col-span-2">
          modelUrl
          <input
            type="text"
            value={modelUrl}
            onChange={(e) => setModelUrl(e.target.value)}
            placeholder="/media/preview3d/models/…"
            className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
          />
        </label>
        <label className="block text-[11px] font-semibold text-gray-700">
          lockedSizeKey
          <input
            type="text"
            value={lockedSizeKey}
            onChange={(e) => setLockedSizeKey(e.target.value)}
            placeholder="e.g. 5x7"
            className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
          />
        </label>
        <label className="block text-[11px] font-semibold text-gray-700">
          Customer readiness
          <select
            value={customerReadiness}
            onChange={(e) => setCustomerReadiness(e.target.value)}
            className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
          >
            <option value="draft">Draft</option>
            <option value="validation_required">Validation required</option>
            <option value="approved">Approved for customers</option>
          </select>
        </label>
        <label className="block text-[11px] font-semibold text-gray-700 sm:col-span-2">
          compatibleSizeKeys
          <input
            type="text"
            value={compatibleText}
            onChange={(e) => setCompatibleText(e.target.value)}
            placeholder="empty = all sizes for procedural; list keys for GLB"
            className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
          />
        </label>
        <label className="block text-[11px] font-semibold text-gray-700">
          mouldingProfileKey
          <input
            type="text"
            value={mouldingProfileKey}
            onChange={(e) => setMouldingProfileKey(e.target.value)}
            placeholder="stepped | beveled | flat"
            className="mt-1 w-full rounded-lg border bg-white px-2 py-1.5 text-xs font-normal"
          />
        </label>
      </div>
    </div>
  );
}
