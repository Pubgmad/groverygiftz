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

// UI must show collage uploads + original section + catalog-wide sizes
assert.ok(sectionSrc.includes('CollageUploadSection'));
assert.ok(sectionSrc.includes('Original Product Details'));
assert.ok(sectionSrc.includes('Exclude for this order only'));
assert.ok(sectionSrc.includes('Additional Variants'));
assert.ok(sectionSrc.includes('Custom Variant — This Order Only'));
assert.ok(sectionSrc.includes('+ Add Text Field'));
assert.ok(sectionSrc.includes('ORDER_LOCAL_CUSTOM_VARIANT'));
assert.ok(sectionSrc.includes('listWebsiteCatalogSizeChoices'));
assert.ok(sectionSrc.includes('CatalogSizeSelect'));
assert.ok(sectionSrc.includes('Select website size'));
assert.ok(sectionSrc.includes('All website-supported sizes'));
assert.ok(!sectionSrc.includes('This product has no configured variants to add'));
assert.ok(!sectionSrc.includes('Done — Generate'));
assert.ok(!sectionSrc.includes('Done-Generate'));
assert.ok(!sectionSrc.includes('PRODUCT SIZE (FROM PREVIEW CONFIG)'));
assert.ok(!/Sizes derived from this product/.test(sectionSrc));
assert.ok(configSrc.includes('buildOrderLocalCustomVariantSlots'));
assert.ok(configSrc.includes('ORDER_LOCAL_CUSTOM_VARIANT'));
assert.ok(configSrc.includes('listWebsiteCatalogSizeChoices'));
assert.ok(configSrc.includes('listAreaDerivedSizeOptions'));
assert.ok(configSrc.includes('isWebsiteSizeLikeLabel'));
assert.ok(configSrc.includes('AreaSize:'));
assert.ok(configSrc.includes('catalog:${productId}|variant|'));
assert.ok(modalSrc.includes('catalogSizeChoice'));
assert.ok(modalSrc.includes('sourceProductId'));

// Combo must not mutate 13×20 into products
assert.ok(comboSrc.includes('return false'));
assert.ok(!comboSrc.includes('sizeVariant.options.push'));
assert.ok(!apiSrc.includes('ensureThirteenByTwenty(product)'));
assert.ok(apiSrc.includes('whatsappComboProductId'));
assert.ok(sectionSrc.includes('catalog-wide website sizes'));

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
  _id: 'p1',
  title: 'Multi Photo Frame',
  isActive: true,
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
  variants: [{ name: 'Size', options: [{ label: '12x8', _id: 'o1' }, { label: '12x10', _id: 'o2' }] }],
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

function isWebsiteSizeLikeLabel(label) {
  const s = String(label || '').trim();
  if (!s) return false;
  if (/\d+\s*[x×*]\s*\d+/i.test(s)) return true;
  if (/\d+(?:\.\d+)?\s*(?:inch|inches|in|cm|mm)\b/i.test(s)) return true;
  return false;
}

function normalizeWebsiteSizeKey(label) {
  return String(label || '')
    .toLowerCase()
    .replace(/[×*]/g, 'x')
    .replace(/\s+/g, '')
    .replace(/inches\b/g, 'inch');
}

function listWebsiteCatalogSizeChoices(products = []) {
  const choices = [];
  const seenValue = new Set();
  products.forEach((product) => {
    if (!product || product.isActive === false) return;
    const productId = String(product._id || '').trim();
    if (!productId) return;
    const productTitle = String(product.title || 'Product').trim() || 'Product';
    const sizeKeysOnProduct = new Set();
    (product.variants || []).forEach((v) => {
      (v.options || []).forEach((o) => {
        const sizeLabel = String(o?.label || o?.name || '').trim();
        if (!isWebsiteSizeLikeLabel(sizeLabel)) return;
        const sizeKey = normalizeWebsiteSizeKey(sizeLabel);
        sizeKeysOnProduct.add(sizeKey);
        const variantValue = `${v.name || 'Variant'}: ${sizeLabel}`;
        const value = `catalog:${productId}|variant|${variantValue}`;
        if (seenValue.has(value)) return;
        seenValue.add(value);
        choices.push({
          value,
          sizeLabel,
          sizeKey,
          productId,
          productTitle,
          source: 'variants',
        });
      });
    });
    const preview = product.customizationPreview || {};
    if (preview.enabled === false) return;
    const seenArea = new Set();
    (preview.areas || []).forEach((area) => {
      const width = Number(area?.width) || 0;
      const height = Number(area?.height) || 0;
      const rawLabel = String(area?.label || '').trim();
      const hasRealDimensions = width > 1 && height > 1;
      const labelLooksLikeSize = isWebsiteSizeLikeLabel(rawLabel);
      if (!hasRealDimensions && !labelLooksLikeSize) return;
      const sizeLabel = labelLooksLikeSize ? rawLabel : `${width}×${height}`;
      if (!isWebsiteSizeLikeLabel(sizeLabel)) return;
      const sizeKey = normalizeWebsiteSizeKey(sizeLabel);
      if (sizeKeysOnProduct.has(sizeKey) || seenArea.has(sizeKey)) return;
      seenArea.add(sizeKey);
      const value = `catalog:${productId}|area|AreaSize: ${sizeLabel}`;
      if (seenValue.has(value)) return;
      seenValue.add(value);
      choices.push({
        value,
        sizeLabel,
        sizeKey,
        productId,
        productTitle,
        source: 'area_size',
      });
    });
  });
  return { choices, source: 'catalog' };
}

const catalogA = {
  _id: 'a1',
  title: 'Our Love in Dates',
  isActive: true,
  variants: [{ name: 'Size', options: [{ label: '12*8 inch' }, { label: '12*18 inch' }, { label: 'Brown' }] }],
};
const catalogB = {
  _id: 'b1',
  title: '3 frame combo Offer',
  isActive: true,
  variants: [],
  customizationPreview: {
    enabled: true,
    areas: [
      { label: '12*8 inch ', width: 8, height: 12 },
      { label: '12*8 inch ', width: 8, height: 12 },
    ],
  },
};
const catalogC = {
  _id: 'c1',
  title: 'Big Surprise Photo Frame',
  isActive: true,
  variants: [],
  customizationPreview: {
    enabled: true,
    areas: [{ label: '20 × 30 inch', width: 20, height: 30 }],
  },
};
const catalogD = {
  _id: 'd1',
  title: 'Wallet',
  isActive: true,
  variants: [{ name: 'Colour', options: [{ label: 'Brown' }] }],
};

const catalog = listWebsiteCatalogSizeChoices([catalogA, catalogB, catalogC, catalogD]);
assert.strictEqual(catalog.source, 'catalog');
assert.ok(catalog.choices.length >= 4);
assert.ok(catalog.choices.every((c) => c.value.startsWith('catalog:')));
assert.ok(catalog.choices.some((c) => c.sizeLabel.includes('12*8') && c.productTitle.includes('Our Love')));
assert.ok(catalog.choices.some((c) => c.sizeLabel.includes('12*8') && c.productTitle.includes('3 frame')));
assert.ok(catalog.choices.some((c) => /20/.test(c.sizeLabel) && /30/.test(c.sizeLabel)));
assert.ok(!catalog.choices.some((c) => c.sizeLabel === 'Brown'), 'non-size options excluded');
assert.ok(!catalog.choices.some((c) => /13×20|13x20/.test(c.sizeLabel)), 'no hardcoded 13x20');

// Same size from different products must stay distinct
const twelveByEight = catalog.choices.filter((c) => normalizeWebsiteSizeKey(c.sizeLabel).includes('12x8'));
assert.ok(twelveByEight.length >= 2, '12*8 from multiple products');
assert.strictEqual(new Set(twelveByEight.map((c) => c.productId)).size, twelveByEight.length);

// UI must use catalog-wide choices, not selected-product-only preview sizes
assert.ok(sectionSrc.includes('hasCatalogSizes'));
assert.ok(sectionSrc.includes('sourceProductId'));
assert.ok(sectionSrc.includes('groupCatalogSizeChoices'));
assert.ok(!/listAdditionalVariantChoices\(product\)/.test(sectionSrc));

console.log('OK: WA product customization resolution checks passed');
console.log(`Catalog fixture choices: ${catalog.choices.length}`);
