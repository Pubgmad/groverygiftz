/**
 * Universal optional 3D preview helpers.
 * Additive only — does not alter upload, crop, cart, or checkout logic.
 */
import {
  applyPhotoFrameSizeFromSelection,
  emptyPhotoFrameConfig,
  normalizePhotoFrameConfig,
  parseWxHFromLabel,
  sizeRulesForProduct,
} from '@/lib/photoFrame3d';

export { sizeRulesForProduct } from '@/lib/photoFrame3d';

export const PREVIEW3D_GEOMETRY_TYPES = [
  {
    id: 'single_plane',
    label: 'Single photo surface',
    description: 'One flat customizable face — typical photo frame / plaque.',
    defaultSurfaces: [{ id: 'face_1', label: 'Front photo', kind: 'plane' }],
  },
  {
    id: 'photo_frame',
    label: 'Photo frame (procedural + hardware)',
    description: 'Admin size/border rules + configurable backside hardware. Prefer for standard frames; use Custom GLB for unique decorative mouldings.',
    defaultSurfaces: [{ id: 'face_1', label: 'Front photo', kind: 'plane' }],
  },
  {
    id: 'multi_grid',
    label: 'Multi-slot grid',
    description: 'Configurable grid of photo surfaces for combos (slot count from product config).',
    defaultSurfaces: [],
  },
  {
    id: 'cylinder',
    label: 'Cylindrical wrap',
    description: 'Bottle / mug style wrap around a cylinder.',
    defaultSurfaces: [{ id: 'wrap_1', label: 'Wrap surface', kind: 'cylinder' }],
  },
  {
    id: 'pendant',
    label: 'Small pendant / locket',
    description: 'Compact front face for keychains and lockets.',
    defaultSurfaces: [{ id: 'face_1', label: 'Front photo', kind: 'plane' }],
  },
  {
    id: 'custom_glb',
    label: 'Custom GLB model',
    description: 'Admin-uploaded GLB with named material / mesh surfaces.',
    defaultSurfaces: [],
  },
];

export const PREVIEW3D_ENVIRONMENTS = [
  { id: 'studio', label: 'Neutral studio (lights only — fastest)' },
  { id: 'wall', label: 'Indoor wall' },
  { id: 'table', label: 'Tabletop' },
  { id: 'none', label: 'No environment' },
];

export const PREVIEW3D_LAYOUT_MODES = [
  { id: 'auto_grid', label: 'Auto grid', description: 'Square-ish grid from configured slot count.' },
  { id: 'wall_row', label: 'Single wall row', description: 'All frames in one horizontal row.' },
  { id: 'wall_grid', label: 'Wall grid', description: 'Admin-chosen column count for wall arrangements.' },
  { id: 'manual', label: 'Manual positions', description: 'Per-surface x/y offsets from Admin layout.' },
];

/** Explicit viewer texture appearances (not free-form JSON). */
export const PREVIEW3D_APPEARANCES = [
  { id: '', label: 'Standard photo print' },
  { id: 'metal_engraving', label: 'Metal engraving (contain-fit)' },
];

/**
 * Retail readiness — technical validity ≠ owner-approved retail.
 * Customer View in 3D requires approved_retail (unless isolated staging allow-prototype).
 */
export const PREVIEW3D_RETAIL_STATUSES = [
  { id: 'prototype', label: 'Prototype / staging only', description: 'Admin preview OK. Hidden from customers.' },
  { id: 'awaiting_approval', label: 'Awaiting visual approval', description: 'Configured but not owner-approved for retail.' },
  { id: 'approved_retail', label: 'Approved for retail 3D', description: 'May show View in 3D when enabled.' },
];

export function normalizeRetailReadiness(value) {
  const id = String(value || '').trim();
  return PREVIEW3D_RETAIL_STATUSES.some((row) => row.id === id) ? id : 'prototype';
}

export function normalizePreview3dAppearance(value) {
  const id = String(value || '').trim();
  return PREVIEW3D_APPEARANCES.some((row) => row.id === id) ? id : '';
}

export const PREVIEW3D_DIMENSION_UNITS = [
  { id: 'inch', label: 'Inch', metersPerUnit: 0.0254 },
  { id: 'cm', label: 'CM', metersPerUnit: 0.01 },
  { id: 'mm', label: 'MM', metersPerUnit: 0.001 },
];

/**
 * Prototype customer preview — fail closed.
 * Never enable from Mongo URI / hostname matching (avoids production accidents).
 * Production NODE_ENV never allows prototypes, even if PREVIEW3D_ALLOW_PROTOTYPE is mistakenly set.
 * Isolated staging requires both non-production runtime AND an explicit authorization flag.
 */
export function allowPrototypeCustomerPreview() {
  if (process.env.NODE_ENV === 'production') return false;
  if (process.env.PREVIEW3D_ALLOW_PROTOTYPE === '1') return true;
  if (process.env.NEXT_PUBLIC_PREVIEW3D_ALLOW_PROTOTYPE === '1') return true;
  return false;
}

/**
 * Server-enforced live admin preview flag. Default OFF.
 * Only the literal value "1" enables it. Pass `env` in tests — do not treat a
 * client bundle read of process.env as authorization.
 */
export function isPhotoFrame3dAdminPreviewFlagEnabled(env = process.env) {
  return String(env?.PHOTO_FRAME_3D_ADMIN_PREVIEW_ENABLED || '') === '1';
}

export function isUnfinishedPhotoFramePreview(configInput = {}) {
  const config = configInput && typeof configInput === 'object' && !configInput.geometryType && configInput.preview3d
    ? normalizePreview3dConfig(configInput.preview3d)
    : normalizePreview3dConfig(configInput);
  return config.geometryType === 'photo_frame' || config.photoFrame?.enabled === true;
}

/** Configured enough for an authorized admin to open the unfinished viewer. */
export function isPreview3dAdminCandidate(product) {
  const config = normalizePreview3dConfig(product?.preview3d || {});
  if (!config.enabled) return false;
  if (config.geometryType === 'custom_glb' && !config.modelUrl) return false;
  return true;
}

export function redactPreview3dForPublicProduct(product) {
  if (!product || typeof product !== 'object') return product;
  const next = { ...product, preview3d: { enabled: false } };
  if ('photoFrameCatalog' in next) delete next.photoFrameCatalog;
  if ('preview3dAdminPreview' in next) delete next.preview3dAdminPreview;
  return next;
}

/**
 * Customer payloads never include unfinished 3D config.
 * Admin live preview requires access.adminPreview from the server session check.
 * Authorized admins still receive config when the live flag is off (editor only).
 */
export function applyPublicPreview3dVisibility(product, access = {}) {
  if (!product || typeof product !== 'object') return product;
  if (isPreview3dEligible(product)) {
    const next = { ...product };
    delete next.preview3dAdminPreview;
    return next;
  }
  if (access.adminPreview === true && isPreview3dAdminCandidate(product)) {
    return { ...product, preview3dAdminPreview: true };
  }
  if (access.authorizedAdmin === true) return product;
  return redactPreview3dForPublicProduct(product);
}

export function emptyPreview3dDimensions() {
  return {
    width: null,
    height: null,
    depth: null,
    unit: 'inch',
    /** Explicit GLB uniform scale only — never inferred from photo openings. */
    modelScale: null,
  };
}

export function normalizePreview3dDimensions(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const base = emptyPreview3dDimensions();
  const unit = PREVIEW3D_DIMENSION_UNITS.some((row) => row.id === source.unit)
    ? source.unit
    : base.unit;
  const toPositive = (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? num : null;
  };
  const modelScaleRaw = source.modelScale;
  const modelScale = modelScaleRaw === '' || modelScaleRaw === null || modelScaleRaw === undefined
    ? null
    : (Number.isFinite(Number(modelScaleRaw)) && Number(modelScaleRaw) > 0
      ? Math.min(10, Math.max(0.05, Number(modelScaleRaw)))
      : null);
  return {
    width: toPositive(source.width),
    height: toPositive(source.height),
    depth: toPositive(source.depth),
    unit,
    modelScale,
  };
}

/** Stable Admin/customer key for a variant option (never product title). */
export function buildVariantOverrideKey(variantName, optionLabel) {
  const name = String(variantName || '').trim();
  const label = String(optionLabel || '').trim();
  if (!name || !label) return '';
  return `${name}::${label}`;
}

export function listVariantOverrideOptions(product = {}) {
  const rows = [];
  (product.variants || []).forEach((variant) => {
    const variantName = String(variant?.name || '').trim();
    if (!variantName) return;
    (variant.options || []).forEach((option) => {
      const label = String(option?.label || '').trim();
      if (!label) return;
      rows.push({
        key: buildVariantOverrideKey(variantName, label),
        variantName,
        optionLabel: label,
        previewWidth: Number(option.previewWidth) || 0,
        previewHeight: Number(option.previewHeight) || 0,
        previewUnit: option.previewUnit || 'inch',
      });
    });
  });
  return rows;
}

export function normalizeVariantOverride(row = {}) {
  const key = String(row?.key || buildVariantOverrideKey(row?.variantName, row?.optionLabel)).trim();
  if (!key) return null;
  const [variantName, ...rest] = key.split('::');
  const optionLabel = rest.join('::');
  const geometryType = PREVIEW3D_GEOMETRY_TYPES.some((g) => g.id === row.geometryType)
    ? row.geometryType
    : '';
  return {
    key,
    variantName: String(row.variantName || variantName || '').trim(),
    optionLabel: String(row.optionLabel || optionLabel || '').trim(),
    enabled: row.enabled !== false,
    geometryType,
    modelUrl: String(row.modelUrl || '').trim(),
    assetId: row.assetId ? String(row.assetId) : '',
    profileId: row.profileId ? String(row.profileId) : '',
    frameColor: String(row.frameColor || '').trim(),
    accentColor: String(row.accentColor || '').trim(),
    dimensions: normalizePreview3dDimensions(row.dimensions || {}),
  };
}

export function normalizeVariantOverrides(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  return rows
    .map((row) => normalizeVariantOverride(row))
    .filter((row) => {
      if (!row?.key || seen.has(row.key)) return false;
      seen.add(row.key);
      return true;
    });
}

/**
 * Resolve procedural / optional 3D dimensions from Admin config, then variant preview sizes,
 * then customization photo-area sizes. Never from product titles.
 */
export function resolvePreview3dDimensions({
  config,
  product,
  selectedVariantOptions = [],
} = {}) {
  const normalized = normalizePreview3dConfig(config || product?.preview3d || {});
  const explicit = normalizePreview3dDimensions(normalized.dimensions || {});
  if (explicit.width && explicit.height) {
    return {
      ...explicit,
      depth: explicit.depth || defaultDepthForGeometry(normalized.geometryType, explicit.unit),
      source: 'preview3d.dimensions',
    };
  }

  const variantWithSize = (selectedVariantOptions || []).find((option) => {
    if (Number(option?.previewWidth) > 0 && Number(option?.previewHeight) > 0) return true;
    return !!parseWxHFromLabel(option?.label || option?.value || '');
  });
  if (variantWithSize) {
    const parsed = parseWxHFromLabel(variantWithSize.label || variantWithSize.value || '');
    const width = Number(variantWithSize.previewWidth) > 0
      ? Number(variantWithSize.previewWidth)
      : parsed?.w;
    const height = Number(variantWithSize.previewHeight) > 0
      ? Number(variantWithSize.previewHeight)
      : parsed?.h;
    if (width > 0 && height > 0) {
      const unit = PREVIEW3D_DIMENSION_UNITS.some((row) => row.id === variantWithSize.previewUnit)
        ? variantWithSize.previewUnit
        : 'inch';
      return {
        width,
        height,
        depth: explicit.depth || defaultDepthForGeometry(normalized.geometryType, unit),
        unit,
        modelScale: explicit.modelScale,
        source: Number(variantWithSize.previewWidth) > 0 ? 'variant.previewSize' : 'variant.labelSize',
      };
    }
  }

  const slots = listCustomizationSlotDescriptors(product || {});
  const slot = slots.find((row) => Number(row.width) > 0 && Number(row.height) > 0) || slots[0];
  if (slot && Number(slot.width) > 0 && Number(slot.height) > 0) {
    const unit = PREVIEW3D_DIMENSION_UNITS.some((row) => row.id === slot.unit) ? slot.unit : 'inch';
    return {
      width: Number(slot.width),
      height: Number(slot.height),
      depth: explicit.depth || defaultDepthForGeometry(normalized.geometryType, unit),
      unit,
      modelScale: explicit.modelScale,
      source: 'customization.area',
    };
  }

  return {
    width: 8,
    height: 10,
    depth: defaultDepthForGeometry(normalized.geometryType, 'inch'),
    unit: 'inch',
    modelScale: explicit.modelScale,
    source: 'default',
  };
}

function defaultDepthForGeometry(geometryType, unit = 'inch') {
  if (geometryType === 'pendant') return unit === 'mm' ? 4 : unit === 'cm' ? 0.4 : 0.15;
  if (geometryType === 'cylinder') return unit === 'mm' ? 70 : unit === 'cm' ? 7 : 2.75;
  return unit === 'mm' ? 25 : unit === 'cm' ? 2.5 : 1;
}

/**
 * Convert configured physical dimensions into scene plane size (meters-normalized).
 * Preserves aspect ratio; does not stretch GLBs.
 */
export function dimensionsToSceneSize(dimensionsInput = {}, { maxSide = 1.35 } = {}) {
  const dims = normalizePreview3dDimensions(dimensionsInput);
  const unitMeta = PREVIEW3D_DIMENSION_UNITS.find((row) => row.id === dims.unit)
    || PREVIEW3D_DIMENSION_UNITS[0];
  const widthUnits = Math.max(0.05, Number(dims.width) || 1);
  const heightUnits = Math.max(0.05, Number(dims.height) || 1);
  const depthUnits = Math.max(0.02, Number(dims.depth) || defaultDepthForGeometry('single_plane', dims.unit));
  const metersPer = unitMeta.metersPerUnit;
  const widthM = widthUnits * metersPer;
  const heightM = heightUnits * metersPer;
  const depthM = depthUnits * metersPer;
  const scale = maxSide / Math.max(widthM, heightM, 1e-6);
  return {
    width: widthM * scale,
    height: heightM * scale,
    depth: Math.max(0.02, Math.min(0.45, depthM * scale)),
    aspect: widthUnits / heightUnits,
    unit: dims.unit,
    sourceWidth: widthUnits,
    sourceHeight: heightUnits,
    sourceDepth: depthUnits,
  };
}

/**
 * Merge base product preview3d with optional variant override for the current selection.
 * Does not alter pricing/stock/cart — viewer/Admin only.
 */
export function resolvePreview3dForSelection(product, selectedVariants = {}) {
  const base = normalizePreview3dConfig(product?.preview3d || {});
  const catalogRules = product?.photoFrameCatalog?.sizeRules;
  const sizeRules = sizeRulesForProduct(product, catalogRules);
  const applyPhotoFrameSize = (config) => {
    const nextPf = applyPhotoFrameSizeFromSelection(config.photoFrame, selectedVariants, sizeRules);
    if (
      nextPf.sizeRuleKey === config.photoFrame.sizeRuleKey
      && nextPf.openingWidth === config.photoFrame.openingWidth
      && nextPf.openingHeight === config.photoFrame.openingHeight
    ) {
      return config;
    }
    return normalizePreview3dConfig({
      ...config,
      photoFrame: nextPf,
      dimensions: {
        ...config.dimensions,
        width: nextPf.openingWidth || config.dimensions.width,
        height: nextPf.openingHeight || config.dimensions.height,
        depth: nextPf.depth || config.dimensions.depth,
        unit: nextPf.unit || config.dimensions.unit,
      },
    });
  };

  const overrides = normalizeVariantOverrides(base.variantOverrides || product?.preview3d?.variantOverrides || []);
  if (!overrides.length) return applyPhotoFrameSize(base);

  const selectedEntries = Object.entries(selectedVariants || {})
    .filter(([, option]) => option?.label)
    .map(([variantName, option]) => ({
      key: buildVariantOverrideKey(variantName, option.label),
      option,
    }));

  const match = overrides.find((row) => (
    row.enabled !== false
    && selectedEntries.some((entry) => entry.key === row.key)
  ));
  if (!match) return applyPhotoFrameSize(base);

  const nextGeometry = match.geometryType || base.geometryType;
  const nextModelUrl = match.modelUrl || base.modelUrl;
  const overrideDims = match.dimensions || {};
  const nextDims = normalizePreview3dDimensions({
    ...base.dimensions,
    ...Object.fromEntries(
      Object.entries(overrideDims).filter(([, value]) => value !== null && value !== undefined && value !== ''),
    ),
  });
  // Prefer selected variant photo-opening sizes when override omitted explicit 3D width/height.
  const selectedOption = selectedEntries.find((entry) => entry.key === match.key)?.option;
  if (!nextDims.width && Number(selectedOption?.previewWidth) > 0 && Number(selectedOption?.previewHeight) > 0) {
    nextDims.width = Number(selectedOption.previewWidth);
    nextDims.height = Number(selectedOption.previewHeight);
    if (selectedOption.previewUnit) nextDims.unit = selectedOption.previewUnit;
  }

  return applyPhotoFrameSize(normalizePreview3dConfig({
    ...base,
    geometryType: nextGeometry,
    modelUrl: nextModelUrl,
    assetId: match.assetId || base.assetId,
    profileId: match.profileId || base.profileId,
    frameColor: match.frameColor || base.frameColor,
    accentColor: match.accentColor || base.accentColor,
    dimensions: nextDims,
  }));
}

export function validateVariantOverrides(product, overridesInput = []) {
  const available = new Set(listVariantOverrideOptions(product).map((row) => row.key));
  const overrides = normalizeVariantOverrides(overridesInput);
  const errors = [];
  overrides.forEach((row) => {
    if (!available.has(row.key)) {
      errors.push(`Unknown variant option key: ${row.key}`);
    }
    if (row.geometryType === 'custom_glb' && !row.modelUrl && !row.assetId) {
      errors.push(`Variant ${row.key}: custom GLB override needs a model URL.`);
    }
  });
  return { ok: errors.length === 0, errors, overrides };
}

export function normalizeSurface(row = {}, index = 0) {
  const id = String(row?.id || '').trim() || `face_${index + 1}`;
  const appearance = normalizePreview3dAppearance(row?.preview3dAppearance || row?.appearance);
  return {
    id,
    label: String(row?.label || id).trim() || id,
    kind: String(row?.kind || 'plane').trim() || 'plane',
    meshName: String(row?.meshName || '').trim(),
    meshPath: String(row?.meshPath || '').trim(),
    materialName: String(row?.materialName || '').trim(),
    hasUvs: row?.hasUvs !== false,
    uvWarning: String(row?.uvWarning || '').trim(),
    preview3dAppearance: appearance,
    approximateGeometry: row?.approximateGeometry === true,
  };
}

export function emptyPreview3dLayout() {
  return {
    mode: 'auto_grid',
    columns: 0,
    gap: 0.16,
    cellScale: 0.9,
    /** Optional per-surface offsets for manual / wall arrangements. */
    positions: [],
  };
}

export function normalizePreview3dLayout(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const base = emptyPreview3dLayout();
  const mode = PREVIEW3D_LAYOUT_MODES.some((m) => m.id === source.mode) ? source.mode : base.mode;
  const positions = Array.isArray(source.positions)
    ? source.positions
      .map((row) => ({
        surfaceId: String(row?.surfaceId || '').trim(),
        x: Number(row?.x) || 0,
        y: Number(row?.y) || 0,
        z: Number(row?.z) || 0,
        scale: Math.max(0.2, Number(row?.scale) || 1),
      }))
      .filter((row) => row.surfaceId)
    : [];
  return {
    mode,
    columns: Math.max(0, Math.min(12, Number(source.columns) || 0)),
    gap: Math.max(0.02, Math.min(0.8, Number(source.gap) || base.gap)),
    cellScale: Math.max(0.35, Math.min(2, Number(source.cellScale) || base.cellScale)),
    positions,
  };
}

/**
 * Compute world positions for multi-surface arrangements from Admin layout config.
 * Uses product slot count — never hardcodes a product-specific frame count.
 */
export function computeArrangementPositions(slotCount = 1, layoutInput = {}, surfaces = []) {
  const layout = normalizePreview3dLayout(layoutInput);
  const count = Math.max(1, Number(slotCount) || 1);
  const gap = layout.gap;
  const cell = layout.cellScale;
  const bySurface = Object.fromEntries((layout.positions || []).map((p) => [p.surfaceId, p]));

  if (layout.mode === 'manual' && layout.positions.length) {
    return Array.from({ length: count }, (_, index) => {
      const surfaceId = surfaces[index]?.id || `face_${index + 1}`;
      const pos = bySurface[surfaceId];
      if (pos) {
        return { x: pos.x, y: pos.y, z: pos.z, scale: pos.scale, surfaceId };
      }
      const cols = Math.max(1, layout.columns || Math.ceil(Math.sqrt(count)));
      const col = index % cols;
      const row = Math.floor(index / cols);
      const rows = Math.ceil(count / cols);
      return {
        x: col * (cell + gap) - ((cols - 1) * (cell + gap)) / 2,
        y: ((rows - 1) * (cell + gap)) / 2 - row * (cell + gap),
        z: 0,
        scale: 1,
        surfaceId,
      };
    });
  }

  const cols = layout.mode === 'wall_row'
    ? count
    : Math.max(1, layout.columns || Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const offsetX = ((cols - 1) * (cell + gap)) / 2;
  const offsetY = ((rows - 1) * (cell + gap)) / 2;

  return Array.from({ length: count }, (_, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    const surfaceId = surfaces[index]?.id || `face_${index + 1}`;
    const manual = bySurface[surfaceId];
    return {
      x: (manual?.x ?? (col * (cell + gap) - offsetX)),
      y: (manual?.y ?? (offsetY - row * (cell + gap))),
      z: manual?.z || 0,
      scale: manual?.scale || 1,
      surfaceId,
    };
  });
}

export function emptyPreview3dConfig() {
  return {
    enabled: false,
    profileId: '',
    assetId: '',
    geometryType: 'single_plane',
    modelUrl: '',
    placeholderUrl: '',
    environment: 'studio',
    frameColor: '#f5f0e8',
    accentColor: '#8b7355',
    retailReadiness: 'prototype',
    camera: {
      minDistance: 1.2,
      maxDistance: 6,
      autoRotate: false,
      targetY: null,
    },
    dimensions: emptyPreview3dDimensions(),
    /** Optional per-variant 3D overrides keyed by variantName::optionLabel. */
    variantOverrides: [],
    layout: emptyPreview3dLayout(),
    surfaces: [],
    /** Stable slotKey → surfaceId mappings (prefer area labels / slot keys over raw indexes). */
    surfaceMappings: [],
    /** Legacy Phase 1 sequential GLB mapping — disabled once named surfaces exist. */
    legacySequentialGlb: false,
    /** Photo-frame family layer (size rules / hardware / design). */
    photoFrame: emptyPhotoFrameConfig(),
    notes: '',
  };
}

export function normalizePreview3dConfig(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const base = emptyPreview3dConfig();
  const geometryType = PREVIEW3D_GEOMETRY_TYPES.some((g) => g.id === source.geometryType)
    ? source.geometryType
    : base.geometryType;
  const environment = PREVIEW3D_ENVIRONMENTS.some((e) => e.id === source.environment)
    ? source.environment
    : base.environment;
  const mappings = Array.isArray(source.surfaceMappings)
    ? source.surfaceMappings
      .map((row) => ({
        slotKey: String(row?.slotKey || '').trim(),
        surfaceId: String(row?.surfaceId || '').trim(),
        areaLabel: String(row?.areaLabel || '').trim(),
      }))
      .filter((row) => row.slotKey && row.surfaceId)
    : [];
  const surfaces = Array.isArray(source.surfaces)
    ? source.surfaces.map((row, index) => normalizeSurface(row, index)).filter((row) => row.id)
    : [];
  const targetYRaw = source.camera?.targetY;
  const targetY = targetYRaw === '' || targetYRaw === null || targetYRaw === undefined
    ? null
    : (Number.isFinite(Number(targetYRaw)) ? Number(targetYRaw) : null);

  return {
    enabled: source.enabled === true,
    profileId: source.profileId ? String(source.profileId) : '',
    assetId: source.assetId ? String(source.assetId) : '',
    geometryType,
    modelUrl: String(source.modelUrl || '').trim(),
    placeholderUrl: String(source.placeholderUrl || '').trim(),
    environment,
    frameColor: String(source.frameColor || base.frameColor).trim() || base.frameColor,
    accentColor: String(source.accentColor || base.accentColor).trim() || base.accentColor,
    retailReadiness: normalizeRetailReadiness(source.retailReadiness),
    camera: {
      minDistance: Math.max(0.2, Number(source.camera?.minDistance) || base.camera.minDistance),
      maxDistance: Math.max(2, Number(source.camera?.maxDistance) || base.camera.maxDistance),
      autoRotate: source.camera?.autoRotate === true,
      targetY,
    },
    dimensions: normalizePreview3dDimensions(source.dimensions || base.dimensions),
    variantOverrides: normalizeVariantOverrides(source.variantOverrides || []),
    layout: normalizePreview3dLayout(source.layout || base.layout),
    surfaces,
    surfaceMappings: mappings,
    legacySequentialGlb: source.legacySequentialGlb === true,
    photoFrame: normalizePhotoFrameConfig(source.photoFrame || base.photoFrame),
    notes: String(source.notes || '').slice(0, 500),
  };
}

/**
 * Stable 3D slot key for a customization area.
 * Prefer explicit area id/key when present; otherwise use array index
 * (PreviewAreaSchema stores {_id:false} — index is the durable PDP identity).
 * Legacy label keys remain readable via resolveMappedSurfaceId for old configs.
 */
export function buildAreaSlotKey(index, area = {}) {
  const explicit = String(area?.id || area?.key || area?.slotKey || '').trim();
  if (explicit) return `area:id:${explicit}`;
  return `area:index:${Number(index) || 0}`;
}

export function buildLegacyAreaSlotKey(label) {
  const text = String(label || '').trim();
  return text ? `area:${text}` : '';
}

/** Resolve surface id with index keys first, then legacy label keys, then positional fallback. */
export function resolveMappedSurfaceId(slot, mappingBySlot = {}, surfaces = [], index = 0) {
  const byIndex = mappingBySlot[slot?.slotKey];
  if (byIndex) return byIndex;
  const legacy = slot?.legacySlotKey && mappingBySlot[slot.legacySlotKey];
  if (legacy) return legacy;
  return surfaces[index]?.id || `face_${index + 1}`;
}

function variantOpeningSize(option = {}) {
  const parsed = parseWxHFromLabel(option?.label || option?.value || '');
  const width = Number(option?.previewWidth) > 0 ? Number(option.previewWidth) : (parsed?.w || 0);
  const height = Number(option?.previewHeight) > 0 ? Number(option.previewHeight) : (parsed?.h || 0);
  return { width, height, unit: option?.previewUnit || 'inch' };
}

/**
 * Live 3D slots: product photo areas when configured, otherwise the currently
 * selected variant upload option(s). Never expands the global 19-size catalog.
 */
export function listViewerSlotDescriptors(product = {}, selectedVariants = {}) {
  const configured = listCustomizationSlotDescriptors(product);
  const variantSlots = Object.values(selectedVariants || {})
    .filter((option) => option?.requiresImageUpload && option?.label)
    .map((option, index) => {
      const size = variantOpeningSize(option);
      const label = String(option.label).trim();
      return {
        slotKey: `variant:${label}`,
        legacySlotKey: buildLegacyAreaSlotKey(label),
        areaLabel: label,
        index,
        labelCollision: false,
        source: 'variant',
        variantLabel: label,
        adjustmentKey: `variant-${label}`,
        width: size.width,
        height: size.height,
        unit: size.unit,
      };
    });
  if (configured.length) {
    return configured.map((slot, index) => ({
      ...slot,
      source: slot.source || 'area',
      adjustmentKey: slot.index,
      index,
    }));
  }
  return variantSlots;
}

export function photoForViewerSlot(slot, {
  customerPhotos = [],
  variantLabelUploads = {},
  index = 0,
} = {}) {
  if (slot?.source === 'variant' && slot.variantLabel) {
    return variantLabelUploads?.[slot.variantLabel] || null;
  }
  return customerPhotos[slot?.index] || customerPhotos[index] || null;
}

/** Build stable slot descriptors from existing product customization config (source of truth). */
export function listCustomizationSlotDescriptors(product = {}) {
  const preview = product?.customizationPreview || {};
  const areas = Array.isArray(preview.areas)
    ? preview.areas.filter((area) => area?.requiresImageUpload !== false)
    : [];
  if (areas.length) {
    const labelCounts = {};
    areas.forEach((area, index) => {
      const label = String(area.label || `Photo ${index + 1}`).trim() || `Photo ${index + 1}`;
      labelCounts[label] = (labelCounts[label] || 0) + 1;
    });
    return areas.map((area, index) => {
      const label = String(area.label || `Photo ${index + 1}`).trim() || `Photo ${index + 1}`;
      return {
        slotKey: buildAreaSlotKey(index, area),
        legacySlotKey: buildLegacyAreaSlotKey(label),
        areaLabel: label,
        index,
        labelCollision: (labelCounts[label] || 0) > 1,
        width: Number(area.width) || 0,
        height: Number(area.height) || 0,
        unit: area.unit || 'inch',
      };
    });
  }
  const count = Math.max(
    Number(preview.requiredImageCount) || 0,
    Number(preview.maxImageCount) || 0,
  );
  return Array.from({ length: count }, (_, index) => ({
    slotKey: `slot:${index}`,
    legacySlotKey: '',
    areaLabel: `Photo ${index + 1}`,
    index,
    labelCollision: false,
    width: 0,
    height: 0,
    unit: 'inch',
  }));
}

/** Default surface list for a geometry + configured slot count. */
export function buildSurfacesForGeometry(geometryType, slotCount = 1, existingSurfaces = []) {
  const meta = PREVIEW3D_GEOMETRY_TYPES.find((g) => g.id === geometryType);
  if (!meta) return [];
  if (geometryType === 'custom_glb') {
    return Array.isArray(existingSurfaces)
      ? existingSurfaces.map((row, index) => normalizeSurface(row, index))
      : [];
  }
  if (geometryType === 'multi_grid') {
    const n = Math.max(1, Number(slotCount) || 1);
    return Array.from({ length: n }, (_, index) => ({
      id: `face_${index + 1}`,
      label: `Frame ${index + 1}`,
      kind: 'plane',
      meshName: '',
      meshPath: '',
      materialName: '',
      hasUvs: true,
      uvWarning: '',
    }));
  }
  return (meta.defaultSurfaces || []).map((s, index) => normalizeSurface(s, index));
}

/**
 * Prefer customer photo URLs (no double frame) for 3D mesh textures.
 * finalPreviewImage often already composites frame overlays — skip when possible.
 * Live blob/data URLs are allowed only as a session fallback so the viewer is not blank
 * before durable upload URLs exist.
 *
 * Prefer crop-accurate baked textures from preview3dCropTexture when available.
 */
export function pickTextureUrlForSlot(slotPhoto, previewEntry) {
  const fromPhoto = pickDurableImageUrl(slotPhoto);
  if (fromPhoto) return { url: fromPhoto, source: 'customer_photo' };
  const live = pickLiveImageUrl(slotPhoto);
  if (live) return { url: live, source: 'live_preview' };
  const composed = pickDurableImageUrl(previewEntry?.finalPreviewImage);
  if (composed) return { url: composed, source: 'final_preview' };
  return { url: '', source: 'empty' };
}

export function pickDurableImageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const url = value.trim();
    if (!url || url.startsWith('blob:') || url.startsWith('data:')) return '';
    return url;
  }
  if (typeof value === 'object') {
    const candidates = [
      value.displayUrl,
      value.url,
      value.originalUrl,
      value.previewUrl,
    ];
    for (const candidate of candidates) {
      const url = String(candidate || '').trim();
      if (url && !url.startsWith('blob:') && !url.startsWith('data:')) return url;
    }
  }
  return '';
}

/** Session-only blob/data URLs for in-progress uploads (never persisted). */
export function pickLiveImageUrl(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const url = value.trim();
    return (url.startsWith('blob:') || url.startsWith('data:')) ? url : '';
  }
  if (typeof value === 'object') {
    const candidates = [value.previewUrl, value.displayUrl, value.url];
    for (const candidate of candidates) {
      const url = String(candidate || '').trim();
      if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    }
  }
  return '';
}

/**
 * Build viewer texture list for N configured slots from live PDP state.
 * Synchronous fallback — prefer buildCropAccurateViewerTextures in the modal.
 */
export function buildViewerTextureSlots({
  product,
  preview3d,
  customerPhotos = [],
  variantLabelUploads = {},
  selectedVariants = {},
  customizationPreviewPayload = null,
} = {}) {
  const slots = listViewerSlotDescriptors(product, selectedVariants);
  const config = normalizePreview3dConfig(preview3d || {});
  const surfaces = buildSurfacesForGeometry(config.geometryType, Math.max(1, slots.length), config.surfaces);
  const mappingBySlot = Object.fromEntries(
    (config.surfaceMappings || []).map((row) => [row.slotKey, row.surfaceId]),
  );
  const previews = Array.isArray(customizationPreviewPayload?.previews)
    ? customizationPreviewPayload.previews
    : [];
  const surfaceById = Object.fromEntries(surfaces.map((s) => [s.id, s]));

  return slots.map((slot, index) => {
    const photo = photoForViewerSlot(slot, { customerPhotos, variantLabelUploads, index });
    // Prefer index-aligned preview entries; label match is ambiguous when labels collide.
    const previewEntry = previews[index]
      || previews.find((p) => String(p.areaLabel || '') === slot.areaLabel)
      || previews.find((p) => String(p.areaLabel || '') === `Variant: ${slot.areaLabel}`)
      || null;
    const texture = pickTextureUrlForSlot(photo, previewEntry);
    const mappedSurface = resolveMappedSurfaceId(slot, mappingBySlot, surfaces, index);
    const surface = surfaceById[mappedSurface] || surfaces[index] || null;
    return {
      ...slot,
      surfaceId: mappedSurface,
      meshName: surface?.meshName || '',
      meshPath: surface?.meshPath || '',
      materialName: surface?.materialName || '',
      textureUrl: texture.url,
      textureSource: texture.source,
      isPlaceholder: !texture.url,
      placeholderUrl: config.placeholderUrl || '',
      parity: texture.url ? 'sync_uncropped_fallback' : 'placeholder',
      aspect: {
        width: Number(slot.width) || 1,
        height: Number(slot.height) || 1,
      },
    };
  });
}

/**
 * Customer-facing eligibility. Admin live stage ignores this and always previews when configured.
 * approved_retail is required for live retail; isolated staging may allow prototypes for QA.
 */
export function isPreview3dEligible(product) {
  const config = normalizePreview3dConfig(product?.preview3d || {});
  if (!config.enabled) return false;
  if (config.geometryType === 'custom_glb' && !config.modelUrl) return false;
  return true;
}

/** Admin checklist / gate helpers (does not change commerce). */
export function getPreview3dRetailGate(configInput = {}) {
  const config = normalizePreview3dConfig(configInput);
  const status = PREVIEW3D_RETAIL_STATUSES.find((row) => row.id === config.retailReadiness)
    || PREVIEW3D_RETAIL_STATUSES[0];
  const warnings = [];
  if (config.enabled && config.geometryType === 'custom_glb' && !config.modelUrl) {
    warnings.push('Custom GLB is enabled but no model file is selected.');
  }
  if (config.enabled && config.geometryType !== 'custom_glb') {
    warnings.push('Procedural geometry is a visual reference — not a substitute for the 2D customization sent to cart.');
  }
  const surfacesApprox = (config.surfaces || []).filter((s) => s.approximateGeometry);
  if (surfacesApprox.length) {
    warnings.push(`${surfacesApprox.length} surface(s) marked approximate — rear/hidden detail may not be physically accurate.`);
  }
  return {
    status,
    customerVisible: isPreview3dEligible({ preview3d: config }),
    warnings,
  };
}

export function resolvePreview3dSurfaces(product, preview3d) {
  const config = normalizePreview3dConfig(preview3d || {});
  const slots = listCustomizationSlotDescriptors(product);
  return buildSurfacesForGeometry(config.geometryType, slots.length, config.surfaces);
}

/**
 * Detect mapping drift when customization areas are reordered, added, or removed.
 * Index keys (area:index:N) are stable only while area array order is preserved.
 * Never silently remaps by label when labels collide or order changes.
 */
export function analyzeSlotMappingStability({
  previousAreas = null,
  product,
  preview3d,
} = {}) {
  const config = normalizePreview3dConfig(preview3d || {});
  const slots = listCustomizationSlotDescriptors(product);
  const warnings = [];
  const errors = [];
  const mappings = config.surfaceMappings || [];

  if (mappings.length && mappings.length !== slots.length) {
    warnings.push(
      `Saved 3D mappings (${mappings.length}) do not match current photo slots (${slots.length}). Re-check slot → surface mapping after area add/remove.`,
    );
  }

  const mappedIndexKeys = mappings
    .map((row) => row.slotKey)
    .filter((key) => /^area:index:\d+$/.test(key));
  mappedIndexKeys.forEach((key) => {
    if (!slots.some((slot) => slot.slotKey === key)) {
      errors.push(`Stale index mapping ${key} no longer matches a customization area.`);
    }
  });

  if (Array.isArray(previousAreas) && previousAreas.length) {
    const prevLabels = previousAreas.map((area, index) => (
      String(area?.label || `Photo ${index + 1}`).trim() || `Photo ${index + 1}`
    ));
    const nextLabels = slots.map((slot) => slot.areaLabel);
    const sameMultiset = [...prevLabels].sort().join('\0') === [...nextLabels].sort().join('\0');
    const sameOrder = prevLabels.length === nextLabels.length
      && prevLabels.every((label, index) => label === nextLabels[index]);
    if (sameMultiset && !sameOrder) {
      warnings.push(
        'Customization areas appear reordered. Index-based 3D mappings follow array order — confirm each photo still maps to the intended 3D surface.',
      );
    }
    if (prevLabels.length !== nextLabels.length) {
      warnings.push(
        `Photo area count changed (${prevLabels.length} → ${nextLabels.length}). Review 3D surface mappings before enabling.`,
      );
    }
  }

  const legacyOnly = mappings.filter((row) => /^area:(?!index:|id:)/.test(row.slotKey));
  if (legacyOnly.length) {
    warnings.push(
      'Some mappings still use legacy label keys. Prefer area:index:N keys so duplicate labels cannot collide.',
    );
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    slots,
    fingerprint: slots.map((slot) => `${slot.slotKey}|${slot.areaLabel}`).join(';'),
  };
}

export function validateSurfaceMappings(product, preview3d, { previousAreas = null } = {}) {
  const config = normalizePreview3dConfig(preview3d || {});
  const slots = listCustomizationSlotDescriptors(product);
  const surfaces = resolvePreview3dSurfaces(product, config);
  const surfaceIds = new Set(surfaces.map((s) => s.id));
  const slotKeys = new Set(slots.map((s) => s.slotKey));
  const errors = [];
  const warnings = [];
  const usedSurfaces = new Set();

  if (config.geometryType === 'custom_glb') {
    if (!config.modelUrl) errors.push('Custom GLB requires a model URL');
    if (!surfaces.length && !config.legacySequentialGlb) {
      warnings.push('No named surfaces selected yet. Inspect the GLB and assign photo surfaces.');
    }
  }

  const colliding = slots.filter((slot) => slot.labelCollision);
  if (colliding.length) {
    const names = [...new Set(colliding.map((slot) => slot.areaLabel))];
    warnings.push(
      `Duplicate customization labels (${names.join(', ')}). 3D mapping uses stable index keys; verify each slot maps to the intended surface.`,
    );
  }

  const stability = analyzeSlotMappingStability({ previousAreas, product, preview3d: config });
  errors.push(...stability.errors);
  warnings.push(...stability.warnings);

  const legacyKeys = new Set(
    slots.map((slot) => slot.legacySlotKey).filter(Boolean),
  );

  (config.surfaceMappings || []).forEach((row) => {
    const known = slotKeys.has(row.slotKey) || legacyKeys.has(row.slotKey);
    if (!known) errors.push(`Unknown slot mapping: ${row.slotKey}`);
    if (surfaceIds.size && !surfaceIds.has(row.surfaceId)) {
      errors.push(`Unknown surface: ${row.surfaceId}`);
    }
    if (usedSurfaces.has(row.surfaceId)) errors.push(`Duplicate surface mapping: ${row.surfaceId}`);
    usedSurfaces.add(row.surfaceId);
    const surface = surfaces.find((s) => s.id === row.surfaceId);
    if (surface?.hasUvs === false) {
      warnings.push(`Surface "${surface.label || surface.id}" may lack UV coordinates.`);
    }
  });

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    warnings: [...new Set(warnings)],
    slots,
    surfaces,
    fingerprint: stability.fingerprint,
  };
}
