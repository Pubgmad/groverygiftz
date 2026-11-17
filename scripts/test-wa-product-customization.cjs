/**
 * Regression checks for WA product customization + master size catalog + dispatch.
 * Run: node scripts/test-wa-product-customization.cjs
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const COMBO_SOURCE_PRODUCT_TITLE_RX = /personal+i[sz]ed\s+single\s+photo\s+frame.*matte\s+finish/i;

const configSrc = fs.readFileSync(path.join(__dirname, '../src/lib/websiteProductPhotoConfig.js'), 'utf8');
const sectionSrc = fs.readFileSync(path.join(__dirname, '../src/components/admin/WhatsAppOrderProductSection.js'), 'utf8');
const estimateSrc = fs.readFileSync(path.join(__dirname, '../src/lib/orderDeliveryEstimate.js'), 'utf8');
const ordersPageSrc = fs.readFileSync(path.join(__dirname, '../src/app/account/manage/orders/page.js'), 'utf8');
const comboSrc = fs.readFileSync(path.join(__dirname, '../src/lib/customizedCombo.js'), 'utf8');
const apiSrc = fs.readFileSync(path.join(__dirname, '../src/app/api/admin/customized-combo/route.js'), 'utf8');
const modalSrc = fs.readFileSync(path.join(__dirname, '../src/components/admin/CreateWhatsAppOrderModal.js'), 'utf8');

assert.ok(configSrc.includes('listUniqueWebsiteSizes'));
assert.ok(configSrc.includes('resolveWebsiteSizeConfig'));
assert.ok(configSrc.includes('buildCatalogSelectCustomizationPlan'));
assert.ok(configSrc.includes('isExcludedWebsiteSizeLabel'));
assert.ok(configSrc.includes('listPrimaryWebsiteSizeOptions'));
assert.ok(configSrc.includes('Boolean(variantArea) || allowPreview'));
assert.ok(comboSrc.includes('isExcludedComboSizeLabel') || comboSrc.includes('13x20'));
assert.ok(sectionSrc.includes('UniqueSizeSelect'));
assert.ok(sectionSrc.includes('buildCatalogSelectCustomizationPlan'));
assert.ok(sectionSrc.includes('Personalized Single Photo Frame'));
assert.ok(sectionSrc.includes('sizeCatalogProduct'));
assert.ok(sectionSrc.includes('newCatalogProductRow'));
assert.ok(sectionSrc.includes('+ Add product'));
assert.ok(sectionSrc.includes('Remove product'));
assert.ok(!/Additional Variants<\/h4>/.test(sectionSrc));
assert.ok(!modalSrc.includes('catalogAdditionalVariants'));
assert.ok(!modalSrc.includes('onAdditionalVariantsChange'));
assert.ok(modalSrc.includes('catalogProductRows'));
assert.ok(modalSrc.includes('sizeCatalogProduct={comboProduct}'));
assert.ok(modalSrc.includes('Select a size for every product'));
assert.ok(!/99 website size configurations/.test(sectionSrc));
// Customized Combo section must remain intact.
assert.ok(sectionSrc.includes('export function ComboProductSection'));
assert.ok(modalSrc.includes('ComboProductSection'));
assert.ok(estimateSrc.includes('resolveAdminDispatchDisplay'));
assert.ok(ordersPageSrc.includes('resolveAdminDispatchDisplay'));
assert.ok(comboSrc.includes('return false'));
assert.ok(comboSrc.includes('[x×*]'));
assert.ok(!apiSrc.includes('ensureThirteenByTwenty(product)'));

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
  });
  const sizes = [...byKey.values()].map((entry) => ({
    sizeKey: entry.sizeKey,
    sizeLabel: canonicalWebsiteSizeLabel(entry.labels),
    configs: entry.configs,
  }));
  return { sizes, uniqueCount: sizes.length };
}

const singleFrame = {
  _id: 'frame1',
  title: 'Personalized Single Photo Frame – Premium Frame with Matte Finish',
  isActive: true,
  variants: [
    {
      name: 'Size Varients',
      options: [
        { label: '4*4', previewWidth: 4, previewHeight: 4, requiresImageUpload: true },
        { label: '8*6 inch', previewWidth: 8, previewHeight: 6, requiresImageUpload: true },
        { label: '12*18', previewWidth: 12, previewHeight: 18, requiresImageUpload: true },
        { label: '30*20', previewWidth: 30, previewHeight: 20, requiresImageUpload: true },
      ],
    },
    {
      name: 'Size',
      options: [{ label: '13×20' }],
    },
  ],
};

function listPrimaryWebsiteSizeOptions(product) {
  const options = [];
  (product.variants || []).forEach((v) => {
    (v.options || []).forEach((o) => {
      const label = String(o.label || '').trim();
      if (!isWebsiteSizeLikeLabel(label)) return;
      if (normalizeWebsiteSizeKey(label) === '13x20inch') return;
      options.push({ variantName: v.name || 'Size', optionLabel: label, label });
    });
  });
  const byName = new Map();
  options.forEach((opt) => {
    const name = opt.variantName;
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(opt);
  });
  const preferred = [...byName.entries()].filter(([name]) => /varient|variant/i.test(name));
  if (preferred.length) return preferred.flatMap(([, opts]) => opts);
  return options;
}
const wishEye = {
  _id: 'wish1',
  title: '11:11 Wish Eye Frame',
  isActive: true,
  variants: [{
    name: 'Size Varient',
    options: [
      { label: '8*6 inch', previewWidth: 8, previewHeight: 6 },
      { label: '10*8 inch', previewWidth: 10, previewHeight: 8 },
      { label: '12*8 inch', previewWidth: 12, previewHeight: 8 },
    ],
  }],
};

const primaryFrameOpts = listPrimaryWebsiteSizeOptions(singleFrame);
assert.ok(primaryFrameOpts.every((o) => normalizeWebsiteSizeKey(o.optionLabel) !== '13x20inch'), '13×20 excluded');
assert.ok(primaryFrameOpts.some((o) => normalizeWebsiteSizeKey(o.optionLabel) === '12x18inch'));
assert.strictEqual(primaryFrameOpts.length, 4);

const frameSizes = listUniqueWebsiteSizes([{
  ...singleFrame,
  variants: [{ name: 'Size Varients', options: primaryFrameOpts.map((o) => ({ label: o.optionLabel })) }],
}]);
const wishOnlySizes = listUniqueWebsiteSizes([wishEye]);
assert.ok(frameSizes.uniqueCount >= 4);
assert.strictEqual(wishOnlySizes.uniqueCount, 3);
assert.ok(frameSizes.sizes.some((s) => s.sizeKey === '12x18inch'), 'master list includes 12*18');
assert.ok(!frameSizes.sizes.some((s) => s.sizeKey === '13x20inch'), 'master list excludes 13×20');
assert.ok(!wishOnlySizes.sizes.some((s) => s.sizeKey === '12x18inch'), 'product-only list excludes master-only sizes');
assert.ok(COMBO_SOURCE_PRODUCT_TITLE_RX.test(singleFrame.title));
assert.ok(!COMBO_SOURCE_PRODUCT_TITLE_RX.test(wishEye.title));

// Select Product UI must use master list, not Wish Eye's 3 sizes.
assert.ok(sectionSrc.includes('listUniqueWebsiteSizes(sizeSourceProduct ? [sizeSourceProduct] : [])'));

function variantAreaFromOption(selected) {
  if (!selected) return null;
  let width = Number(selected.previewWidth);
  let height = Number(selected.previewHeight);
  if (!(width > 0) || !(height > 0)) {
    const fromLabel = String(selected.label || '').match(
      /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)/i,
    );
    if (fromLabel) {
      if (!(width > 0)) width = Number(fromLabel[1]) || 0;
      if (!(height > 0)) height = Number(fromLabel[2]) || 0;
    }
  }
  if (!(width > 0) && !(height > 0)) return null;
  return { width: width > 0 ? width : 1, height: height > 0 ? height : 1, unit: 'inch' };
}

const area1218 = variantAreaFromOption({ label: '12*18', previewWidth: 12, previewHeight: 18 });
assert.strictEqual(area1218.width, 12);
assert.strictEqual(area1218.height, 18);

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
assert.ok(resolveAdminDispatchDisplay({}).empty);

console.log('OK: Select Product master-size dropdown + no Additional Variants checks passed');
console.log(`Master frame sizes: ${frameSizes.uniqueCount}; Wish Eye product sizes: ${wishOnlySizes.uniqueCount}`);
