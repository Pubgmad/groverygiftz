'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
  DEFAULT_PHOTO_FRAME_SIZE_RULES,
  PHOTO_FRAME_MOULDING_PROFILES,
  applySizeRuleToPhotoFrame,
  emptyPhotoFrameConfig,
  assertDesignCompatibleWithSize,
  evaluatePhotoFrameAdminGate,
  findDesignProfile,
  findHardwareProfile,
  findSizeRule,
  normalizePhotoFrameConfig,
  resolveHardwareComponents,
  resolvePhotoFrameDimensions,
} from '@/lib/photoFrame3d';

function NumField({ label, value, onChange, disabled, step = '0.01' }) {
  return (
    <label className="block text-xs font-semibold">
      {label}
      <input
        type="number"
        min={0}
        step={step}
        disabled={disabled}
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        placeholder="—"
        className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
      />
    </label>
  );
}

/**
 * Admin controls for photo-frame size / border / hardware / design.
 * Persists under preview3d.photoFrame (normalized on product save).
 */
export default function PhotoFrameAdminFields({
  config,
  onChange,
  writable = true,
}) {
  const [catalog, setCatalog] = useState({
    sizeRules: DEFAULT_PHOTO_FRAME_SIZE_RULES,
    hardwareProfiles: DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
    designProfiles: DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  });
  const [loadState, setLoadState] = useState('idle');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadState('loading');
      try {
        const res = await fetch('/api/admin/photo-frame-3d', { cache: 'no-store' });
        if (!res.ok) throw new Error('catalog');
        const data = await res.json();
        if (cancelled) return;
        setCatalog({
          sizeRules: data.sizeRules?.length ? data.sizeRules : DEFAULT_PHOTO_FRAME_SIZE_RULES,
          hardwareProfiles: data.hardwareProfiles?.length ? data.hardwareProfiles : DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
          designProfiles: data.designProfiles?.length ? data.designProfiles : DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
        });
        setLoadState('ready');
      } catch {
        if (!cancelled) setLoadState('fallback');
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const pf = useMemo(
    () => normalizePhotoFrameConfig(config?.photoFrame || emptyPhotoFrameConfig()),
    [config?.photoFrame],
  );

  const setPhotoFrame = (patch) => {
    const next = normalizePhotoFrameConfig({ ...pf, ...patch });
    onChange({ photoFrame: next, ...(patch.geometryHint ? { geometryType: patch.geometryHint } : {}) });
  };

  const sizeRule = findSizeRule(catalog.sizeRules, pf.sizeRuleKey);
  const dims = resolvePhotoFrameDimensions(pf, sizeRule);
  const hwProfile = findHardwareProfile(
    catalog.hardwareProfiles,
    pf.hardwareProfileKey || sizeRule?.hardwareProfileKey,
  );
  const components = resolveHardwareComponents(hwProfile, pf.hardwareOverrides);
  const designProfile = findDesignProfile(catalog.designProfiles, pf.designProfileKey);
  const glbCompat = assertDesignCompatibleWithSize(designProfile, pf.sizeRuleKey || sizeRule?.key);
  const adminGate = evaluatePhotoFrameAdminGate({
    photoFrame: pf,
    design: designProfile,
    sizeRuleKey: pf.sizeRuleKey || sizeRule?.key,
    retailReadiness: config?.retailReadiness,
  });

  const applyRule = (key) => {
    const rule = findSizeRule(catalog.sizeRules, key);
    if (!rule) {
      setPhotoFrame({ sizeRuleKey: key });
      return;
    }
    const next = applySizeRuleToPhotoFrame(pf, rule, { force: true });
    // Keep custom_glb when already selected — size rules must not wipe decorative fronts.
    const keepGlb = config.geometryType === 'custom_glb';
    onChange({
      ...(keepGlb ? {} : { geometryType: 'photo_frame' }),
      photoFrame: {
        ...next,
        attachProceduralHardware: keepGlb ? (pf.attachProceduralHardware || true) : next.attachProceduralHardware,
        enabled: true,
      },
      frameColor: config.frameColor,
      dimensions: {
        ...(config.dimensions || {}),
        width: next.openingWidth,
        height: next.openingHeight,
        depth: next.depth ?? config.dimensions?.depth ?? 0.35,
        unit: next.unit || 'inch',
      },
    });
  };

  const toggleHw = (name, enabled) => {
    setPhotoFrame({
      hardwareOverrides: {
        ...pf.hardwareOverrides,
        [name]: enabled,
      },
    });
  };

  if (config.geometryType !== 'photo_frame' && !pf.enabled) {
    return (
      <div className="sm:col-span-2 rounded-xl border border-dashed border-gray-200 bg-gray-50/80 p-3">
        <p className="text-sm font-bold text-gray-900">Photo frame configuration</p>
        <p className="mt-1 text-[11px] text-gray-500">
          Use procedural “Photo frame” geometry, or keep Custom GLB and enable this layer to attach Admin size/border/hardware without replacing the decorative front.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!writable}
            onClick={() => onChange({
              geometryType: 'photo_frame',
              photoFrame: { ...emptyPhotoFrameConfig(), enabled: true, designProfileKey: 'design_matte_black_procedural' },
            })}
            className="rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Enable procedural photo-frame
          </button>
          {config.geometryType === 'custom_glb' ? (
            <button
              type="button"
              disabled={!writable}
              onClick={() => onChange({
                photoFrame: {
                  ...emptyPhotoFrameConfig(),
                  enabled: true,
                  attachProceduralHardware: true,
                  glbContainsHardware: false,
                  includeProceduralBacking: false,
                  designProfileKey: 'design_custom_glb',
                },
              })}
              className="rounded-xl border border-primary-600 px-3 py-2 text-xs font-bold text-primary-700 disabled:opacity-50"
            >
              Keep custom GLB + attach hardware
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border bg-white p-3">
      <div>
        <p className="text-sm font-bold text-gray-900">Photo frame — size, borders & hardware</p>
        <p className="mt-1 text-[11px] text-gray-500">
          Owner border widths are confirmed. Depth / hardware millimetres are approximate unless marked verified.
          Catalog load: {loadState}. Outer dims = opening + borders (not claimed as tape-verified unless flagged).
        </p>
      </div>

      <label className="flex min-h-[40px] items-center gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          disabled={!writable}
          checked={pf.enabled !== false}
          onChange={(e) => setPhotoFrame({ enabled: e.target.checked })}
        />
        Photo-frame layer enabled on this product
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs font-semibold sm:col-span-2">
          Size rule (Admin catalog)
          <select
            disabled={!writable}
            value={pf.sizeRuleKey || ''}
            onChange={(e) => applyRule(e.target.value)}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
          >
            <option value="">Select a size rule…</option>
            {catalog.sizeRules.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label || r.key} · border {r.borderWidth}&quot; · HW {r.hardwareProfileKey}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold">
          Design profile
          <select
            disabled={!writable}
            value={pf.designProfileKey || ''}
            onChange={(e) => {
              const design = catalog.designProfiles.find((d) => d.key === e.target.value);
              const nextPf = normalizePhotoFrameConfig({ ...pf, designProfileKey: e.target.value });
              const usesGlb = design?.mode === 'custom_glb' && !!design?.modelUrl;
              // Design profiles may carry a reusable modelUrl — apply without hardcoding SKUs.
              if (usesGlb) {
                const hasPhotoSurface = (config.surfaces || []).some(
                  (s) => /PhotoPlane/i.test(s?.meshName || s?.id || ''),
                );
                onChange({
                  geometryType: 'custom_glb',
                  modelUrl: design.modelUrl,
                  frameColor: design.frameColor || config.frameColor,
                  accentColor: design.accentColor || config.accentColor,
                  photoFrame: {
                    ...nextPf,
                    // Pilot / embedded-hardware designs: prefer fail-closed double-hardware guard.
                    glbContainsHardware: /realistic|premium|contains.?hardware|stand/i.test(
                      `${design.key} ${design.notes || ''} ${design.description || ''}`,
                    ) || pf.glbContainsHardware,
                    attachProceduralHardware: false,
                  },
                  surfaces: hasPhotoSurface
                    ? config.surfaces
                    : [{
                      id: 'mesh:PhotoPlane',
                      label: 'PhotoPlane',
                      kind: 'plane',
                      meshName: 'PhotoPlane',
                      meshPath: 'PhotoPlane',
                      hasUvs: true,
                    }],
                  surfaceMappings: (config.surfaceMappings || []).length
                    ? config.surfaceMappings
                    : [{ slotKey: 'area:index:0', surfaceId: 'mesh:PhotoPlane' }],
                });
                return;
              }
              onChange({
                photoFrame: nextPf,
                frameColor: design?.frameColor || config.frameColor,
                accentColor: design?.accentColor || config.accentColor,
                ...(design?.mode === 'procedural' ? { geometryType: 'photo_frame' } : {}),
              });
            }}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
          >
            {catalog.designProfiles.map((d) => (
              <option key={d.key} value={d.key}>{d.name}</option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold">
          Moulding profile
          <select
            disabled={!writable}
            value={pf.mouldingProfileKey || designProfile?.mouldingProfileKey || 'stepped'}
            onChange={(e) => setPhotoFrame({ mouldingProfileKey: e.target.value })}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
          >
            {PHOTO_FRAME_MOULDING_PROFILES.map((row) => (
              <option key={row.key} value={row.key}>
                {row.label}{row.sculpted ? '' : ' (not sculpted)'}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-xs font-semibold">
          Hardware profile
          <select
            disabled={!writable}
            value={pf.hardwareProfileKey || sizeRule?.hardwareProfileKey || ''}
            onChange={(e) => setPhotoFrame({ hardwareProfileKey: e.target.value })}
            className="mt-1 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal"
          >
            <option value="">From size rule default</option>
            {catalog.hardwareProfiles.map((h) => (
              <option key={h.key} value={h.key}>{h.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <NumField label="Nominal W" disabled={!writable} value={pf.nominalWidth} onChange={(v) => setPhotoFrame({ nominalWidth: v })} />
        <NumField label="Nominal H" disabled={!writable} value={pf.nominalHeight} onChange={(v) => setPhotoFrame({ nominalHeight: v })} />
        <NumField label="Opening W" disabled={!writable} value={pf.openingWidth} onChange={(v) => setPhotoFrame({ openingWidth: v })} />
        <NumField label="Opening H" disabled={!writable} value={pf.openingHeight} onChange={(v) => setPhotoFrame({ openingHeight: v })} />
        <NumField label="Border L" disabled={!writable} value={pf.borderLeft} onChange={(v) => setPhotoFrame({ borderLeft: v })} />
        <NumField label="Border R" disabled={!writable} value={pf.borderRight} onChange={(v) => setPhotoFrame({ borderRight: v })} />
        <NumField label="Border T" disabled={!writable} value={pf.borderTop} onChange={(v) => setPhotoFrame({ borderTop: v })} />
        <NumField label="Border B" disabled={!writable} value={pf.borderBottom} onChange={(v) => setPhotoFrame({ borderBottom: v })} />
        <NumField label="Outer W" disabled={!writable} value={pf.outerWidth} onChange={(v) => setPhotoFrame({ outerWidth: v })} />
        <NumField label="Outer H" disabled={!writable} value={pf.outerHeight} onChange={(v) => setPhotoFrame({ outerHeight: v })} />
        <NumField label="Depth" disabled={!writable} value={pf.depth} onChange={(v) => setPhotoFrame({ depth: v })} />
        <NumField label="Backing thick." disabled={!writable} value={pf.rearBackingThickness} onChange={(v) => setPhotoFrame({ rearBackingThickness: v })} />
      </div>

      <p className="text-[11px] text-gray-600">
        Resolved opening {dims.openingWidth}×{dims.openingHeight} {dims.unit}
        {' · '}outer {dims.outerWidth}×{dims.outerHeight}
        {dims.outerDimsVerified ? ' (verified)' : ' (computed / approximate — not tape-verified)'}
        {' · '}orientation {dims.orientation}
      </p>
      {glbCompat.ok ? null : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-950">
          {glbCompat.reason} Retail activation should use a compatible GLB or a procedural design for this size.
        </p>
      )}
      {adminGate.blockers.length ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-950">
          {adminGate.blockers.map((msg) => <p key={msg}>{msg}</p>)}
        </div>
      ) : null}
      {adminGate.warnings.length ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-[11px] text-amber-950">
          {adminGate.warnings.slice(0, 4).map((msg) => <p key={msg}>{msg}</p>)}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-xs font-semibold">
        <input
          type="checkbox"
          disabled={!writable}
          checked={pf.outerDimsVerified === true}
          onChange={(e) => setPhotoFrame({ outerDimsVerified: e.target.checked })}
        />
        Outer dimensions verified (owner/tape)
      </label>

      {config.geometryType === 'custom_glb' ? (
        <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-2 space-y-2">
          <p className="text-xs font-bold text-amber-950">Custom GLB + procedural hardware</p>
          <p className="text-[11px] text-amber-900">
            Decorative front stays on the GLB / PhotoPlane. Hardware placement uses the loaded model bounds (approximate — not tape-verified millimetres).
          </p>
          <label className="flex items-center gap-2 text-[11px] font-semibold">
            <input
              type="checkbox"
              disabled={!writable || pf.glbContainsHardware}
              checked={pf.attachProceduralHardware === true && !pf.glbContainsHardware}
              onChange={(e) => setPhotoFrame({ attachProceduralHardware: e.target.checked })}
            />
            Attach procedural backside hardware to this GLB
          </label>
          <label className="flex items-center gap-2 text-[11px] font-semibold">
            <input
              type="checkbox"
              disabled={!writable}
              checked={pf.glbContainsHardware === true}
              onChange={(e) => setPhotoFrame({
                glbContainsHardware: e.target.checked,
                attachProceduralHardware: e.target.checked ? false : pf.attachProceduralHardware,
              })}
            />
            GLB already contains rear hardware (disable procedural attach)
          </label>
          <label className="flex items-center gap-2 text-[11px] font-semibold">
            <input
              type="checkbox"
              disabled={!writable || !pf.attachProceduralHardware || pf.glbContainsHardware}
              checked={pf.includeProceduralBacking === true}
              onChange={(e) => setPhotoFrame({ includeProceduralBacking: e.target.checked })}
            />
            Also add procedural backing panel (off by default — avoids double backs)
          </label>
        </div>
      ) : null}

      <div className="rounded-lg border border-gray-100 bg-gray-50 p-2">
        <p className="text-xs font-bold text-gray-800">Hardware component overrides</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {Object.entries(components).map(([name, state]) => (
            <label key={name} className="flex items-center gap-2 text-[11px] font-semibold capitalize">
              <input
                type="checkbox"
                disabled={!writable}
                checked={state.enabled}
                onChange={(e) => toggleHw(name, e.target.checked)}
              />
              {name}
              <span className="font-normal text-gray-400">({state.fidelity})</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
