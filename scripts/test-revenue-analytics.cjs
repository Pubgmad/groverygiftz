const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '../src/lib/revenueAnalytics.js');
const source = fs.readFileSync(sourcePath, 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ')
  .replace(/export \{ IST, WEEKDAYS, STATUS_GROUPS \};/, '');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}\nmodule.exports = { istInclusiveRange, previousEquivalentRange, presetToRange, growthPercent, shapeKpis, REVENUE_DEFINITIONS, DATE_PRESETS, formatIstDateInput, shiftIstDate, uniquePlaceLabels, shapeFilterOptions };`, context);
const {
  istInclusiveRange,
  previousEquivalentRange,
  growthPercent,
  shapeKpis,
  REVENUE_DEFINITIONS,
  DATE_PRESETS,
  formatIstDateInput,
  shiftIstDate,
  uniquePlaceLabels,
  shapeFilterOptions,
} = context.module.exports;

const day = istInclusiveRange('2026-11-02', '2026-11-02');
assert.strictEqual(day.from.toISOString(), '2026-11-01T18:30:00.000Z');
assert.strictEqual(day.to.toISOString(), '2026-11-02T18:29:59.999Z');

const week = previousEquivalentRange('2026-11-01', '2026-11-07');
assert.ok(week.from < week.to);
assert.ok(week.to.getTime() < day.from.getTime() || week.toStr === '2026-10-31');

assert.strictEqual(growthPercent(150, 100), 50);
assert.strictEqual(growthPercent(0, 0), 0);
assert.strictEqual(growthPercent(10, 0), null);

const kpis = shapeKpis({ collected: 1000, productSales: 900, shipping: 100, orders: 4, units: 7 }, { collected: 500, orders: 2 }, { amount: 200, orders: 1 });
assert.strictEqual(kpis.collectedRevenue, 1000);
assert.strictEqual(kpis.averageOrderValue, 250);
assert.strictEqual(kpis.refundedAmount, 200);
assert.strictEqual(kpis.revenueGrowthPct, 100);
assert.ok(!String(REVENUE_DEFINITIONS.profit).toLowerCase().includes('₹'));
assert.ok(DATE_PRESETS.some((item) => item.id === 'last30'));
assert.ok(!REVENUE_DEFINITIONS.district.includes('inferred') || REVENUE_DEFINITIONS.district.includes('not inferred') || REVENUE_DEFINITIONS.district.includes('not recorded'));

const next = shiftIstDate('2026-11-02', -1);
assert.strictEqual(next, '2026-11-01');
assert.ok(formatIstDateInput(new Date('2026-11-02T00:30:00.000Z')).length === 10);

const host = (value) => JSON.parse(JSON.stringify(value));
assert.deepStrictEqual(
  host(uniquePlaceLabels(['Chennai', 'chennai', ' CHENNAI ', 'Chennai\u00a0', 'Coimbatore'])),
  ['Chennai', 'Coimbatore'],
);
assert.deepStrictEqual(
  host(uniquePlaceLabels(['tamil nadu', 'Tamil Nadu', 'TAMIL NADU'])),
  ['Tamil Nadu'],
);

const shaped = host(shapeFilterOptions({
  states: [{ _id: 'tamil nadu', label: 'Tamil Nadu' }, { _id: 'tamil nadu', label: 'tamil nadu' }],
  cities: [{ _id: 'chennai', label: 'Chennai' }, { _id: 'chennai', label: 'chennai' }],
  methods: [{ _id: 'Cashfree' }, { _id: 'cashfree' }],
  products: [{ _id: 'abc', title: ' Gift hamper ' }, { _id: '', title: 'skip' }],
}, [{ _id: 'col1', name: 'Festive' }]));
assert.deepStrictEqual(shaped.cities, ['Chennai']);
assert.deepStrictEqual(shaped.states, ['Tamil Nadu']);
assert.deepStrictEqual(shaped.methods, ['Cashfree']);
assert.strictEqual(shaped.products.length, 1);
assert.strictEqual(shaped.products[0].title, 'Gift hamper');
assert.strictEqual(shaped.collections[0].name, 'Festive');

console.log('Revenue analytics helper tests passed');
