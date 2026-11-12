/**
 * Isolated mapping check for the 19 photo-frame size rules.
 * Does not touch production data. Run: node scripts/verify-photo-frame-size-mappings.mjs
 */
import {
  DEFAULT_PHOTO_FRAME_DESIGN_PROFILES,
  DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
  DEFAULT_PHOTO_FRAME_SIZE_RULES,
  PHOTO_FRAME_MANUFACTURING_SPEC,
  applyPhotoFrameSizeFromSelection,
  applySizeRuleToPhotoFrame,
  assertDesignCompatibleWithSize,
  assertNineteenSizeRules,
  buildDesignCoverageMatrix,
  buildSizeHardwareMatrix,
  emptyPhotoFrameConfig,
  evaluatePhotoFrameAdminGate,
  findDesignProfile,
  inferSizeRuleKeyFromLabel,
  resolvePhotoFrameDimensions,
  resolvePhotoFrameRuntime,
  sizeRulesForProduct,
} from '../src/lib/photoFrame3d.js';

const expectedKeys = [
  '4x4', '6x4', '5x7', '8x6',
  '10x8', '12x8', '12x10', '10x10', '12x15', '12x18', '15x15',
  '16x20', '12x24', '16x24', '18x24', '20x20', '20x24', '30x20', '24x36',
];

const nineteen = assertNineteenSizeRules(DEFAULT_PHOTO_FRAME_SIZE_RULES);
const matrix = buildSizeHardwareMatrix(
  DEFAULT_PHOTO_FRAME_SIZE_RULES,
  DEFAULT_PHOTO_FRAME_HARDWARE_PROFILES,
);
const missing = expectedKeys.filter((key) => !nineteen.keys.includes(key));
const extra = nineteen.keys.filter((key) => !expectedKeys.includes(key));
const membershipFails = matrix.filter((row) => !row.membershipExplicit);
const dimFails = matrix.filter((row) => {
  const pf = applySizeRuleToPhotoFrame(emptyPhotoFrameConfig(), DEFAULT_PHOTO_FRAME_SIZE_RULES.find((r) => r.key === row.sizeKey), { force: true });
  const dims = resolvePhotoFrameDimensions(pf, DEFAULT_PHOTO_FRAME_SIZE_RULES.find((r) => r.key === row.sizeKey));
  return !(dims.openingWidth > 0 && dims.openingHeight > 0 && dims.outerWidth > dims.openingWidth && dims.outerHeight > dims.openingHeight);
});

const premium = findDesignProfile(DEFAULT_PHOTO_FRAME_DESIGN_PROFILES, 'design_premium_5x7');
const stretchGuard = {
  on5x7: assertDesignCompatibleWithSize(premium, '5x7'),
  on12x18: assertDesignCompatibleWithSize(premium, '12x18'),
};

const groups = { A: 0, B: 0, C: 0 };
matrix.forEach((row) => { groups[row.borderGroup] = (groups[row.borderGroup] || 0) + 1; });

const ok = nineteen.ok
  && missing.length === 0
  && extra.length === 0
  && membershipFails.length === 0
  && dimFails.length === 0
  && stretchGuard.on5x7.ok
  && !stretchGuard.on12x18.ok
  && groups.A === 4
  && groups.B === 7
  && groups.C === 8;

if (inferSizeRuleKeyFromLabel('5 × 7') !== '5x7') throw new Error('label 5 × 7 must map to 5x7');
if (inferSizeRuleKeyFromLabel('5*7 inch') !== '5x7') throw new Error('catalog labels using * must map to 5x7');
if (inferSizeRuleKeyFromLabel('12x18 inch') !== '12x18') throw new Error('label 12x18 must map');
if (inferSizeRuleKeyFromLabel('30 × 20') !== '30x20') throw new Error('30×20 must stay 30x20');
if (inferSizeRuleKeyFromLabel('20 × 30') !== '') throw new Error('20×30 must not silently swap onto 30x20');

const from36 = applyPhotoFrameSizeFromSelection(
  { enabled: true, sizeRuleKey: '5x7' },
  { Size: { label: '36*24 inch', previewWidth: 0, previewHeight: 0 } },
);
if (from36.sizeRuleKey !== '36x24') throw new Error(`36×24 product must stay 36x24, got ${from36.sizeRuleKey}`);
if (from36.openingWidth !== 36 || from36.openingHeight !== 24) {
  throw new Error('36×24 must not be swapped onto 24×36');
}

const from2030 = applyPhotoFrameSizeFromSelection(
  { enabled: true, sizeRuleKey: '5x7' },
  { Size: { label: '20 × 30' } },
);
if (from2030.openingWidth !== 20 || from2030.openingHeight !== 30) {
  throw new Error('20×30 must render 20×30, not swap onto 30×20');
}

const matte = findDesignProfile(DEFAULT_PHOTO_FRAME_DESIGN_PROFILES, 'design_matte_black_procedural');
if (!assertDesignCompatibleWithSize(matte, '24x36').ok) throw new Error('procedural matte must cover 24x36');

const switched = applyPhotoFrameSizeFromSelection(
  { enabled: true, sizeRuleKey: '5x7', designProfileKey: 'design_premium_5x7' },
  { Size: { label: '12 × 18', previewWidth: 12, previewHeight: 18 } },
);
if (switched.sizeRuleKey !== '12x18') throw new Error(`variant size switch failed, got ${switched.sizeRuleKey}`);
if (switched.openingWidth !== 12 || switched.openingHeight !== 18) throw new Error('opening must follow 12x18 rule');

const runtime12 = resolvePhotoFrameRuntime({
  preview3d: {
    geometryType: 'custom_glb',
    modelUrl: '/media/preview3d/models/photo-frame-premium-5x7.glb',
    photoFrame: { enabled: true, sizeRuleKey: '5x7', designProfileKey: 'design_premium_5x7' },
  },
  selectedVariants: { Size: { label: '12 × 18', previewWidth: 12, previewHeight: 18 } },
});
if (runtime12.effectiveGeometryType !== 'photo_frame') throw new Error('12x18 must not stretch the 5x7 GLB');
if (runtime12.resolved?.sizeRuleKey !== '12x18') throw new Error('runtime must apply 12x18 size rule');
if (runtime12.mouldingProfileKey !== 'stepped') throw new Error('procedural fallback should use stepped moulding');

const runtime5 = resolvePhotoFrameRuntime({
  preview3d: {
    geometryType: 'custom_glb',
    modelUrl: '/media/preview3d/models/photo-frame-premium-5x7.glb',
    photoFrame: { enabled: true, sizeRuleKey: '5x7', designProfileKey: 'design_premium_5x7' },
  },
  selectedVariants: { Size: { label: '5 × 7', previewWidth: 5, previewHeight: 7 } },
});
if (runtime5.effectiveGeometryType !== 'custom_glb') throw new Error('5x7 premium GLB must remain available on 5x7');

const coverage = buildDesignCoverageMatrix();
if (coverage.length !== 19) throw new Error('coverage matrix must include 19 sizes');
if (!coverage.every((row) => row.parametricReady)) throw new Error('every size must have parametric coverage');
if (coverage.filter((row) => row.decorativeGlbReady.includes('design_premium_5x7')).length !== 1) {
  throw new Error('premium GLB must remain 5x7-only');
}

const gate = evaluatePhotoFrameAdminGate({
  photoFrame: { enabled: true, sizeRuleKey: '5x7', designProfileKey: 'design_premium_5x7' },
  design: premium,
  retailReadiness: 'approved_retail',
});
if (gate.customerReady) throw new Error('schema + retail flag must not auto-approve an unapproved design');

const decorativeCoverage = DEFAULT_PHOTO_FRAME_SIZE_RULES.map((rule) => {
  const stretch = assertDesignCompatibleWithSize(premium, rule.key);
  return {
    size: rule.key,
    orientation: rule.orientation || '',
    borderGroup: rule.borderGroup,
    hardware: rule.hardwareProfileKey,
    proceduralGeometry: true,
    premium5x7Glb: stretch.ok,
    extraDecorativeGlbRequired: !stretch.ok,
  };
});

const report = {
  ok,
  nineteen,
  missing,
  extra,
  borderGroups: groups,
  membershipFails: membershipFails.map((r) => r.sizeKey),
  dimFails: dimFails.map((r) => r.sizeKey),
  stretchGuard,
  coverage: coverage.map((row) => ({
    size: row.sizeKey,
    opening: `${row.openingWidth}x${row.openingHeight}`,
    outer: `${row.outerWidth}x${row.outerHeight}`,
    parametricReady: row.parametricReady,
    decorativeGlbReady: row.decorativeGlbReady,
    visuallyApproved: false,
    physicallyVerified: false,
  })),
  decorativeCoverage,
  proceduralEligibleAll19: decorativeCoverage.every((row) => row.proceduralGeometry),
  decorativeGlbReady: decorativeCoverage.filter((row) => row.premium5x7Glb).map((row) => row.size),
  decorativeGlbGaps: decorativeCoverage.filter((row) => row.extraDecorativeGlbRequired).map((row) => row.size),
  rows: matrix.map((row) => ({
    size: row.sizeKey,
    border: row.borderWidth,
    group: row.borderGroup,
    hardware: row.hardwareProfileKey,
    opening: `${row.openingWidth}x${row.openingHeight}`,
    outer: `${row.outerWidth}x${row.outerHeight}`,
    membership: row.membershipExplicit,
    orientation: DEFAULT_PHOTO_FRAME_SIZE_RULES.find((r) => r.key === row.sizeKey)?.orientation || '',
  })),
};

const productARules = sizeRulesForProduct({
  variants: [{ name: 'Size', options: [{ label: '5*7 inch' }] }],
});
const productBRules = sizeRulesForProduct({
  variants: [{ name: 'Size', options: [{ label: '36*24 inch' }, { label: '12*15 inch' }] }],
});
if (productARules.length !== 1 || productARules[0].key !== '5x7') {
  throw new Error(`product A must expose only 5x7, got ${productARules.map((r) => r.key).join(',')}`);
}
if (!productBRules.some((r) => r.key === '36x24') || productBRules.some((r) => r.key === '5x7' || r.key === '24x36')) {
  throw new Error('product B must keep 36×24/12×15 without leaking 5×7 or swapping onto 24×36');
}

if (PHOTO_FRAME_MANUFACTURING_SPEC.version !== '1.0.0') {
  throw new Error('manufacturing spec version must be explicit and versioned');
}

const staleAdmin = resolvePhotoFrameDimensions({
  enabled: true,
  sizeRuleKey: '5x7',
  openingWidth: 5,
  openingHeight: 7,
  borderLeft: 9,
  borderRight: 9,
  borderTop: 9,
  borderBottom: 9,
  depth: 12,
  rearBackingThickness: 4,
  outerWidth: 99,
  outerHeight: 99,
}, DEFAULT_PHOTO_FRAME_SIZE_RULES.find((r) => r.key === '5x7'));
if (staleAdmin.borderLeft !== 0.5 || staleAdmin.borderRight !== 0.5) {
  throw new Error('Admin numeric border overrides must not change manufacturing borders');
}
if (staleAdmin.depth !== PHOTO_FRAME_MANUFACTURING_SPEC.depth) {
  throw new Error('Admin depth overrides must not change manufacturing depth');
}
if (staleAdmin.rearBackingThickness !== PHOTO_FRAME_MANUFACTURING_SPEC.rearBackingThickness) {
  throw new Error('Admin backing overrides must not change manufacturing backing');
}
if (staleAdmin.openingWidth !== 5 || staleAdmin.openingHeight !== 7) {
  throw new Error('5x7 catalog opening must remain 5×7');
}
if (staleAdmin.outerWidth !== 6 || staleAdmin.outerHeight !== 8) {
  throw new Error('5x7 outer must be opening plus group A 0.5" borders');
}
if (staleAdmin.manufacturingSpecVersion !== PHOTO_FRAME_MANUFACTURING_SPEC.version) {
  throw new Error('resolved dims must carry manufacturing spec version');
}

const aspectRows = DEFAULT_PHOTO_FRAME_SIZE_RULES.map((rule) => {
  const dims = resolvePhotoFrameDimensions(emptyPhotoFrameConfig(), rule);
  const openingAspect = dims.openingWidth / dims.openingHeight;
  const expectedAspect = rule.nominalWidth / rule.nominalHeight;
  const outerExpectedW = rule.nominalWidth + (rule.borderWidth * 2);
  const outerExpectedH = rule.nominalHeight + (rule.borderWidth * 2);
  return {
    key: rule.key,
    openingAspect,
    expectedAspect,
    aspectOk: Math.abs(openingAspect - expectedAspect) < 1e-9,
    outerOk: dims.outerWidth === outerExpectedW && dims.outerHeight === outerExpectedH,
    orientationOk: (rule.orientation === 'landscape' && dims.openingWidth > dims.openingHeight)
      || (rule.orientation === 'portrait' && dims.openingHeight > dims.openingWidth)
      || (rule.orientation === 'square' && dims.openingWidth === dims.openingHeight),
  };
});
if (aspectRows.some((row) => !row.aspectOk || !row.outerOk || !row.orientationOk)) {
  throw new Error(`aspect/outer/orientation failed: ${JSON.stringify(aspectRows.filter((r) => !r.aspectOk || !r.outerOk || !r.orientationOk))}`);
}

const fiveSeven = aspectRows.find((r) => r.key === '5x7');
const sixEight = aspectRows.find((r) => r.key === '8x6');
const tenEight = aspectRows.find((r) => r.key === '10x8');
const twelveFifteen = aspectRows.find((r) => r.key === '12x15');
const twentyFourThirtySix = aspectRows.find((r) => r.key === '24x36');
if (Math.abs(fiveSeven.openingAspect - (5 / 7)) > 1e-9) throw new Error('5x7 aspect drifted');
if (Math.abs(sixEight.openingAspect - (8 / 6)) > 1e-9) throw new Error('8x6 must not reuse 5x7 aspect');
if (Math.abs(tenEight.openingAspect - (10 / 8)) > 1e-9) throw new Error('10x8 aspect drifted');
if (Math.abs(twelveFifteen.openingAspect - (12 / 15)) > 1e-9) throw new Error('12x15 aspect drifted');
if (Math.abs(twentyFourThirtySix.openingAspect - (24 / 36)) > 1e-9) throw new Error('24x36 aspect drifted');
if (Math.abs(fiveSeven.openingAspect - twentyFourThirtySix.openingAspect) < 0.01) {
  throw new Error('5x7 must not share 24x36 aspect by coincidence in this catalog');
}

report.manufacturingLock = {
  version: PHOTO_FRAME_MANUFACTURING_SPEC.version,
  staleAdminIgnored: true,
  aspectRows: aspectRows.map((row) => ({ size: row.key, aspect: row.openingAspect })),
};

console.log(JSON.stringify(report, null, 2));
if (!ok) process.exit(1);
