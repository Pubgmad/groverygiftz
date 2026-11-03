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
vm.runInContext(`${source}\nmodule.exports = { istInclusiveRange, previousEquivalentRange, presetToRange, growthPercent, shapeKpis, shapeProducts, itemMatchAfterUnwind, narrowToMatchingItems, buildRevenueMatch, revenuePipeline, refundPipeline, paymentOutcomePipeline, REVENUE_DEFINITIONS, DATE_PRESETS, formatIstDateInput, shiftIstDate, uniquePlaceLabels, uniqueCityStateOptions, cityStateKey, parseCityStateKey, formatCityStateLabel, normalizePlaceLabel, shapeFilterOptions, shapeTrend, mergeProfitIntoTrend, istBucketLabel, mergeProfitIntoPlaces, filterOptionPipeline };`, context);
const {
  istInclusiveRange,
  previousEquivalentRange,
  presetToRange,
  growthPercent,
  shapeKpis,
  shapeProducts,
  itemMatchAfterUnwind,
  narrowToMatchingItems,
  buildRevenueMatch,
  revenuePipeline,
  refundPipeline,
  paymentOutcomePipeline,
  REVENUE_DEFINITIONS,
  DATE_PRESETS,
  formatIstDateInput,
  shiftIstDate,
  uniquePlaceLabels,
  uniqueCityStateOptions,
  cityStateKey,
  parseCityStateKey,
  formatCityStateLabel,
  normalizePlaceLabel,
  shapeFilterOptions,
  shapeTrend,
  mergeProfitIntoTrend,
  istBucketLabel,
  mergeProfitIntoPlaces,
  filterOptionPipeline,
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
  cities: [
    { city: 'Chennai', state: 'Tamil Nadu' },
    { city: 'chennai', state: 'tamil nadu' },
    { city: 'Salem', state: 'Tamil Nadu' },
    { city: 'Salem', state: 'West Bengal' },
  ],
  methods: [{ _id: 'Cashfree' }, { _id: 'cashfree' }],
  products: [{ _id: 'abc', title: ' Gift hamper ' }, { _id: '', title: 'skip' }],
}, [{ _id: 'col1', name: 'Festive' }]));
assert.strictEqual(shaped.cities.length, 3);
assert.ok(shaped.cities.some((row) => row.city === 'Chennai' && row.state === 'Tamil Nadu' && row.label === 'Chennai, Tamil Nadu'));
assert.ok(shaped.cities.some((row) => row.city === 'Salem' && row.state === 'Tamil Nadu'));
assert.ok(shaped.cities.some((row) => row.city === 'Salem' && row.state === 'West Bengal'));
assert.notEqual(
  shaped.cities.find((row) => row.state === 'Tamil Nadu' && row.city === 'Salem').value,
  shaped.cities.find((row) => row.state === 'West Bengal' && row.city === 'Salem').value,
);
assert.deepStrictEqual(shaped.states, ['Tamil Nadu']);
assert.deepStrictEqual(shaped.methods, ['Cashfree']);
assert.strictEqual(shaped.products.length, 1);
assert.strictEqual(shaped.products[0].title, 'Gift hamper');
assert.strictEqual(shaped.collections[0].name, 'Festive');

const scopedCities = host(shapeFilterOptions({
  cities: [
    { city: 'Salem', state: 'Tamil Nadu' },
    { city: 'Salem', state: 'West Bengal' },
  ],
}, [], { stateFilter: 'Tamil Nadu' }));
assert.strictEqual(scopedCities.cities.length, 1);
assert.strictEqual(scopedCities.cities[0].city, 'Salem');
assert.strictEqual(scopedCities.cities[0].state, 'Tamil Nadu');
assert.strictEqual(scopedCities.cities[0].label, 'Salem');

assert.strictEqual(formatCityStateLabel('Salem', 'Tamil Nadu'), 'Salem, Tamil Nadu');
const parsedCity = parseCityStateKey(cityStateKey('Salem', 'Tamil Nadu'));
assert.strictEqual(parsedCity.city, 'Salem');
assert.strictEqual(parsedCity.state, 'Tamil Nadu');

const cityFacet = JSON.stringify(filterOptionPipeline({ from: day.from, to: day.to }));
assert.ok(cityFacet.includes('shippingAddress.state'), 'city options must group by city and state');

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

const monthBucket = new Date('2026-11-01T00:00:00.000+05:30');
const monthTrend = shapeTrend([{ _id: monthBucket, collected: 1000, orders: 2, productSales: 900 }], 'month');
assert.strictEqual(monthTrend[0].label, istBucketLabel(monthBucket, 'month'));
assert.strictEqual(monthTrend[0].label, '2026-11');
const mergedMonth = mergeProfitIntoTrend(monthTrend, [{ label: '2026-11', makingCost: 400, grossProfit: 500, unknownRevenue: 0 }]);
assert.strictEqual(mergedMonth[0].grossProfit, 500);
assert.strictEqual(mergedMonth[0].makingCost, 400);

const geo = mergeProfitIntoPlaces(
  [{ label: 'Tamil Nadu', collected: 10000, orders: 5 }],
  [{ label: 'Tamil Nadu', makingCost: 2000, grossProfit: 3000, unknownRevenue: 100 }],
  'state',
);
assert.strictEqual(geo[0].collected, 10000);
assert.strictEqual(geo[0].grossProfit, 3000);

// Weekly $dateTrunc must keep startOfWeek inside the operator (screenshot crash).
const weekPipeline = JSON.stringify(revenuePipeline({
  from: day.from,
  to: day.to,
  granularity: 'week',
}));
assert.ok(weekPipeline.includes('"unit":"week"'));
assert.ok(weekPipeline.includes('startOfWeek'));
assert.ok(
  /"\$dateTrunc":\{[^}]*"startOfWeek":"monday"/.test(weekPipeline)
  || weekPipeline.includes('"$dateTrunc":{"date":"$eventAt","unit":"week","timezone":"Asia/Kolkata","startOfWeek":"monday"}'),
  'startOfWeek must be nested inside $dateTrunc',
);
assert.ok(!/"\$dateTrunc":\{[^}]+\},"startOfWeek"/.test(weekPipeline), 'startOfWeek must not be a sibling of $dateTrunc');

const last7 = presetToRange('last7');
assert.ok(last7);
const thisYear = presetToRange('thisYear');
const prevYear = previousEquivalentRange(thisYear.fromStr, thisYear.toStr);
assert.notEqual(last7.fromStr, thisYear.fromStr, 'Last 7 days must not equal This year start');
assert.ok(thisYear.fromStr.endsWith('-01-01'));
assert.ok(prevYear.fromStr < thisYear.fromStr);
assert.ok(prevYear.toStr < thisYear.fromStr);

assert.strictEqual(normalizePlaceLabel('Tamil\u00a0Nadu'), 'Tamil Nadu');
const placeMatch = JSON.stringify(buildRevenueMatch({
  from: day.from,
  to: day.to,
  state: 'Tamil\u00a0Nadu',
  city: 'Ayyampet',
}));
assert.ok(placeMatch.includes('\\u00a0') || placeMatch.includes('\u00a0') || placeMatch.includes('replaceAll'), 'geo match must normalize NBSP in Mongo');
assert.ok(placeMatch.includes('_normState'));

const cashfreeMatch = JSON.stringify(buildRevenueMatch({
  from: day.from,
  to: day.to,
  paymentMethod: 'Cashfree',
}));
assert.ok(cashfreeMatch.includes('$expr'), 'Cashfree filter must coalesce missing paymentMethod');
assert.ok(cashfreeMatch.includes('Cashfree'));

const refund = JSON.stringify(refundPipeline({
  from: day.from,
  to: day.to,
  status: 'dispatched',
}));
assert.ok(refund.includes('dispatched') || refund.includes('$in'), 'refund pipeline must honor status filter');

const outcomes = JSON.stringify(paymentOutcomePipeline({
  from: day.from,
  to: day.to,
}));
assert.ok(outcomes.includes('cancelled'), 'payment outcomes must exclude cancelled by default');

const zeroPriceKnown = shapeProducts([{
  title: 'Sample',
  units: 1,
  revenue: 0,
  knownRevenue: 0,
  unknownRevenue: 0,
  makingCost: 50,
  grossProfit: -50,
  knownCostUnits: 1,
  orders: 1,
}]);
assert.strictEqual(zeroPriceKnown[0].profitKnown, true);
assert.strictEqual(zeroPriceKnown[0].grossProfit, -50);

console.log('Revenue analytics helper tests passed');
