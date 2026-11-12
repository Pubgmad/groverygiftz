/**
 * Photo-frame family layer on top of Universal 3D.
 * Admin-managed size rules, hardware profiles, and design profiles.
 * Does not replace PhotoAdjuster / preview3dCropTexture.
 */

export const PHOTO_FRAME_FIDELITY = {
  OWNER_CONFIRMED: 'owner_confirmed',
  VISUALLY_VERIFIED: 'visually_verified',
  APPROXIMATE: 'approximate',
  UNVERIFIED: 'unverified',
};

/**
 * Versioned manufacturing construction defaults.
 * Openings, borders, and hardware membership come from DEFAULT_PHOTO_FRAME_SIZE_RULES.
 * Depths are APPROXIMATE visual construction — not tape-verified CAD. Do not edit from Admin.
 */
export const PHOTO_FRAME_MANUFACTURING_SPEC = {
  version: '1.0.0',
  unit: 'inch',
  depth: 0.35,
  innerMouldingDepth: 0.08,
  rearBackingThickness: 0.12,
  depthFidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE,
  borderFidelity: PHOTO_FRAME_FIDELITY.OWNER_CONFIRMED,
};

/** Owner-confirmed 19 size keys (W×H label convention). Membership is explicit — not range math. */
export const DEFAULT_PHOTO_FRAME_SIZE_RULES = [
  // Group A — 0.5" border
  { key: '4x4', label: '4 × 4', nominalWidth: 4, nominalHeight: 4, borderWidth: 0.5, borderGroup: 'A', hardwareProfileKey: 'hw_small_stand', orientation: 'square' },
  { key: '6x4', label: '6 × 4', nominalWidth: 6, nominalHeight: 4, borderWidth: 0.5, borderGroup: 'A', hardwareProfileKey: 'hw_small_stand', orientation: 'landscape' },
  { key: '5x7', label: '5 × 7', nominalWidth: 5, nominalHeight: 7, borderWidth: 0.5, borderGroup: 'A', hardwareProfileKey: 'hw_small_stand', orientation: 'portrait' },
  { key: '8x6', label: '8 × 6', nominalWidth: 8, nominalHeight: 6, borderWidth: 0.5, borderGroup: 'A', hardwareProfileKey: 'hw_small_stand', orientation: 'landscape' },
  // Group B — 1" border
  { key: '10x8', label: '10 × 8', nominalWidth: 10, nominalHeight: 8, borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_small_medium_hook_stand', orientation: 'landscape' },
  { key: '12x8', label: '12 × 8', nominalWidth: 12, nominalHeight: 8, borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_small_medium_hook_stand', orientation: 'landscape' },
  { key: '12x10', label: '12 × 10', nominalWidth: 12, nominalHeight: 10, borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_medium_hook_bushes', orientation: 'landscape' },
  { key: '10x10', label: '10 × 10', nominalWidth: 10, nominalHeight: 10, borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_medium_hook_bushes', orientation: 'square' },
  { key: '12x15', label: '12 × 15', nominalWidth: 12, nominalHeight: 15, borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_medium_hook_bushes', orientation: 'portrait' },
  { key: '12x18', label: '12 × 18', nominalWidth: 12, nominalHeight: 18, borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_medium_hook_bushes', orientation: 'portrait' },
  { key: '15x15', label: '15 × 15', nominalWidth: 15, nominalHeight: 15, borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_medium_hook_bushes', orientation: 'square' },
  // Group C — 2" border
  { key: '16x20', label: '16 × 20', nominalWidth: 16, nominalHeight: 20, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'portrait' },
  { key: '12x24', label: '12 × 24', nominalWidth: 12, nominalHeight: 24, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'portrait' },
  { key: '16x24', label: '16 × 24', nominalWidth: 16, nominalHeight: 24, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'portrait' },
  { key: '18x24', label: '18 × 24', nominalWidth: 18, nominalHeight: 24, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'portrait' },
  { key: '20x20', label: '20 × 20', nominalWidth: 20, nominalHeight: 20, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'square' },
  { key: '20x24', label: '20 × 24', nominalWidth: 20, nominalHeight: 24, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'portrait' },
  { key: '30x20', label: '30 × 20', nominalWidth: 30, nominalHeight: 20, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'landscape' },
  { key: '24x36', label: '24 × 36', nominalWidth: 24, nominalHeight: 36, borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes', orientation: 'portrait' },
];

/**
 * Four hardware profiles — membership is the sizeRuleKeys list (explicit).
 * Component toggles follow owner specs; millimetre sizes are APPROXIMATE.
 */
export const DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES = [
  {
    key: 'hw_small_stand',
    name: 'Small frames — rear stand',
    description: 'Group 1: rear support stand. No separate top hooks / bottom bushes unless overridden.',
    sizeRuleKeys: ['4x4', '6x4', '5x7', '8x6'],
    referenceImage: 'Temp/photo-frame-3d/references/small-frame-back.jpg',
    components: {
      stand: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      centerHook: { enabled: false, fidelity: PHOTO_FRAME_FIDELITY.OWNER_CONFIRMED },
      leftHook: { enabled: false },
      rightHook: { enabled: false },
      leftBush: { enabled: false },
      rightBush: { enabled: false },
      backingPanel: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
    },
  },
  {
    key: 'hw_small_medium_hook_stand',
    name: 'Small/medium — center hook + stand',
    description: 'Group 2: one top-center hanging hook + rear support stand.',
    sizeRuleKeys: ['10x8', '12x8'],
    referenceImage: 'Temp/photo-frame-3d/references/medium-frame-back.jpg',
    components: {
      stand: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      centerHook: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      leftHook: { enabled: false },
      rightHook: { enabled: false },
      leftBush: { enabled: false },
      rightBush: { enabled: false },
      backingPanel: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
    },
  },
  {
    key: 'hw_medium_hook_bushes',
    name: 'Medium — center hook + dual bushes',
    description: 'Group 3: top-center hook + bottom-left/right bushes. No stand.',
    sizeRuleKeys: ['12x10', '10x10', '12x15', '12x18', '15x15'],
    referenceImage: 'Temp/photo-frame-3d/references/medium-frame-back.jpg',
    components: {
      stand: { enabled: false, fidelity: PHOTO_FRAME_FIDELITY.OWNER_CONFIRMED },
      centerHook: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      leftHook: { enabled: false },
      rightHook: { enabled: false },
      leftBush: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE },
      rightBush: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE },
      backingPanel: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
    },
  },
  {
    key: 'hw_large_dual_hooks_bushes',
    name: 'Large — dual hooks + dual bushes',
    description: 'Group 4: top-left/right hooks + bottom-left/right bushes. No stand. Includes 12×24 via explicit membership.',
    sizeRuleKeys: ['16x20', '12x24', '16x24', '18x24', '20x20', '20x24', '30x20', '24x36'],
    referenceImage: 'Temp/photo-frame-3d/references/large-frame-back.jpg',
    components: {
      stand: { enabled: false, fidelity: PHOTO_FRAME_FIDELITY.OWNER_CONFIRMED },
      centerHook: { enabled: false },
      leftHook: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      rightHook: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      leftBush: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      rightBush: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
      backingPanel: { enabled: true, fidelity: PHOTO_FRAME_FIDELITY.VISUALLY_VERIFIED },
    },
  },
];

/**
 * Reusable moulding construction — not a scan of decorative botanical relief.
 * `sculpted: false` means stepped boxes; never advertise as carved geometry.
 */
export const PHOTO_FRAME_MOULDING_PROFILES = [
  { key: 'stepped', label: 'Stepped 4-rail moulding', sculpted: false },
  { key: 'beveled', label: 'Beveled 4-rail moulding', sculpted: false },
  { key: 'flat', label: 'Flat 4-rail bar', sculpted: false },
];

/** Design-level customer gate. Schema-valid is not customer-facing. */
export const PHOTO_FRAME_CUSTOMER_READINESS = [
  { id: 'draft', label: 'Draft' },
  { id: 'validation_required', label: 'Validation required' },
  { id: 'approved', label: 'Approved for customers' },
];

export const DEFAULT_PHOTO_FRAME_DESIGN_PROFILES = [
  {
    key: 'design_matte_black_procedural',
    name: 'Matte black procedural moulding',
    description: 'Reusable parametric frame body for every catalog size. Not a decorative botanical twin.',
    mode: 'procedural',
    frameColor: '#1a1a1a',
    accentColor: '#2a2a2a',
    material: { roughness: 0.72, metalness: 0.08 },
    modelUrl: '',
    fidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE,
    compatibleSizeKeys: [],
    lockedSizeKey: '',
    mouldingProfileKey: 'stepped',
    customerReadiness: 'validation_required',
  },
  {
    key: 'design_espresso_procedural',
    name: 'Espresso procedural moulding',
    description: 'Dark wood-tone parametric moulding scaled from size-rule openings and borders.',
    mode: 'procedural',
    frameColor: '#3a2418',
    accentColor: '#2a1810',
    material: { roughness: 0.88, metalness: 0.04 },
    modelUrl: '',
    fidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE,
    compatibleSizeKeys: [],
    lockedSizeKey: '',
    mouldingProfileKey: 'stepped',
    customerReadiness: 'validation_required',
  },
  {
    key: 'design_custom_glb',
    name: 'Custom GLB (product-specific)',
    description: 'Use Admin-uploaded / assigned GLB for unique decorative borders. Prefer PhotoPlane mapping.',
    mode: 'custom_glb',
    frameColor: '#3a2418',
    accentColor: '#2a1810',
    material: { roughness: 0.9, metalness: 0.05 },
    modelUrl: '',
    fidelity: PHOTO_FRAME_FIDELITY.UNVERIFIED,
    compatibleSizeKeys: [],
    lockedSizeKey: '',
    mouldingProfileKey: '',
    customerReadiness: 'draft',
  },
  {
    key: 'design_realistic_5x7_pilot',
    name: 'Realistic 5×7 pilot (catalog front + owner rear)',
    description: 'Reusable design profile pointing at the realistic 5×7 pilot GLB. Contains rear stand — set glbContainsHardware when assigned. Not retail-approved.',
    mode: 'custom_glb',
    frameColor: '#3a2418',
    accentColor: '#2a1810',
    material: { roughness: 0.9, metalness: 0.05 },
    modelUrl: '/media/preview3d/models/photo-frame-realistic-5x7-pilot.glb',
    fidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE,
    notes: 'Pilot only — do not auto-apply to other sizes. GLB embeds Group-1 stand.',
    compatibleSizeKeys: ['5x7'],
    lockedSizeKey: '5x7',
    mouldingProfileKey: '',
    customerReadiness: 'validation_required',
  },
  {
    key: 'design_premium_5x7',
    name: 'Premium 5×7 (owner wood rear + botanical front)',
    description: 'Premium 5×7 GLB with owner-photo wood backing crop and Group-1 stand. Wall preview hides stand. Not auto-applied to other sizes.',
    mode: 'custom_glb',
    frameColor: '#3a2418',
    accentColor: '#2a1810',
    material: { roughness: 0.9, metalness: 0.05 },
    modelUrl: '/media/preview3d/models/photo-frame-premium-5x7.glb',
    fidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE,
    notes: 'Admin borderWidth 0.5\" is size-rule inset; decorative moulding ~1.2\" is a separate visual feature. GLB embeds hardware.',
    wallPreviewEligible: true,
    arEligible: true,
    compatibleSizeKeys: ['5x7'],
    lockedSizeKey: '5x7',
    mouldingProfileKey: '',
    customerReadiness: 'validation_required',
  },
];

function numOrNull(v) {
  if (v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function numOr(v, fallback) {
  const n = numOrNull(v);
  return n == null ? fallback : n;
}

export function emptyPhotoFrameConfig() {
  return {
    enabled: false,
    sizeRuleKey: '',
    designProfileKey: 'design_matte_black_procedural',
    hardwareProfileKey: '',
    nominalWidth: null,
    nominalHeight: null,
    openingWidth: null,
    openingHeight: null,
    borderLeft: null,
    borderRight: null,
    borderTop: null,
    borderBottom: null,
    outerWidth: null,
    outerHeight: null,
    depth: null,
    innerMouldingDepth: null,
    rearBackingThickness: null,
    mouldingProfileKey: '',
    unit: 'inch',
    orientation: 'auto',
    outerDimsVerified: false,
    /**
     * When geometryType=custom_glb and photoFrame.enabled:
     * attach procedural backside hardware to the loaded GLB rear face (bounds-based).
     * Default false — preserves prior custom_glb-only behaviour.
     */
    attachProceduralHardware: false,
    /** Admin declares GLB already contains rear hardware — forces attach off. */
    glbContainsHardware: false,
    /** When attaching to custom_glb, default false to avoid double backing panels. */
    includeProceduralBacking: false,
    hardwareOverrides: {
      stand: null,
      centerHook: null,
      leftHook: null,
      rightHook: null,
      leftBush: null,
      rightBush: null,
      backingPanel: null,
    },
    notes: '',
  };
}

export function normalizeHardwareOverrides(input = {}) {
  const keys = ['stand', 'centerHook', 'leftHook', 'rightHook', 'leftBush', 'rightBush', 'backingPanel'];
  const out = {};
  keys.forEach((k) => {
    if (input[k] === true || input[k] === false) out[k] = input[k];
    else out[k] = null;
  });
  return out;
}

export function normalizePhotoFrameConfig(input = {}) {
  const base = emptyPhotoFrameConfig();
  const src = input && typeof input === 'object' ? input : {};
  return {
    ...base,
    enabled: Boolean(src.enabled),
    sizeRuleKey: String(src.sizeRuleKey || '').trim(),
    designProfileKey: String(src.designProfileKey || base.designProfileKey).trim(),
    hardwareProfileKey: String(src.hardwareProfileKey || '').trim(),
    nominalWidth: numOrNull(src.nominalWidth),
    nominalHeight: numOrNull(src.nominalHeight),
    openingWidth: numOrNull(src.openingWidth),
    openingHeight: numOrNull(src.openingHeight),
    borderLeft: numOrNull(src.borderLeft),
    borderRight: numOrNull(src.borderRight),
    borderTop: numOrNull(src.borderTop),
    borderBottom: numOrNull(src.borderBottom),
    outerWidth: numOrNull(src.outerWidth),
    outerHeight: numOrNull(src.outerHeight),
    depth: numOrNull(src.depth),
    innerMouldingDepth: numOrNull(src.innerMouldingDepth),
    rearBackingThickness: numOrNull(src.rearBackingThickness),
    mouldingProfileKey: String(src.mouldingProfileKey || '').trim(),
    unit: ['inch', 'cm', 'mm'].includes(src.unit) ? src.unit : 'inch',
    orientation: ['auto', 'portrait', 'landscape', 'square'].includes(src.orientation)
      ? src.orientation
      : 'auto',
    outerDimsVerified: Boolean(src.outerDimsVerified),
    attachProceduralHardware: Boolean(src.attachProceduralHardware),
    glbContainsHardware: Boolean(src.glbContainsHardware),
    includeProceduralBacking: Boolean(src.includeProceduralBacking),
    hardwareOverrides: normalizeHardwareOverrides(src.hardwareOverrides || {}),
    notes: String(src.notes || '').slice(0, 500),
  };
}

/**
 * Whether procedural backside hardware should be composed onto a custom_glb.
 * Fail closed: never attach when Admin marks GLB as already containing hardware.
 */
export function shouldAttachProceduralHardware(photoFrameInput = {}, geometryType = '') {
  const pf = normalizePhotoFrameConfig(photoFrameInput);
  if (geometryType !== 'custom_glb') return false;
  if (!pf.enabled) return false;
  if (pf.glbContainsHardware) return false;
  return pf.attachProceduralHardware === true;
}

export function findSizeRule(rules, key) {
  const k = String(key || '').trim().toLowerCase();
  return (rules || []).find((r) => String(r.key || '').toLowerCase() === k) || null;
}

export function findHardwareProfile(profiles, key) {
  const k = String(key || '').trim();
  return (profiles || []).find((p) => p.key === k) || null;
}

export function findDesignProfile(profiles, key) {
  const k = String(key || '').trim();
  return (profiles || []).find((p) => p.key === k) || null;
}

export function resolveMouldingProfileKey(key, fallback = 'stepped') {
  const k = String(key || '').trim();
  if (PHOTO_FRAME_MOULDING_PROFILES.some((row) => row.key === k)) return k;
  return fallback;
}

export function normalizeCustomerReadiness(value) {
  const id = String(value || '').trim();
  return PHOTO_FRAME_CUSTOMER_READINESS.some((row) => row.id === id) ? id : 'draft';
}

export function parseWxHFromLabel(label) {
  const raw = String(label || '').toLowerCase().replace(/×/g, 'x');
  const match = raw.match(/(\d+(?:\.\d+)?)\s*[x*]\s*(\d+(?:\.\d+)?)/);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

/**
 * Exact catalog-key match only. Never swap 30×20 → 20×30.
 */
export function inferSizeRuleKeyFromLabel(label, sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES) {
  const parsed = parseWxHFromLabel(label);
  if (!parsed) return '';
  const exact = `${parsed.w}x${parsed.h}`.toLowerCase();
  const keys = new Set((sizeRules || []).map((rule) => String(rule.key || '').toLowerCase()));
  return keys.has(exact) ? exact : '';
}

export function inferSizeRuleKeyFromSelection(selectedVariants = {}, sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES) {
  const keys = new Set((sizeRules || []).map((rule) => String(rule.key || '').toLowerCase()));
  const entries = Object.entries(selectedVariants || {});
  for (const [name, option] of entries) {
    const width = Number(option?.previewWidth);
    const height = Number(option?.previewHeight);
    if (width > 0 && height > 0) {
      const fromDims = `${width}x${height}`.toLowerCase();
      if (keys.has(fromDims)) return fromDims;
    }
    const blob = `${name} ${option?.label || ''} ${option?.value || ''}`;
    const fromLabel = inferSizeRuleKeyFromLabel(blob, sizeRules);
    if (fromLabel) return fromLabel;
  }
  return '';
}

function pickBorderForOpening(width, height) {
  const longest = Math.max(Number(width) || 0, Number(height) || 0);
  if (longest <= 8) return { borderWidth: 0.5, borderGroup: 'A', hardwareProfileKey: 'hw_small_stand' };
  if (longest <= 15) return { borderWidth: 1, borderGroup: 'B', hardwareProfileKey: 'hw_medium_hook_bushes' };
  return { borderWidth: 2, borderGroup: 'C', hardwareProfileKey: 'hw_large_dual_hooks_bushes' };
}

/**
 * Product-selected opening from the chosen variant — not the 19-size catalog.
 * Never swaps axes (36×24 stays 36×24 even if only 24x36 exists in the catalog).
 */
export function resolveOpeningFromSelection(selectedVariants = {}, sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES) {
  const rules = Array.isArray(sizeRules) && sizeRules.length ? sizeRules : DEFAULT_PHOTO_FRAME_SIZE_RULES;
  const entries = Object.entries(selectedVariants || {});
  for (const [name, option] of entries) {
    const parsed = parseWxHFromLabel(`${name} ${option?.label || ''} ${option?.value || ''}`);
    const width = Number(option?.previewWidth) > 0 ? Number(option.previewWidth) : parsed?.w;
    const height = Number(option?.previewHeight) > 0 ? Number(option.previewHeight) : parsed?.h;
    if (!(width > 0 && height > 0)) continue;
    const sizeRuleKey = `${width}x${height}`.toLowerCase();
    return {
      width,
      height,
      sizeRuleKey,
      rule: findSizeRule(rules, sizeRuleKey) || null,
    };
  }
  return null;
}

/**
 * Size keys this product actually sells (variant labels / previewWidth×Height).
 * Never treats the global 19-size catalog as the product's selectable list.
 */
export function collectProductSizeKeys(product) {
  const keys = new Set();
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  for (const variant of variants) {
    const options = Array.isArray(variant?.options) ? variant.options : [];
    for (const option of options) {
      const parsed = parseWxHFromLabel(`${variant?.name || ''} ${option?.label || ''} ${option?.value || ''}`);
      const width = Number(option?.previewWidth) > 0 ? Number(option.previewWidth) : parsed?.w;
      const height = Number(option?.previewHeight) > 0 ? Number(option.previewHeight) : parsed?.h;
      if (width > 0 && height > 0) keys.add(`${width}x${height}`.toLowerCase());
    }
  }
  return keys;
}

function syntheticSizeRule(key) {
  const [w, h] = String(key).split('x').map(Number);
  const border = pickBorderForOpening(w, h);
  return {
    key,
    label: `${w} × ${h}`,
    nominalWidth: w,
    nominalHeight: h,
    borderWidth: border.borderWidth,
    borderGroup: border.borderGroup,
    hardwareProfileKey: border.hardwareProfileKey,
    orientation: w === h ? 'square' : (w > h ? 'landscape' : 'portrait'),
  };
}

/**
 * Geometry lookup for one product: only sizes that product sells.
 * Catalog/default 19-size table remains a lookup, not a picker.
 */
export function sizeRulesForProduct(product, catalogRules) {
  const pool = Array.isArray(catalogRules) && catalogRules.length
    ? catalogRules
    : DEFAULT_PHOTO_FRAME_SIZE_RULES;
  const allowed = collectProductSizeKeys(product);
  if (!allowed.size) return pool;
  const matched = pool.filter((rule) => allowed.has(String(rule.key || '').toLowerCase()));
  const matchedKeys = new Set(matched.map((rule) => String(rule.key || '').toLowerCase()));
  const synthetic = [...allowed]
    .filter((key) => !matchedKeys.has(key))
    .map(syntheticSizeRule);
  return [...matched, ...synthetic];
}

export function applyPhotoFrameSizeFromSelection(
  photoFrameInput,
  selectedVariants = {},
  sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES,
) {
  const pf = normalizePhotoFrameConfig(photoFrameInput);
  if (!pf.enabled) return pf;
  const rules = Array.isArray(sizeRules) && sizeRules.length ? sizeRules : DEFAULT_PHOTO_FRAME_SIZE_RULES;
  const opening = resolveOpeningFromSelection(selectedVariants, rules);
  if (!opening) return pf;
  if (opening.rule) {
    if (
      opening.rule.key === pf.sizeRuleKey
      && Number(pf.openingWidth) === opening.width
      && Number(pf.openingHeight) === opening.height
    ) {
      return pf;
    }
    return applySizeRuleToPhotoFrame(pf, opening.rule, { force: true });
  }
  const border = pickBorderForOpening(opening.width, opening.height);
  const synthetic = {
    key: opening.sizeRuleKey,
    label: `${opening.width} × ${opening.height}`,
    nominalWidth: opening.width,
    nominalHeight: opening.height,
    borderWidth: border.borderWidth,
    borderGroup: border.borderGroup,
    hardwareProfileKey: border.hardwareProfileKey,
    orientation: opening.width === opening.height
      ? 'square'
      : (opening.height > opening.width ? 'portrait' : 'landscape'),
  };
  return applySizeRuleToPhotoFrame(pf, synthetic, { force: true });
}

/**
 * Resolve effective photo-frame dimensions from Admin config + size rule.
 * Outer = opening + borders when borders known. Never claim verified unless flagged.
 */
export function resolvePhotoFrameDimensions(photoFrameInput = {}, sizeRule = null) {
  const pf = normalizePhotoFrameConfig(photoFrameInput);
  const rule = sizeRule || null;

  const nominalWidth = numOr(pf.nominalWidth, rule?.nominalWidth ?? null);
  const nominalHeight = numOr(pf.nominalHeight, rule?.nominalHeight ?? null);

  // Catalog nominal is the manufacturing opening. Variant-driven synthetic rules still flow through `rule`.
  const openingWidth = rule?.nominalWidth != null ? Number(rule.nominalWidth) : numOr(pf.openingWidth, nominalWidth);
  const openingHeight = rule?.nominalHeight != null ? Number(rule.nominalHeight) : numOr(pf.openingHeight, nominalHeight);

  const defaultBorder = numOr(rule?.borderWidth, 0.5);
  // Manufacturing lock: catalog borders and spec depths win over stored Admin numeric overrides.
  const borderLeft = defaultBorder;
  const borderRight = defaultBorder;
  const borderTop = defaultBorder;
  const borderBottom = defaultBorder;

  const computedOuterWidth = openingWidth != null ? openingWidth + borderLeft + borderRight : null;
  const computedOuterHeight = openingHeight != null ? openingHeight + borderTop + borderBottom : null;

  const outerWidth = computedOuterWidth;
  const outerHeight = computedOuterHeight;

  const depth = PHOTO_FRAME_MANUFACTURING_SPEC.depth;
  const innerMouldingDepth = PHOTO_FRAME_MANUFACTURING_SPEC.innerMouldingDepth;
  const rearBackingThickness = PHOTO_FRAME_MANUFACTURING_SPEC.rearBackingThickness;
  const mouldingProfileKey = resolveMouldingProfileKey(pf.mouldingProfileKey);

  let orientation = pf.orientation;
  if (orientation === 'auto' && openingWidth != null && openingHeight != null) {
    if (Math.abs(openingWidth - openingHeight) < 0.01) orientation = 'square';
    else orientation = openingWidth > openingHeight ? 'landscape' : 'portrait';
  }

  return {
    unit: pf.unit || rule?.unit || 'inch',
    nominalWidth,
    nominalHeight,
    openingWidth,
    openingHeight,
    borderLeft,
    borderRight,
    borderTop,
    borderBottom,
    outerWidth,
    outerHeight,
    computedOuterWidth,
    computedOuterHeight,
    depth,
    innerMouldingDepth,
    rearBackingThickness,
    mouldingProfileKey,
    orientation,
    outerDimsVerified: Boolean(pf.outerDimsVerified),
    borderFidelity: PHOTO_FRAME_FIDELITY.OWNER_CONFIRMED,
    depthFidelity: PHOTO_FRAME_FIDELITY.APPROXIMATE,
    manufacturingSpecVersion: PHOTO_FRAME_MANUFACTURING_SPEC.version,
    sizeRuleKey: pf.sizeRuleKey || rule?.key || '',
  };
}

export function resolveHardwareComponents(hardwareProfile, overrides = {}) {
  const base = hardwareProfile?.components || {};
  const ov = normalizeHardwareOverrides(overrides);
  const keys = ['stand', 'centerHook', 'leftHook', 'rightHook', 'leftBush', 'rightBush', 'backingPanel'];
  const resolved = {};
  keys.forEach((k) => {
    const defEnabled = Boolean(base[k]?.enabled);
    resolved[k] = {
      enabled: ov[k] == null ? defEnabled : ov[k],
      fidelity: base[k]?.fidelity || PHOTO_FRAME_FIDELITY.APPROXIMATE,
    };
  });
  return resolved;
}

/**
 * Apply size-rule defaults onto a photoFrame config (Admin “select size rule”).
 * Does not wipe explicit Admin overrides already set unless `force` is true.
 */
export function applySizeRuleToPhotoFrame(photoFrameInput, sizeRule, { force = false } = {}) {
  const pf = normalizePhotoFrameConfig(photoFrameInput);
  if (!sizeRule) return pf;
  const next = { ...pf, enabled: true, sizeRuleKey: sizeRule.key };
  const set = (field, value) => {
    if (force || next[field] == null) next[field] = value;
  };
  set('nominalWidth', sizeRule.nominalWidth);
  set('nominalHeight', sizeRule.nominalHeight);
  set('openingWidth', sizeRule.openingWidth ?? sizeRule.nominalWidth);
  set('openingHeight', sizeRule.openingHeight ?? sizeRule.nominalHeight);
  set('borderLeft', sizeRule.borderWidth);
  set('borderRight', sizeRule.borderWidth);
  set('borderTop', sizeRule.borderWidth);
  set('borderBottom', sizeRule.borderWidth);
  set('orientation', sizeRule.orientation || 'auto');
  set('unit', sizeRule.unit || 'inch');
  if (force || !next.hardwareProfileKey) {
    next.hardwareProfileKey = sizeRule.hardwareProfileKey || '';
  }
  const dims = resolvePhotoFrameDimensions(next, sizeRule);
  next.outerWidth = dims.outerWidth;
  next.outerHeight = dims.outerHeight;
  return normalizePhotoFrameConfig(next);
}

/** Build validation matrix rows for all default size rules. */
export function buildSizeHardwareMatrix(sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES, hardwareProfiles = DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES) {
  return sizeRules.map((rule) => {
    const hw = findHardwareProfile(hardwareProfiles, rule.hardwareProfileKey);
    const dims = resolvePhotoFrameDimensions(
      applySizeRuleToPhotoFrame(emptyPhotoFrameConfig(), rule, { force: true }),
      rule,
    );
    const membersOk = hw ? (hw.sizeRuleKeys || []).includes(rule.key) : false;
    return {
      sizeKey: rule.key,
      borderWidth: rule.borderWidth,
      borderGroup: rule.borderGroup,
      hardwareProfileKey: rule.hardwareProfileKey,
      membershipExplicit: membersOk,
      openingWidth: dims.openingWidth,
      openingHeight: dims.openingHeight,
      outerWidth: dims.outerWidth,
      outerHeight: dims.outerHeight,
      components: hw ? resolveHardwareComponents(hw) : null,
    };
  });
}

export function assertNineteenSizeRules(sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES) {
  const keys = sizeRules.map((r) => r.key);
  const unique = new Set(keys);
  return {
    count: keys.length,
    unique: unique.size,
    ok: keys.length === 19 && unique.size === 19,
    keys,
  };
}

export function designCompatibleSizeKeys(design = null) {
  const listed = Array.isArray(design?.compatibleSizeKeys)
    ? design.compatibleSizeKeys.map((key) => String(key || '').trim().toLowerCase()).filter(Boolean)
    : [];
  return [...new Set(listed)];
}

/**
 * Decorative GLBs that are authored for one opening size must not be scaled onto another.
 * Explicit lockedSizeKey / compatibleSizeKeys win. Regex is a legacy fallback only.
 */
export function lockedSizeKeyForDesign(design = null) {
  const explicit = String(design?.lockedSizeKey || '').trim().toLowerCase();
  if (explicit) return explicit;
  const listed = designCompatibleSizeKeys(design);
  if (listed.length === 1) return listed[0];
  if (design?.mode === 'procedural' && !design?.modelUrl) return null;
  const key = String(design?.key || '');
  const url = String(design?.modelUrl || '');
  const notes = `${key} ${url} ${design?.notes || ''}`;
  if (/5x7/i.test(notes)) return '5x7';
  return null;
}

export function assertDesignCompatibleWithSize(design, sizeRuleKey) {
  const size = String(sizeRuleKey || '').trim().toLowerCase();
  const listed = designCompatibleSizeKeys(design);
  const lock = lockedSizeKeyForDesign(design);
  const procedural = design?.mode !== 'custom_glb' && !design?.modelUrl;

  if (procedural) {
    return { ok: true, lockedTo: null, reason: '', geometry: 'procedural' };
  }
  if (listed.length) {
    if (listed.includes(size)) {
      return { ok: true, lockedTo: lock, reason: '', geometry: 'custom_glb' };
    }
    return {
      ok: false,
      lockedTo: lock || listed.join(', '),
      geometry: 'procedural',
      reason: `${design?.name || design?.key || 'This decorative model'} is compatible with ${listed.join(', ')} and will not be stretched onto ${size || 'another size'}. A parametric frame is shown instead.`,
    };
  }
  if (!lock) {
    return { ok: true, lockedTo: null, reason: '', geometry: design?.modelUrl ? 'custom_glb' : 'procedural' };
  }
  if (size === lock) {
    return { ok: true, lockedTo: lock, reason: '', geometry: 'custom_glb' };
  }
  return {
    ok: false,
    lockedTo: lock,
    geometry: 'procedural',
    reason: `${design?.name || design?.key || 'This decorative model'} is authored for ${lock} and will not be stretched onto ${size || 'another size'}. A parametric frame is shown instead.`,
  };
}

export function formatPhotoFrameDimensionChip(resolved) {
  if (!resolved) return '';
  const unit = resolved.unit === 'inch' ? 'in' : (resolved.unit || 'in');
  const openW = resolved.openingWidth;
  const openH = resolved.openingHeight;
  const outerW = resolved.outerWidth;
  const outerH = resolved.outerHeight;
  if (!(openW > 0) || !(openH > 0)) return '';
  const open = `Photo ${openW} × ${openH} ${unit}`;
  if (outerW > 0 && outerH > 0) {
    const scaleNote = resolved.outerDimsVerified ? 'outer verified' : 'outer illustrative';
    return `${open} · Outer ${outerW} × ${outerH} ${unit} · ${scaleNote}`;
  }
  return open;
}

export function evaluatePhotoFrameAdminGate({
  photoFrame,
  design = null,
  sizeRuleKey = '',
  retailReadiness = 'prototype',
} = {}) {
  const pf = normalizePhotoFrameConfig(photoFrame || {});
  const warnings = [];
  const blockers = [];
  if (!pf.enabled) {
    return { ok: true, blockers, warnings, customerReady: false };
  }
  const sizeKey = pf.sizeRuleKey || String(sizeRuleKey || '').trim();
  if (!sizeKey) {
    warnings.push('No size rule selected. Customer size variants can still infer a catalog key at runtime.');
  }
  const compat = assertDesignCompatibleWithSize(design, sizeKey);
  if (!compat.ok) warnings.push(compat.reason);
  if (design?.mode === 'custom_glb' && !String(design?.modelUrl || '').trim()) {
    blockers.push('Custom GLB design has no model URL.');
  }
  const readiness = normalizeCustomerReadiness(design?.customerReadiness);
  if (readiness !== 'approved') {
    warnings.push(`Design "${design?.name || design?.key || pf.designProfileKey}" is ${readiness} — passing schema checks does not enable it for customers.`);
  }
  if (!pf.outerDimsVerified) {
    warnings.push('Outer dimensions are computed from opening + borders, not tape-verified.');
  }
  if (retailReadiness === 'approved_retail' && readiness !== 'approved') {
    blockers.push('Product retail status is Approved but the assigned design profile is not approved.');
  }
  if (retailReadiness === 'approved_retail' && !compat.ok) {
    blockers.push('Cannot treat this configuration as retail-approved while the decorative GLB is size-incompatible.');
  }
  return {
    ok: blockers.length === 0,
    blockers,
    warnings,
    customerReady: blockers.length === 0
      && readiness === 'approved'
      && retailReadiness === 'approved_retail',
  };
}

/**
 * Single runtime bundle for the customer viewer and admin live stage.
 * Applies the selected size variant, then refuses to stretch a size-locked GLB.
 */
export function resolvePhotoFrameRuntime({
  preview3d = {},
  selectedVariants = {},
  sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES,
  hardwareProfiles = DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
  designProfiles = DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
} = {}) {
  const geometryType = preview3d.geometryType || '';
  let pf = normalizePhotoFrameConfig(preview3d.photoFrame || {});
  pf = applyPhotoFrameSizeFromSelection(pf, selectedVariants, sizeRules);
  if (geometryType !== 'photo_frame' && !pf.enabled) {
    return {
      photoFrame: pf,
      resolved: null,
      hardware: null,
      material: null,
      frameColor: preview3d.frameColor,
      accentColor: preview3d.accentColor,
      attachProceduralHardware: false,
      includeProceduralBacking: false,
      glbContainsHardware: false,
      glbCompat: { ok: true, lockedTo: null, reason: '', geometry: geometryType },
      effectiveGeometryType: geometryType,
      mouldingProfileKey: 'stepped',
      fidelityNotice: '',
      design: null,
    };
  }

  const sizeRule = findSizeRule(sizeRules, pf.sizeRuleKey);
  const hwKey = pf.hardwareProfileKey || sizeRule?.hardwareProfileKey || '';
  const hwProfile = findHardwareProfile(hardwareProfiles, hwKey);
  const design = findDesignProfile(designProfiles, pf.designProfileKey);
  const glbCompat = assertDesignCompatibleWithSize(design, pf.sizeRuleKey || sizeRule?.key);
  const mouldingProfileKey = resolveMouldingProfileKey(
    pf.mouldingProfileKey || design?.mouldingProfileKey,
  );
  const resolved = resolvePhotoFrameDimensions({ ...pf, mouldingProfileKey }, sizeRule);
  const hwOverrides = { ...pf.hardwareOverrides };
  if (
    shouldAttachProceduralHardware(pf, geometryType)
    && !pf.includeProceduralBacking
    && hwOverrides.backingPanel == null
  ) {
    hwOverrides.backingPanel = false;
  }
  const useGlb = geometryType === 'custom_glb' && glbCompat.ok && !!preview3d.modelUrl;
  const effectiveGeometryType = useGlb
    ? 'custom_glb'
    : (pf.enabled || geometryType === 'photo_frame')
      ? 'photo_frame'
      : geometryType;
  const moulding = PHOTO_FRAME_MOULDING_PROFILES.find((row) => row.key === mouldingProfileKey);
  let fidelityNotice = '';
  if (!glbCompat.ok) {
    fidelityNotice = glbCompat.reason;
  } else if (effectiveGeometryType === 'photo_frame') {
    fidelityNotice = `Parametric ${moulding?.label || 'frame'} scaled from catalog opening and borders. Not sculpted decorative relief.`;
  }
  return {
    photoFrame: pf,
    resolved,
    hardware: resolveHardwareComponents(hwProfile, hwOverrides),
    material: design?.material || null,
    frameColor: design?.frameColor || preview3d.frameColor,
    accentColor: design?.accentColor || preview3d.accentColor,
    attachProceduralHardware: shouldAttachProceduralHardware(pf, geometryType),
    includeProceduralBacking: pf.includeProceduralBacking === true,
    glbContainsHardware: pf.glbContainsHardware === true,
    glbCompat,
    effectiveGeometryType,
    mouldingProfileKey,
    fidelityNotice,
    design,
  };
}

export function buildDesignCoverageMatrix({
  sizeRules = DEFAULT_PHOTO_FRAME_SIZE_RULES,
  designProfiles = DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  hardwareProfiles = DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
} = {}) {
  const sizeMatrix = buildSizeHardwareMatrix(sizeRules, hardwareProfiles);
  return sizeRules.map((rule) => {
    const sizeRow = sizeMatrix.find((row) => row.sizeKey === rule.key) || {};
    const designs = (designProfiles || []).map((design) => {
      const compat = assertDesignCompatibleWithSize(design, rule.key);
      const usesGlb = design.mode === 'custom_glb' && !!design.modelUrl && compat.ok;
      return {
        designKey: design.key,
        designName: design.name,
        geometry: usesGlb ? 'custom_glb' : 'procedural',
        compatible: design.mode !== 'custom_glb' || !design.modelUrl || compat.ok,
        stretchBlocked: !!(design.modelUrl && !compat.ok),
        mouldingProfileKey: usesGlb ? '' : resolveMouldingProfileKey(design.mouldingProfileKey),
        fidelity: design.fidelity || PHOTO_FRAME_FIDELITY.APPROXIMATE,
        customerReadiness: normalizeCustomerReadiness(design.customerReadiness),
        visuallyApproved: false,
        physicallyVerified: false,
      };
    });
    return {
      sizeKey: rule.key,
      label: rule.label,
      orientation: rule.orientation,
      borderGroup: rule.borderGroup,
      borderWidth: rule.borderWidth,
      hardwareProfileKey: rule.hardwareProfileKey,
      openingWidth: sizeRow.openingWidth,
      openingHeight: sizeRow.openingHeight,
      outerWidth: sizeRow.outerWidth,
      outerHeight: sizeRow.outerHeight,
      membershipExplicit: sizeRow.membershipExplicit,
      designs,
      parametricReady: designs.some((row) => row.geometry === 'procedural' && row.compatible),
      decorativeGlbReady: designs.filter((row) => row.geometry === 'custom_glb').map((row) => row.designKey),
    };
  });
}
