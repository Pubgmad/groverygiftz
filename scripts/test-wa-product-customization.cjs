/**
 * Regression checks for WA product customization + unique sizes + dispatch display.
 * Run: node scripts/test-wa-product-customization.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const configSrc = fs.readFileSync(path.join(__dirname, '../src/lib/websiteProductPhotoConfig.js'), 'utf8');
const sectionSrc = fs.readFileSync(path.join(__dirname, '../src/components/admin/WhatsAppOrderProductSection.js'), 'utf8');
const estimateSrc = fs.readFileSync(path.join(__dirname, '../src/lib/orderDeliveryEstimate.js'), 'utf8');
const ordersPageSrc = fs.readFileSync(path.join(__dirname, '../src/app/account/manage/orders/page.js'), 'utf8');
const comboSrc = fs.readFileSync(path.join(__dirname, '../src/lib/customizedCombo.js'), 'utf8');
const apiSrc = fs.readFileSync(path.join(__dirname, '../src/app/api/admin/customized-combo/route.js'), 'utf8');
const modalSrc = fs.readFileSync(path.join(__dirname, '../src/components/admin/CreateWhatsAppOrderModal.js'), 'utf8');

assert.ok(configSrc.includes('listUniqueWebsiteSizes'));
assert.ok(configSrc.includes('resolveWebsiteSizeConfig'));
assert.ok(configSrc.includes('canonicalWebsiteSizeLabel'));
assert.ok(configSrc.includes('Boolean(variantArea) || allowPreview'));
assert.ok(sectionSrc.includes('UniqueSizeSelect'));
assert.ok(sectionSrc.includes('listUniqueWebsiteSizes'));
assert.ok(sectionSrc.includes('listUniqueWebsiteSizes(product ? [product] : [])'));
assert.ok(sectionSrc.includes('on this product'));
assert.ok(sectionSrc.includes('Only sizes configured on this selected product'));
assert.ok(!/99 website size configurations/.test(sectionSrc));
assert.ok(!sectionSrc.includes('${sizeLabel} — ${productTitle}'));
assert.ok(estimateSrc.includes('resolveAdminDispatchDisplay'));
assert.ok(ordersPageSrc.includes('resolveAdminDispatchDisplay'));
assert.ok(comboSrc.includes('return false'));
assert.ok(!apiSrc.includes('ensureThirteenByTwenty(product)'));
assert.ok(modalSrc.includes('needsProductDisambiguation'));

function isWebsiteSizeLikeLabel(label) {
  const s = String(label || '').trim();
  if (!s) return false;
  if (/\d+\s*[x×*]\s*\d+/i.test(s)) return true;
  if (/\d+(?:\.\d+)?\s*(?:inch|inches|in|cm|mm)\b/i.test(s)) return true;
  return false;
}

function normalizeWebsiteSizeKey(label) {
  const raw = String(label || '').trim().toLowerCase();
  if (!raw) return '';
  const match = raw.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(inch(?:es)?|in|cm|mm)?/i);
  if (match) {
    const unitRaw = String(match[3] || 'inch').toLowerCase();
    const unit = (unitRaw === 'inches' || unitRaw === 'in') ? 'inch' : unitRaw;
    return `${match[1]}x${match[2]}${unit}`;
  }
  return raw.replace(/[×*]/g, 'x').replace(/\s+/g, '').replace(/inches\b/g, 'inch');
}

function canonicalWebsiteSizeLabel(labels = []) {
  const list = labels.map((l) => String(l || '').trim()).filter(Boolean);
  if (!list.length) return '';
  const withUnit = list.find((label) => /\b(inch|inches|in|cm|mm)\b/i.test(label));
  const pick = withUnit || list[0];
  const match = String(pick).match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(inch(?:es)?|in|cm|mm)?/i);
  if (!match) return pick;
  const unitRaw = String(match[3] || 'inch').toLowerCase();
  const unit = (unitRaw === 'inches' || unitRaw === 'in') ? 'inch' : unitRaw;
  return `${match[1]}×${match[2]} ${unit}`;
}

assert.strictEqual(normalizeWebsiteSizeKey('12x18'), '12x18inch');
assert.strictEqual(normalizeWebsiteSizeKey('12 × 18'), '12x18inch');
assert.strictEqual(normalizeWebsiteSizeKey('12*18 inch'), '12x18inch');
assert.notStrictEqual(normalizeWebsiteSizeKey('30x20'), normalizeWebsiteSizeKey('20x30'));

function listUniqueWebsiteSizes(products = []) {
  const byKey = new Map();
  products.forEach((product) => {
    if (!product || product.isActive === false) return;
    const productId = String(product._id || '');
    const productTitle = product.title || 'Product';
    const sizeKeysOnProduct = new Set();
    (product.variants || []).forEach((v) => {
      (v.options || []).forEach((o) => {
        const sizeLabel = String(o.label || '').trim();
        if (!isWebsiteSizeLikeLabel(sizeLabel)) return;
        const sizeKey = normalizeWebsiteSizeKey(sizeLabel);
        sizeKeysOnProduct.add(sizeKey);
        if (!byKey.has(sizeKey)) byKey.set(sizeKey, { sizeKey, labels: [], configs: [] });
        const entry = byKey.get(sizeKey);
        entry.labels.push(sizeLabel);
        entry.configs.push({ productId, productTitle, sizeLabel, value: `catalog:${productId}|variant|${sizeLabel}` });
      });
    });
    const preview = product.customizationPreview || {};
    if (preview.enabled === false) return;
    (preview.areas || []).forEach((area) => {
      const width = Number(area.width) || 0;
      const height = Number(area.height) || 0;
      const rawLabel = String(area.label || '').trim();
      const hasRealDimensions = width > 1 && height > 1;
      const labelLooksLikeSize = isWebsiteSizeLikeLabel(rawLabel);
      if (!hasRealDimensions && !labelLooksLikeSize) return;
      const sizeLabel = labelLooksLikeSize ? rawLabel : `${width}×${height}`;
      if (!isWebsiteSizeLikeLabel(sizeLabel)) return;
      const sizeKey = normalizeWebsiteSizeKey(sizeLabel);
      if (sizeKeysOnProduct.has(sizeKey)) return;
      if (!byKey.has(sizeKey)) byKey.set(sizeKey, { sizeKey, labels: [], configs: [] });
      const entry = byKey.get(sizeKey);
      entry.labels.push(sizeLabel);
      entry.configs.push({ productId, productTitle, sizeLabel, value: `catalog:${productId}|area|${sizeLabel}` });
    });
  });
  const sizes = [...byKey.values()].map((entry) => ({
    sizeKey: entry.sizeKey,
    sizeLabel: canonicalWebsiteSizeLabel(entry.labels),
    configs: entry.configs,
  }));
  return { sizes, uniqueCount: sizes.length };
}

function resolveWebsiteSizeConfig(sizeKeyOrLabel, { products = [], preferredProductIds = [], explicitProductId = '' } = {}) {
  const sizeKey = normalizeWebsiteSizeKey(sizeKeyOrLabel);
  const { sizes } = listUniqueWebsiteSizes(products);
  const entry = sizes.find((s) => s.sizeKey === sizeKey);
  if (!entry) return { ok: false, ambiguous: false, config: null, candidates: [] };
  if (explicitProductId) {
    const match = entry.configs.find((c) => String(c.productId) === String(explicitProductId));
    if (match) return { ok: true, ambiguous: false, config: match, candidates: entry.configs, sizeKey, sizeLabel: entry.sizeLabel };
  }
  for (const id of preferredProductIds) {
    const match = entry.configs.find((c) => String(c.productId) === String(id));
    if (match) return { ok: true, ambiguous: false, config: match, candidates: entry.configs, sizeKey, sizeLabel: entry.sizeLabel };
  }
  if (entry.configs.length === 1) {
    return { ok: true, ambiguous: false, config: entry.configs[0], candidates: entry.configs, sizeKey, sizeLabel: entry.sizeLabel };
  }
  return { ok: false, ambiguous: true, config: null, candidates: entry.configs, sizeKey, sizeLabel: entry.sizeLabel };
}

const products = [
  {
    _id: 'a1',
    title: 'Our Love in Dates',
    isActive: true,
    variants: [{ name: 'Size', options: [{ label: '12*8 inch' }, { label: '12*18 inch' }, { label: 'Brown' }] }],
  },
  {
    _id: 'b1',
    title: '3 frame combo Offer',
    isActive: true,
    variants: [],
    customizationPreview: {
      enabled: true,
      areas: [{ label: '12*8 inch ', width: 8, height: 12 }],
    },
  },
  {
    _id: 'c1',
    title: 'Big Surprise',
    isActive: true,
    variants: [],
    customizationPreview: { enabled: true, areas: [{ label: '30x20', width: 20, height: 30 }] },
  },
];

const unique = listUniqueWebsiteSizes(products);
assert.ok(unique.uniqueCount >= 3);
assert.ok(unique.sizes.every((s) => !/Our Love|3 frame|Big Surprise/i.test(s.sizeLabel)), 'dropdown labels are size-only');
assert.ok(!unique.sizes.some((s) => s.sizeLabel === 'Brown'));

const twelveByEight = unique.sizes.find((s) => s.sizeKey === '12x8inch');
assert.ok(twelveByEight);
assert.ok(twelveByEight.configs.length >= 2);

// Select Product mode: only sizes on the chosen product (no foreign catalog sizes).
const singleFrame = {
  _id: 'frame1',
  title: 'Personalized Single Photo Frame – Premium Frame with Matte Finish',
  isActive: true,
  customizationPreview: { enabled: false },
  variants: [{
    name: 'Size Varients',
    options: [
      { label: '4*4', previewWidth: 4, previewHeight: 4, requiresImageUpload: true },
      { label: '12*18', previewWidth: 12, previewHeight: 18, requiresImageUpload: true },
      { label: '30*20', previewWidth: 30, previewHeight: 20, requiresImageUpload: true },
    ],
  }],
};
const productOnly = listUniqueWebsiteSizes([singleFrame]);
assert.strictEqual(productOnly.uniqueCount, 3);
assert.ok(productOnly.sizes.every((s) => s.configs.every((c) => c.productId === 'frame1')));
assert.ok(!productOnly.sizes.some((s) => s.sizeKey === '12x8inch'), 'catalog size from other products must not appear');
assert.ok(productOnly.sizes.some((s) => s.sizeKey === '12x18inch'));

const scopedResolve = resolveWebsiteSizeConfig('12*18', {
  products: [singleFrame],
  preferredProductIds: ['frame1'],
  explicitProductId: 'frame1',
});
assert.ok(scopedResolve.ok);
assert.strictEqual(scopedResolve.config.productId, 'frame1');

const preferred = resolveWebsiteSizeConfig('12*8 inch', {
  products,
  preferredProductIds: ['b1'],
});
assert.ok(preferred.ok);
assert.strictEqual(preferred.config.productId, 'b1');

const ambiguous = resolveWebsiteSizeConfig('12*8 inch', {
  products,
  preferredProductIds: ['missing'],
});
assert.ok(ambiguous.ambiguous);
assert.ok(!ambiguous.config);

function variantAreaFromOption(selected) {
  if (!selected) return null;
  let width = Number(selected.previewWidth);
  let height = Number(selected.previewHeight);
  let unit = selected.previewUnit || 'inch';
  if (!(width > 0) || !(height > 0)) {
    const fromLabel = String(selected.label || '').match(
      /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(inch(?:es)?|in|cm|mm)?/i,
    );
    if (fromLabel) {
      if (!(width > 0)) width = Number(fromLabel[1]) || 0;
      if (!(height > 0)) height = Number(fromLabel[2]) || 0;
      if (!selected.previewUnit && fromLabel[3]) {
        const unitRaw = String(fromLabel[3]).toLowerCase();
        unit = (unitRaw === 'inches' || unitRaw === 'in') ? 'inch' : unitRaw;
      }
    }
  }
  if (!(width > 0) && !(height > 0) && !selected.previewFrameImage) return null;
  return {
    label: selected.label || 'Photo',
    width: width > 0 ? width : 1,
    height: height > 0 ? height : 1,
    unit,
  };
}

const area1218 = variantAreaFromOption({ label: '12*18', previewWidth: 12, previewHeight: 18 });
assert.strictEqual(area1218.width, 12);
assert.strictEqual(area1218.height, 18);
const areaFromLabel = variantAreaFromOption({ label: '12*18' });
assert.strictEqual(areaFromLabel.width, 12);
assert.strictEqual(areaFromLabel.height, 18);

function resolveAdminDispatchDisplay(order) {
  const snapYmd = String(order?.confirmationSchedule?.expectedReadyDateIst || '').trim();
  if (snapYmd) return { label: snapYmd, source: 'confirmationSchedule.expectedReadyDateIst' };
  const readyLabel = String(order?.expectedReadyDate || '').trim();
  if (readyLabel) return { label: readyLabel, source: 'expectedReadyDate' };
  if (order?.expectedDispatchDate) return { label: 'from-expectedDispatchDate', source: 'expectedDispatchDate' };
  return { label: '', empty: true, source: 'none' };
}

assert.strictEqual(
  resolveAdminDispatchDisplay({ confirmationSchedule: { expectedReadyDateIst: '2026-11-24' } }).source,
  'confirmationSchedule.expectedReadyDateIst',
);
assert.strictEqual(
  resolveAdminDispatchDisplay({ expectedDispatchDate: new Date('2026-11-24T00:00:00+05:30') }).source,
  'expectedDispatchDate',
);
assert.ok(resolveAdminDispatchDisplay({}).empty);

console.log('OK: product-scoped sizes + 12x18 frame + dispatch regression checks passed');
console.log(`Catalog unique sizes: ${unique.uniqueCount}; Single frame sizes: ${productOnly.uniqueCount}`);
