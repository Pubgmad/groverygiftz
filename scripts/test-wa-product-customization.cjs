/**
 * Regression checks for WA product customization resolution.
 * Run: node scripts/test-wa-product-customization.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const configSrc = fs.readFileSync(path.join(__dirname, '../src/lib/websiteProductPhotoConfig.js'), 'utf8');
const sectionSrc = fs.readFileSync(path.join(__dirname, '../src/components/admin/WhatsAppOrderProductSection.js'), 'utf8');
const comboSrc = fs.readFileSync(path.join(__dirname, '../src/lib/customizedCombo.js'), 'utf8');
const apiSrc = fs.readFileSync(path.join(__dirname, '../src/app/api/admin/customized-combo/route.js'), 'utf8');
const modalSrc = fs.readFileSync(path.join(__dirname, '../src/components/admin/CreateWhatsAppOrderModal.js'), 'utf8');
const orderModelSrc = fs.readFileSync(path.join(__dirname, '../src/models/Order.js'), 'utf8');
const ordersRouteSrc = fs.readFileSync(path.join(__dirname, '../src/app/api/admin/orders/route.js'), 'utf8');

// Resolver must gate areas on preview.enabled and keep file fields alongside
assert.ok(configSrc.includes('if (preview.enabled)'));
assert.ok(configSrc.includes('buildFileFieldSlots'));
assert.ok(configSrc.includes('getCollageTemplates'));
assert.ok(configSrc.includes('selectedVariantValue'));
assert.ok(configSrc.includes('storageKind'));
assert.ok(configSrc.includes('buildCollageUploadsPayload'));

// UI must show collage uploads + original section + product/component on combo rows
assert.ok(sectionSrc.includes('CollageUploadSection'));
assert.ok(sectionSrc.includes('Original Product Details'));
assert.ok(sectionSrc.includes('Exclude for this order only'));
assert.ok(sectionSrc.includes('Product / component'));
assert.ok(sectionSrc.includes('Additional Variants'));
assert.ok(sectionSrc.includes('Custom Variant — This Order Only'));
assert.ok(sectionSrc.includes('+ Add Text Field'));
assert.ok(sectionSrc.includes('ORDER_LOCAL_CUSTOM_VARIANT'));
assert.ok(sectionSrc.includes('listAdditionalVariantChoices'));
assert.ok(sectionSrc.includes('Select variant / size'));
assert.ok(!sectionSrc.includes('This product has no configured variants to add'));
assert.ok(!sectionSrc.includes('Done — Generate'));
assert.ok(!sectionSrc.includes('Done-Generate'));
assert.ok(configSrc.includes('buildOrderLocalCustomVariantSlots'));
assert.ok(configSrc.includes('ORDER_LOCAL_CUSTOM_VARIANT'));
assert.ok(configSrc.includes('listAdditionalVariantChoices'));
assert.ok(configSrc.includes('listAreaDerivedSizeOptions'));
assert.ok(configSrc.includes('AreaSize:'));

// Combo must not mutate 13×20 into products
assert.ok(comboSrc.includes('return false'));
assert.ok(!comboSrc.includes('sizeVariant.options.push'));
assert.ok(!apiSrc.includes('ensureThirteenByTwenty(product)'));
assert.ok(apiSrc.includes('whatsappComboProductId'));

// Persistence fields
assert.ok(orderModelSrc.includes('excludedCustomizationSlots'));
assert.ok(orderModelSrc.includes('variantId'));
assert.ok(orderModelSrc.includes('isCustomizedCombo'));
assert.ok(ordersRouteSrc.includes('excludedCustomizationSlots'));
assert.ok(ordersRouteSrc.includes('variantId'));
assert.ok(modalSrc.includes('collageUploads'));
assert.ok(modalSrc.includes('catalogSelectedVariant'));
assert.ok(modalSrc.includes('collageLocalUploads'));

// Inline behavioral mirrors for area+file and collage distinction
function resolvePlan(product, selectedVariantValue = '') {
  const preview = product.customizationPreview || {};
  const areas = preview.enabled
    ? (Array.isArray(preview.areas) ? preview.areas.filter((a) => a.requiresImageUpload !== false) : [])
    : [];
  const fileFields = (product.customFields || []).filter((f) => f.type === 'file');
  const textFields = (product.customFields || []).filter((f) => f.type !== 'file');
  const collage = product.collageEnabled
    ? (product.collageTemplates || []).filter((t) => t.label && t.isActive !== false)
    : [];
  const variantOptions = (product.variants || []).flatMap((v) => (v.options || []).map((o) => ({
    value: `${v.name}: ${o.label}`,
    requiresImageUpload: !!o.requiresImageUpload,
  })));
  let selected = selectedVariantValue;
  if (!selected && variantOptions.length) selected = variantOptions[0].value;
  const defaultSlots = [
    ...areas.map((a, i) => ({ slotKey: `product-area-${i}`, label: a.label })),
    ...fileFields.map((f, i) => ({ slotKey: `product-field-${i}`, label: f.label })),
  ];
  const selectedOpt = variantOptions.find((o) => o.value === selected);
  if (selectedOpt?.requiresImageUpload) {
    defaultSlots.push({ slotKey: `variant-${selected}`, label: selected });
  }
  return {
    defaultSlots,
    textFields,
    collage,
    variantOptions,
    selected,
    hasDefaults: defaultSlots.length > 0 || collage.length > 0,
  };
}

const multiPhoto = {
  customizationPreview: {
    enabled: true,
    areas: [
      { label: 'Front Photo', width: 8, height: 10, required: true },
      { label: 'Back Photo', width: 8, height: 10, required: true },
    ],
  },
  customFields: [
    { label: 'Custom Name', type: 'text', required: true },
    { label: 'Extra PDF', type: 'file', required: false },
  ],
  variants: [{ name: 'Size', options: [{ label: '12x8' }, { label: '12x10' }] }],
};
const planA = resolvePlan(multiPhoto);
assert.strictEqual(planA.defaultSlots.length, 3, 'areas + file field');
assert.strictEqual(planA.textFields.length, 1);
assert.ok(planA.variantOptions.length === 2);

const engraving = {
  customizationPreview: { enabled: false },
  customFields: [{ label: 'Engraving Text', type: 'textarea', required: true }],
  variants: [],
};
const planB = resolvePlan(engraving);
assert.strictEqual(planB.defaultSlots.length, 0);
assert.strictEqual(planB.textFields.length, 1);

const collageOnly = {
  customizationPreview: { enabled: false },
  collageEnabled: true,
  collageTemplates: [{ label: 'Upload 4 Photos', minImages: 4, maxImages: 4, isActive: true }],
  customFields: [{ label: 'Couple Name', type: 'text', required: true }],
  variants: [{ name: 'Varients', options: [{ label: '12*8 inch' }, { label: '12*18 inch' }] }],
};
const planC = resolvePlan(collageOnly);
assert.strictEqual(planC.collage.length, 1);
assert.strictEqual(planC.textFields.length, 1);
assert.ok(planC.hasDefaults);

const variantOnly = {
  customizationPreview: { enabled: false },
  customFields: [],
  variants: [{
    name: 'Size',
    options: [
      { label: '8x10', requiresImageUpload: true },
      { label: '12x18', requiresImageUpload: true },
    ],
  }],
};
const planD = resolvePlan(variantOnly);
assert.ok(planD.defaultSlots.some((s) => String(s.slotKey).startsWith('variant-')));

function expandQty(baseCount, qty) {
  return Math.max(1, qty) * baseCount;
}
assert.strictEqual(expandQty(1, 3), 3);
assert.strictEqual(expandQty(2, 2), 4);

// Additional Variants choice resolution (mirrors listAdditionalVariantChoices)
function listChoices(product) {
  const fromVariants = (product.variants || []).flatMap((v) => (v.options || []).map((o) => {
    const optionLabel = String(o?.label || o?.name || '').trim();
    if (!optionLabel) return null;
    const variantName = String(v?.name || v?.type || 'Variant').trim() || 'Variant';
    return { value: `${variantName}: ${optionLabel}`, source: 'variants' };
  })).filter(Boolean);
  if (fromVariants.length) return { choices: fromVariants, source: 'variants' };
  const preview = product.customizationPreview || {};
  if (preview.enabled === false) return { choices: [], source: 'none' };
  const seen = new Set();
  const fromAreas = [];
  (preview.areas || []).forEach((area) => {
    const width = Number(area?.width) || 0;
    const height = Number(area?.height) || 0;
    const rawLabel = String(area?.label || '').trim();
    const hasRealDimensions = width > 1 && height > 1;
    const labelLooksLikeSize = /\d+\s*[x×*]\s*\d+/i.test(rawLabel);
    if (!hasRealDimensions && !labelLooksLikeSize) return;
    const sizeLabel = hasRealDimensions ? `${width}×${height}` : rawLabel;
    const key = sizeLabel.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    fromAreas.push({ value: `AreaSize: ${sizeLabel}`, source: 'area_size' });
  });
  if (fromAreas.length) return { choices: fromAreas, source: 'area_sizes' };
  return { choices: [], source: 'none' };
}

const withVariants = listChoices(multiPhoto);
assert.strictEqual(withVariants.source, 'variants');
assert.strictEqual(withVariants.choices.length, 2);

const areaOnly = listChoices({
  variants: [],
  customizationPreview: {
    enabled: true,
    areas: [
      { label: 'Front Photo', width: 8, height: 10 },
      { label: '12x18 custom', width: 0, height: 0 },
      { label: 'Back Photo', width: 1, height: 1 },
    ],
  },
});
assert.strictEqual(areaOnly.source, 'area_sizes');
assert.ok(areaOnly.choices.some((c) => c.value.includes('8×10') || c.value.includes('8x10')));
assert.ok(areaOnly.choices.some((c) => c.value.includes('12x18')));
assert.ok(!areaOnly.choices.some((c) => /Back Photo/i.test(c.value)));

const none = listChoices({
  variants: [],
  customizationPreview: { enabled: true, areas: [{ label: 'Front Photo', width: 1, height: 1 }] },
});
assert.strictEqual(none.source, 'none');
assert.strictEqual(none.choices.length, 0);

// UI must always render Variant / size select for additional rows (not custom-only by default)
assert.ok(sectionSrc.includes('hasVariantChoices'));
assert.ok(sectionSrc.includes('newVariantRow(product, seed)'));
assert.ok(!/newVariantRow\(hasWebsiteVariants/.test(sectionSrc));

console.log('OK: WA product customization resolution checks passed');
