'use client';

import { useMemo } from 'react';
import {
  DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  DEFAULT_PHOTO_FRAME_SIZE_RULES,
  PHOTO_FRAME_MANUFACTURING_SPEC,
  emptyPhotoFrameConfig,
  assertDesignCompatibleWithSize,
  findDesignProfile,
  findSizeRule,
  normalizePhotoFrameConfig,
  resolvePhotoFrameDimensions,
} from '@/lib/photoFrame3d';

const DESIGN_LABELS = {
  design_matte_black_procedural: 'Matte black',
  design_espresso_procedural: 'Espresso wood',
  design_custom_glb: 'Custom 3D model',
  design_realistic_5x7_pilot: 'Realistic 5×7 model',
  design_premium_5x7: 'Premium 5×7 model',
};

/**
 * Minimal product-level 3D design picker.
 * Manufacturing sizes, borders, depth, and hardware stay in versioned code.
 */
export default function PhotoFrameAdminFields({
  config,
  onChange,
  writable = true,
}) {
  const catalog = {
    sizeRules: DEFAULT_PHOTO_FRAME_SIZE_RULES,
    designProfiles: DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  };

  const pf = useMemo(
    () => normalizePhotoFrameConfig(config?.photoFrame || emptyPhotoFrameConfig()),
    [config?.photoFrame],
  );

  const sizeRule = findSizeRule(catalog.sizeRules, pf.sizeRuleKey);
  const dims = resolvePhotoFrameDimensions(pf, sizeRule);
  const designProfile = findDesignProfile(catalog.designProfiles, pf.designProfileKey);
  const glbCompat = assertDesignCompatibleWithSize(designProfile, pf.sizeRuleKey || sizeRule?.key);

  const applyDesign = (key) => {
    const design = catalog.designProfiles.find((d) => d.key === key);
    const nextPf = normalizePhotoFrameConfig({
      ...pf,
      enabled: true,
      designProfileKey: key,
    });
    const wantsGlb = design?.mode === 'custom_glb';
    const usesGlb = wantsGlb && !!design?.modelUrl;
    if (wantsGlb && !usesGlb) {
      onChange({
        geometryType: 'custom_glb',
        photoFrame: nextPf,
        frameColor: design?.frameColor || config.frameColor,
        accentColor: design?.accentColor || config.accentColor,
      });
      return;
    }
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
      geometryType: 'photo_frame',
      photoFrame: nextPf,
      frameColor: design?.frameColor || config.frameColor,
      accentColor: design?.accentColor || config.accentColor,
      modelUrl: design?.mode === 'custom_glb' ? (config.modelUrl || '') : '',
    });
  };

  const enableLayer = () => {
    onChange({
      geometryType: config.geometryType === 'custom_glb' ? 'custom_glb' : 'photo_frame',
      photoFrame: {
        ...emptyPhotoFrameConfig(),
        ...pf,
        enabled: true,
        designProfileKey: pf.designProfileKey || 'design_matte_black_procedural',
      },
    });
  };

  if (config.geometryType !== 'photo_frame' && !pf.enabled) {
    return (
      <div className="sm:col-span-2 rounded-xl border bg-white p-3">
        <p className="text-sm font-bold text-gray-900">Frame design</p>
        <p className="mt-1 text-xs text-gray-500">
          Sizes and construction come from this product’s available sizes. Choose a look after enabling 3D.
        </p>
        <button
          type="button"
          disabled={!writable}
          onClick={enableLayer}
          className="mt-3 rounded-xl bg-primary-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          Use standard frame design
        </button>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 space-y-3 rounded-xl border bg-white p-3">
      <div>
        <p className="text-sm font-bold text-gray-900">Frame design</p>
        <p className="mt-1 text-xs text-gray-500">
          Size, borders, depth, and hanging hardware are locked from manufacturing rules (spec {PHOTO_FRAME_MANUFACTURING_SPEC.version}).
          Customers only see sizes already enabled on this product.
        </p>
      </div>

      <label className="block text-sm font-semibold">
        Design
        <select
          disabled={!writable}
          value={pf.designProfileKey || 'design_matte_black_procedural'}
          onChange={(e) => applyDesign(e.target.value)}
          className="mt-1 w-full rounded-xl border bg-white px-3 py-2.5 text-sm font-normal"
        >
          {catalog.designProfiles.map((d) => (
            <option key={d.key} value={d.key}>
              {DESIGN_LABELS[d.key] || d.name}
            </option>
          ))}
        </select>
      </label>

      <p className="text-xs text-gray-600">
        {dims.openingWidth && dims.openingHeight
          ? `Current size ${dims.openingWidth}×${dims.openingHeight} ${dims.unit} · outer ${dims.outerWidth}×${dims.outerHeight}`
          : 'Size follows the customer’s selected product option.'}
      </p>
      {glbCompat.ok ? null : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          This model is for a specific size. Other sizes automatically use the standard frame shape so the model is not stretched.
        </p>
      )}
    </div>
  );
}
