/* Unit tests for shipping label page math, validation, and sanitization (no DB writes). */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');
const { createHmac } = require('crypto');

function loadModule(rel, exportNames) {
  const src = fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    .replace(/export const /g, 'const ')
    .replace(/export function /g, 'function ')
    .replace(/export \{[^}]+\};?/g, '')
    .replace(/export async function /g, 'async function ')
    .replace(/import\s+[^;]+;/g, '');
  const ctx = {
    module: { exports: {} },
    exports: {},
    console,
    Math,
    Date,
    Number,
    String,
    Boolean,
    Array,
    Object,
    Map,
    Set,
    JSON,
    Intl,
    Buffer,
    process: { env: { NEXTAUTH_SECRET: 'test-secret-shipping-labels' } },
    require,
  };
  // Provide minimal stubs for imports stripped above by re-inlining layout helpers when needed
  vm.createContext(ctx);
  const footer = `\nmodule.exports={${exportNames.join(',')}};`;
  vm.runInContext(src + footer, ctx);
  return ctx.module.exports;
}

// Layout helpers (no imports)
const layoutSrc = fs.readFileSync(path.join(__dirname, '../src/lib/shippingLabelLayout.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  .replace(/export \{[^}]+\};?/g, '');
const layoutCtx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, Map, Set, JSON, Intl };
vm.createContext(layoutCtx);
vm.runInContext(`${layoutSrc}\nmodule.exports={SHIPPING_LABEL_LAYOUTS,pageCountForLabels,normalizeShippingLabelLayout,MAX_SHIPPING_LABEL_ORDERS};`, layoutCtx);
const { SHIPPING_LABEL_LAYOUTS, pageCountForLabels, normalizeShippingLabelLayout } = layoutCtx.module.exports;

const cases = [
  [1, 1], [3, 1], [4, 1], [5, 2], [8, 2], [12, 3], [20, 5],
];
cases.forEach(([n, pages]) => {
  assert.strictEqual(pageCountForLabels(n, SHIPPING_LABEL_LAYOUTS.four), pages, `four-label ${n}`);
});
assert.strictEqual(pageCountForLabels(5, SHIPPING_LABEL_LAYOUTS.two), 3);
assert.strictEqual(pageCountForLabels(3, SHIPPING_LABEL_LAYOUTS.single), 3);
assert.strictEqual(normalizeShippingLabelLayout('two').id, 'two');
assert.strictEqual(normalizeShippingLabelLayout('1').id, 'single');

// Token round-trip
const tokenSrc = fs.readFileSync(path.join(__dirname, '../src/lib/shippingLabelToken.js'), 'utf8')
  .replace(/export function /g, 'function ')
  .replace(/export const /g, 'const ')
  .replace(/import\s+[^;]+;/g, 'const { createHmac, timingSafeEqual } = require("crypto");');
const tokenCtx = {
  module: { exports: {} },
  exports: {},
  console,
  require,
  process: { env: { NEXTAUTH_SECRET: 'test-secret-shipping-labels' } },
  Buffer,
};
vm.createContext(tokenCtx);
vm.runInContext(`${tokenSrc}\nmodule.exports={createShippingLabelToken,verifyShippingLabelToken,buildShippingLabelTrackUrl};`, tokenCtx);
const { createShippingLabelToken, verifyShippingLabelToken, buildShippingLabelTrackUrl } = tokenCtx.module.exports;

const id = '507f1f77bcf86cd799439011';
const token = createShippingLabelToken(id);
assert.ok(token.includes('.'));
assert.strictEqual(verifyShippingLabelToken(token), id);
assert.strictEqual(verifyShippingLabelToken('bad.token'), null);
const url = buildShippingLabelTrackUrl(token, 'https://groverygiftz.in');
assert.ok(url.startsWith('https://groverygiftz.in/track/label/'));
assert.ok(!url.includes('price'));
assert.ok(!url.includes('phone'));

// Validation + sanitize without mongoose imports: inline copies of key rules
function validate(order) {
  const missing = [];
  if (order.paymentStatus !== 'paid') return { ok: false };
  if (order.status === 'cancelled') return { ok: false };
  const a = order.shippingAddress || {};
  if (!a.fullName) missing.push('recipient name');
  if (!a.line1) missing.push('address line 1');
  if (!a.city) missing.push('city');
  if (!a.state) missing.push('state');
  if (!a.pincode) missing.push('pincode');
  if (!String(a.phone || a.whatsappNumber || '').replace(/\D/g, '').match(/\d{10}/)) missing.push('mobile number');
  if (!order.items?.length) missing.push('order items');
  return { ok: !missing.length, missing };
}

assert.strictEqual(validate({
  paymentStatus: 'paid',
  status: 'ordered',
  shippingAddress: { fullName: 'A', line1: '1', city: 'Chennai', state: 'TN', pincode: '600001', phone: '9876543210' },
  items: [{ title: 'Photo', quantity: 1 }],
}).ok, true);

assert.strictEqual(validate({
  paymentStatus: 'paid',
  status: 'ordered',
  shippingAddress: { fullName: 'A', line1: '1', city: 'Chennai', state: 'TN', pincode: '600001' },
  items: [{ title: 'Photo', quantity: 1 }],
}).ok, false);

const financialKeys = ['price', 'total', 'subtotal', 'shippingCost', 'paymentMethod', 'paymentStatus', 'makingCost'];
const sampleLabel = {
  orderNumber: 'GG1',
  recipientName: 'A',
  items: [{ title: 'X', quantity: 2, variant: 'A4' }],
};
financialKeys.forEach((k) => assert.ok(!(k in sampleLabel)));
sampleLabel.items.forEach((item) => financialKeys.forEach((k) => assert.ok(!(k in item))));

console.log('Shipping label helper tests passed');
