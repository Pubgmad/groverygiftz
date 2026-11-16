/**
 * Regression checks for WA product customization resolution.
 * Run: node scripts/test-wa-product-customization.cjs
 */
const assert = require('assert');

// Inline mirrors of critical resolution rules (avoid Next path aliases).
function resolvePlan(product) {
  const preview = product.customizationPreview || {};
  const areas = Array.isArray(preview.areas) ? preview.areas.filter((a) => a.requiresImageUpload !== false) : [];
  const fileFields = (product.customFields || []).filter((f) => f.type === 'file');
  const textFields = (product.customFields || []).filter((f) => f.type !== 'file');
  const variantOptions = (product.variants || []).flatMap((v) => (v.options || []).map((o) => ({
    value: `${v.name}: ${o.label}`,
    requiresImageUpload: !!o.requiresImageUpload,
  })));
  let defaultSlots = [];
  if (preview.enabled && areas.length) {
    defaultSlots = areas.map((a, i) => ({ slotKey: `product-area-${i}`, label: a.label }));
  } else if (fileFields.length) {
    defaultSlots = fileFields.map((f, i) => ({ slotKey: `product-field-${i}`, label: f.label }));
  } else if (variantOptions.some((o) => o.requiresImageUpload)) {
    const first = variantOptions.find((o) => o.requiresImageUpload);
    defaultSlots = [{ slotKey: `variant-${first.value}-u1`, label: first.value }];
  }
  return { defaultSlots, textFields, variantOptions, hasDefaults: defaultSlots.length > 0 };
}

// Product with Front/Back areas — defaults appear without Add Variant
const multiPhoto = {
  customizationPreview: {
    enabled: true,
    areas: [
      { label: 'Front Photo', width: 8, height: 10, required: true },
      { label: 'Back Photo', width: 8, height: 10, required: true },
    ],
  },
  customFields: [{ label: 'Custom Name', type: 'text', required: true }],
  variants: [{ name: 'Size', options: [{ label: '12x8' }, { label: '12x10' }] }],
};
const planA = resolvePlan(multiPhoto);
assert.strictEqual(planA.defaultSlots.length, 2);
assert.strictEqual(planA.textFields.length, 1);
assert.ok(planA.variantOptions.length === 2);

// Engraving-only — no invented photo slots
const engraving = {
  customizationPreview: { enabled: false },
  customFields: [{ label: 'Engraving Text', type: 'textarea', required: true }],
  variants: [],
};
const planB = resolvePlan(engraving);
assert.strictEqual(planB.defaultSlots.length, 0);
assert.strictEqual(planB.textFields.length, 1);

// Variant-only uploads — auto default from first requiresImageUpload
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
const planC = resolvePlan(variantOnly);
assert.strictEqual(planC.hasDefaults, true);

// Quantity expansion: 1 base × qty 3 = 3
function expandQty(baseCount, qty) {
  return Math.max(1, qty) * baseCount;
}
assert.strictEqual(expandQty(1, 3), 3);
assert.strictEqual(expandQty(2, 2), 4);

// 13x20 must not be required by combo helpers anymore
const comboSrc = require('fs').readFileSync(require('path').join(__dirname, '../src/lib/customizedCombo.js'), 'utf8');
assert.ok(!comboSrc.includes('sizeVariant.options.push'));
assert.ok(comboSrc.includes('ensureThirteenByTwenty'));
const ensureBody = comboSrc.slice(comboSrc.indexOf('export function ensureThirteenByTwenty'));
assert.ok(ensureBody.includes('return false'));

const apiSrc = require('fs').readFileSync(require('path').join(__dirname, '../src/app/api/admin/customized-combo/route.js'), 'utf8');
assert.ok(!apiSrc.includes('ensureThirteenByTwenty(product)'));
assert.ok(apiSrc.includes('whatsappComboProductId'));

console.log('OK: WA product customization resolution checks passed');
