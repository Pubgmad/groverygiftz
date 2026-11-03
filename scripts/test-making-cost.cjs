const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '../src/lib/makingCost.js');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}\nmodule.exports = { isConfiguredCost, parseMoneyAmount, variantCostKey, normalizeVariantKey, findCostRow, resolveMakingCost, snapshotOrderItemCost, attributeItemCost, summarizeAttributedItems, stripMakingCostFromOrder, COST_STATUS };`, context);
const {
  isConfiguredCost,
  parseMoneyAmount,
  variantCostKey,
  normalizeVariantKey,
  findCostRow,
  resolveMakingCost,
  snapshotOrderItemCost,
  attributeItemCost,
  summarizeAttributedItems,
  stripMakingCostFromOrder,
  COST_STATUS,
} = context.module.exports;

assert.strictEqual(isConfiguredCost(0), true);
assert.strictEqual(isConfiguredCost(null), false);
assert.strictEqual(isConfiguredCost(undefined), false);
assert.strictEqual(isConfiguredCost(''), false);
assert.strictEqual(isConfiguredCost(-1), false);

assert.strictEqual(parseMoneyAmount('650').amount, 650);
assert.ok(parseMoneyAmount('-1').error);
assert.ok(parseMoneyAmount('').error);
assert.strictEqual(variantCostKey('Size', 'Large'), 'Size: Large');
assert.strictEqual(variantCostKey('', ''), '');

const product = {
  title: 'Customized Frame',
  variants: [{ name: 'Size', options: [{ label: 'Small' }, { label: 'Large' }] }],
};

const none = resolveMakingCost({ product, variantText: 'Size: Large', costs: [] });
assert.strictEqual(none.status, COST_STATUS.unknown);
assert.strictEqual(none.amount, null);

const productLevel = resolveMakingCost({
  product,
  variantText: 'Size: Large',
  costs: [{ variantKey: '', amount: 600 }],
});
assert.strictEqual(productLevel.status, COST_STATUS.known);
assert.strictEqual(productLevel.amount, 600);
assert.strictEqual(productLevel.source, 'product');

const variantLevel = resolveMakingCost({
  product,
  variantText: 'Size: Large',
  costs: [{ variantKey: '', amount: 600 }, { variantKey: 'Size: Large', amount: 650 }],
});
assert.strictEqual(variantLevel.amount, 650);
assert.strictEqual(variantLevel.source, 'variant');

const january = new Date('2026-01-15T12:00:00.000+05:30');
const march = new Date('2026-03-15T12:00:00.000+05:30');
const history = [
  { variantKey: '', amount: 600, effectiveFrom: new Date('2026-01-01T00:00:00.000+05:30') },
  { variantKey: '', amount: 750, effectiveFrom: new Date('2026-03-01T00:00:00.000+05:30') },
];
assert.strictEqual(resolveMakingCost({ product: { title: 'Frame' }, costs: history, at: january }).amount, 600);
assert.strictEqual(resolveMakingCost({ product: { title: 'Frame' }, costs: history, at: march }).amount, 750);
assert.strictEqual(resolveMakingCost({
  product: { title: 'Frame' },
  costs: history,
  at: new Date('2025-12-01T00:00:00.000+05:30'),
}).status, COST_STATUS.unknown);

const snapshot = snapshotOrderItemCost({ variant: 'Size: Small' }, product, [{ variantKey: 'Size: Small', amount: 300 }]);
assert.strictEqual(snapshot.makingCostStatus, 'known');
assert.strictEqual(snapshot.makingCost, 300);

const attributedSnapshot = attributeItemCost({ makingCostStatus: 'known', makingCost: 300, variant: 'Size: Large' }, product, [{ variantKey: 'Size: Large', amount: 999 }]);
assert.strictEqual(attributedSnapshot.source, 'snapshot');
assert.strictEqual(attributedSnapshot.amount, 300);

const oldOrder = attributeItemCost({ variant: '', price: 1399, quantity: 1 }, { title: 'Frame' }, history, january);
assert.strictEqual(oldOrder.amount, 600);
assert.strictEqual(oldOrder.source, 'history');

const summary = summarizeAttributedItems([
  { quantity: 2, revenue: 1998, makingCost: 650, status: 'known' },
  { quantity: 1, revenue: 999, makingCost: null, status: 'unknown' },
]);
assert.strictEqual(summary.productRevenue, 2997);
assert.strictEqual(summary.makingCostKnown, 1300);
assert.strictEqual(summary.productGrossProfit, 698);
assert.strictEqual(summary.unknownCostRevenue, 999);
assert.strictEqual(summary.complete, false);
assert.ok(summary.grossMarginPct !== null);

const publicOrder = stripMakingCostFromOrder({
  orderNumber: 'GG1',
  items: [{ title: 'Frame', price: 1399, makingCost: 650, makingCostStatus: 'known', makingCostSource: 'snapshot' }],
});
assert.strictEqual(publicOrder.items[0].makingCost, undefined);
assert.strictEqual(publicOrder.items[0].price, 1399);

assert.strictEqual(normalizeVariantKey(' Size:  Large '), 'size: large');
assert.ok(findCostRow([{ variantKey: 'Size: Large', amount: 180 }], 'size: large'));
assert.strictEqual(findCostRow([{ variantKey: 'Size: Small', amount: 100 }], 'Size: Large'), null);

const multi = {
  title: 'Combo',
  variants: [
    { name: 'Size', options: [{ label: '10x12' }, { label: '12x18' }] },
    { name: 'Finish', options: [{ label: 'Matte' }, { label: 'Gloss' }] },
  ],
};
const partial = resolveMakingCost({
  product: multi,
  variantText: 'Size: 10x12, Finish: Matte',
  costs: [{ variantKey: 'Size: 10x12', amount: 350 }],
});
assert.strictEqual(partial.status, COST_STATUS.unknown, 'partial multi-axis costs must stay unknown');

const fullMulti = resolveMakingCost({
  product: multi,
  variantText: 'Size: 10x12, Finish: Matte',
  costs: [
    { variantKey: 'Size: 10x12', amount: 350 },
    { variantKey: 'Finish: Matte', amount: 40 },
  ],
});
assert.strictEqual(fullMulti.status, COST_STATUS.known);
assert.strictEqual(fullMulti.amount, 390);

const looseLabel = resolveMakingCost({
  product,
  variantText: 'Large',
  costs: [{ variantKey: 'Size: Large', amount: 650 }],
});
assert.strictEqual(looseLabel.status, COST_STATUS.known);
assert.strictEqual(looseLabel.amount, 650);

// Screenshot-style reconciliation: profit and margin only on cost-covered revenue.
const covered = summarizeAttributedItems([
  { quantity: 10, revenue: 13990, makingCost: 770.18, status: 'known' },
  { quantity: 98, revenue: 137102, makingCost: null, status: 'unknown' },
]);
assert.strictEqual(covered.productRevenue, 151092);
assert.strictEqual(covered.unknownCostRevenue, 137102);
assert.strictEqual(covered.knownCostRevenue, 13990);
assert.ok(Math.abs(covered.makingCostKnown - 7701.8) < 0.01);
assert.ok(Math.abs(covered.productGrossProfit - 6288.2) < 0.01);
assert.strictEqual(covered.grossMarginPct, 44.9);
assert.strictEqual(covered.costCoveragePct, 9.3);
assert.strictEqual(covered.complete, false);

console.log('Making cost helper tests passed');
