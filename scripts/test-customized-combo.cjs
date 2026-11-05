const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../src/lib/customizedCombo.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');

const ctx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, RegExp };
vm.createContext(ctx);
vm.runInContext(`${src}
module.exports={normalizeSizeLabel,extractSizeOptionsFromProduct,ensureThirteenByTwenty,buildComboPhotoSlots,hasSizeOption,COMBO_SOURCE_PRODUCT_TITLE_RX};
`, ctx);
const {
  normalizeSizeLabel,
  extractSizeOptionsFromProduct,
  ensureThirteenByTwenty,
  buildComboPhotoSlots,
  hasSizeOption,
  COMBO_SOURCE_PRODUCT_TITLE_RX,
} = ctx.module.exports;

assert.ok(COMBO_SOURCE_PRODUCT_TITLE_RX.test('Personalized Single Photo Frame, Premium Frame with Matte Finish'));
assert.ok(COMBO_SOURCE_PRODUCT_TITLE_RX.test('Personalised Single Photo Frame Premium Frame with Matte Finish'));

{
  const product = {
    variants: [{ name: 'Size', options: [{ label: '8×6' }, { label: '12×10' }] }],
  };
  assert.strictEqual(ensureThirteenByTwenty(product), true);
  assert.ok(hasSizeOption(product.variants[0].options, '13x20'));
  assert.strictEqual(ensureThirteenByTwenty(product), false);
  const { options } = extractSizeOptionsFromProduct(product);
  assert.ok(options.some((o) => normalizeSizeLabel(o.label) === '13x20'));
}

{
  const slots = buildComboPhotoSlots([
    { size: '8×6', quantity: 3 },
    { size: '12×10', quantity: 2 },
  ]);
  assert.strictEqual(slots.length, 5);
  assert.strictEqual(slots.filter((s) => s.size === '8×6').length, 3);
  assert.strictEqual(slots[0].label, '8×6 — Photo 1');
  assert.strictEqual(slots[4].label, '12×10 — Photo 2');
}

console.log('Customized combo tests passed');
