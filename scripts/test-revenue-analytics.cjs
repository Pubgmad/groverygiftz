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
vm.runInContext(`${source}\nmodule.exports = { istInclusiveRange, previousEquivalentRange, presetToRange, growthPercent, shapeKpis, shapeProducts, itemMatchAfterUnwind, narrowToMatchingItems, buildRevenueMatch, revenuePipeline, REVENUE_DEFINITIONS, DATE_PRESETS, formatIstDateInput, shiftIstDate, uniquePlaceLabels, shapeFilterOptions };`, context);
const {
  istInclusiveRange,
  previousEquivalentRange,
  growthPercent,
  shapeKpis,
  shapeProducts,
  itemMatchAfterUnwind,
  narrowToMatchingItems,
  buildRevenueMatch,
  revenuePipeline,
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

const kpis = shapeKpis(
  { collected: 1000, productSales: 900, shipping: 100, orders: 4, units: 7 },
  { collected: 500, orders: 2 },
  { amount: 200, orders: 1 },
  { productGrossProfit: 400, makingCostKnown: 500, knownCostRevenue: 900, unknownCostRevenue: 0, costCoveragePct: 100, complete: true, grossMarginPct: 44.4 },
  { productGrossProfit: 200 },
);
assert.strictEqual(kpis.collectedRevenue, 1000);
assert.strictEqual(kpis.averageOrderValue, 250);
assert.strictEqual(kpis.refundedAmount, 200);
assert.strictEqual(kpis.revenueGrowthPct, 100);
assert.strictEqual(kpis.productGrossProfit, 400);
assert.strictEqual(kpis.makingCostKnown, 500);
assert.strictEqual(kpis.profitGrowthPct, 100);
assert.ok(!String(REVENUE_DEFINITIONS.profit).toLowerCase().includes('₹'));
assert.ok(String(REVENUE_DEFINITIONS.profit).toLowerCase().includes('not net business profit'));
assert.ok(String(REVENUE_DEFINITIONS.uniqueBuyers).toLowerCase().includes('one buyer'));
assert.ok(String(REVENUE_DEFINITIONS.repeatBuyers).toLowerCase().includes('two'));
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

const unknownProfit = shapeProducts([{
  productId: 'p1',
  title: 'Frame',
  units: 11,
  revenue: 16489,
  orders: 10,
  makingCost: 0,
  grossProfit: 0,
  knownRevenue: 0,
  unknownRevenue: 16489,
  costCoveragePct: 0,
}]);
assert.strictEqual(unknownProfit[0].profitKnown, false);
assert.strictEqual(unknownProfit[0].grossProfit, null);
assert.strictEqual(unknownProfit[0].makingCost, null);
assert.strictEqual(unknownProfit[0].marginPct, null);

const knownProfit = shapeProducts([{
  productId: 'p2',
  title: 'Combo',
  units: 108,
  revenue: 151092,
  orders: 108,
  makingCost: 83200,
  grossProfit: 67892,
  knownRevenue: 151092,
  unknownRevenue: 0,
  marginPct: 44.9,
  costCoveragePct: 100,
}]);
assert.strictEqual(knownProfit[0].profitKnown, true);
assert.strictEqual(knownProfit[0].grossProfit, 67892);
assert.strictEqual(knownProfit[0].marginPct, 44.9);

assert.strictEqual(itemMatchAfterUnwind({}).length, 0);
assert.strictEqual(itemMatchAfterUnwind({ productId: 'abc' })[0].$match['items.product'], 'abc');
const variantMatch = itemMatchAfterUnwind({ variant: 'Size: Large' })[0].$match['items.variant'].$regex;
assert.ok(variantMatch.startsWith('^\\s*') || variantMatch.startsWith('^\\s*'), 'allow leading whitespace on stored variants');
assert.ok(variantMatch.includes('\\s*$'));
assert.ok(variantMatch.includes('Size'));

const matchStages = buildRevenueMatch({
  from: day.from,
  to: day.to,
  variant: 'Size: 12x18',
  city: 'Chennai',
});
assert.ok(JSON.stringify(matchStages).includes('items.variant'));
assert.ok(JSON.stringify(matchStages).includes('Size: 12x18'), 'variant filter must stay exact (not substring)');
assert.ok(JSON.stringify(matchStages).includes('_normCity'), 'city filter must trim padded address values');

const pipeline = revenuePipeline({
  from: day.from,
  to: day.to,
  variant: 'Size: 12x18',
  granularity: 'day',
});
assert.ok(JSON.stringify(pipeline).includes('items.variant'), 'revenuePipeline must keep the variant filter');
assert.ok(JSON.stringify(pipeline).includes('$filter'), 'product/variant filters must narrow order items before KPIs');

assert.strictEqual(narrowToMatchingItems({}).length, 0);
assert.ok(narrowToMatchingItems({ productId: 'abc' }).length >= 2);
assert.ok(JSON.stringify(buildRevenueMatch({
  from: day.from,
  to: day.to,
  productIds: ['a', 'b'],
})).includes('$in'), 'collection multi-product filter must use $in');

console.log('Revenue analytics helper tests passed');
