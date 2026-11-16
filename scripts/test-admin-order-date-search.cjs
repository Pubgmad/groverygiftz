const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { test } = require('node:test');

function load(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*/gm, '')
    .replace(/export /g, '');
}

function api(files, extras = '') {
  const context = { module: { exports: {} }, exports: {}, console, ...extras };
  vm.createContext(context);
  vm.runInContext(`${files.join('\n')}\n${extras}`, context);
  return context;
}

test('order date from/to map to inclusive IST createdAt bounds and stay independent of paid dates', () => {
  const context = api([load('src/lib/adminFilters.js'), load('src/lib/csvExport.js'), load('src/lib/adminOrderQuery.js')], `
module.exports = { parseOrderReportFilters, buildAdminOrderFilter, istDayStart, istDayEnd };
`);
  const { parseOrderReportFilters, buildAdminOrderFilter, istDayStart, istDayEnd } = context.module.exports;
  const params = new Map([
    ['orderDateFrom', '2026-11-15'],
    ['orderDateTo', '2026-11-16'],
    ['dateFrom', '2026-11-01'],
    ['dateTo', '2026-11-02'],
  ]);
  params.get = Map.prototype.get;
  const parsed = parseOrderReportFilters(params);
  assert.equal(parsed.orderDateFrom, '2026-11-15');
  assert.equal(parsed.orderDateTo, '2026-11-16');
  assert.equal(parsed.dateFrom, '2026-11-01');
  const filter = buildAdminOrderFilter(parsed);
  assert.deepEqual(filter.createdAt.$gte, istDayStart('2026-11-15'));
  assert.deepEqual(filter.createdAt.$lte, istDayEnd('2026-11-16'));
  assert.deepEqual(filter.paidAt.$gte, istDayStart('2026-11-01'));
  assert.deepEqual(filter.paidAt.$lte, istDayEnd('2026-11-02'));
});

test('legacy single orderDate still expands to one IST day', () => {
  const context = api([load('src/lib/adminFilters.js'), load('src/lib/csvExport.js'), load('src/lib/adminOrderQuery.js')], `
module.exports = { parseOrderReportFilters, buildAdminOrderFilter, istDayStart, istDayEnd };
`);
  const { parseOrderReportFilters, buildAdminOrderFilter, istDayStart, istDayEnd } = context.module.exports;
  const parsed = parseOrderReportFilters({ get: (k) => (k === 'orderDate' ? '2026-11-15' : null) });
  const filter = buildAdminOrderFilter(parsed);
  assert.deepEqual(filter.createdAt.$gte, istDayStart('2026-11-15'));
  assert.deepEqual(filter.createdAt.$lte, istDayEnd('2026-11-15'));
});

test('order id and mobile search use safer patterns', () => {
  const context = api([load('src/lib/adminFilters.js'), load('src/lib/csvExport.js'), load('src/lib/adminOrderQuery.js')], `
module.exports = { parseOrderReportFilters, buildAdminOrderFilter };
`);
  const { parseOrderReportFilters, buildAdminOrderFilter } = context.module.exports;
  const gg = buildAdminOrderFilter(parseOrderReportFilters({ get: (k) => (k === 'orderId' || k === 'orderNumber' ? 'GG0028' : null) }));
  assert.equal(gg.orderNumber.$regex, '^GG0028');
  const mobile = buildAdminOrderFilter(parseOrderReportFilters({ get: (k) => (k === 'mobile' || k === 'mobileNumber' ? '+91 96002 53921' : null) }));
  assert.equal(mobile.$and[0].$or[0]['shippingAddress.phone'].$regex, '9600253921$');
});

test('admin orders page exposes order date from/to and clear-all-dates', () => {
  const page = fs.readFileSync(path.join(__dirname, '../src/app/account/manage/orders/page.js'), 'utf8');
  assert.match(page, /Order Date From/);
  assert.match(page, /Order Date To/);
  assert.match(page, /orderDateFrom/);
  assert.match(page, /orderDateTo/);
  assert.match(page, /clearAllDates/);
  assert.match(page, /useDebouncedValue/);
  assert.doesNotMatch(page, /label className="mb-1 block text-xs font-semibold text-gray-500">Order Date</);
});

test('product search escapes regex and ranks exact titles highest', () => {
  const context = api([load('src/lib/adminFilters.js'), load('src/lib/productSearch.js')], `
module.exports = { normalizeProductSearchQuery, buildProductTextFilter, scoreProductMatch, rankProductMatches };
`);
  const {
    normalizeProductSearchQuery,
    buildProductTextFilter,
    scoreProductMatch,
    rankProductMatches,
  } = context.module.exports;
  assert.equal(normalizeProductSearchQuery('  photo   frame  '), 'photo frame');
  const built = buildProductTextFilter('frame (wood)');
  assert.match(built.filter.$or[0].title.$regex, /frame \\\(wood\\\)/);
  const ranked = rankProductMatches([
    { title: 'Gift Box' },
    { title: 'Photo Frame' },
    { title: 'Wooden Photo Frame Deluxe' },
  ], 'photo frame');
  assert.equal(ranked[0].title, 'Photo Frame');
  assert.ok(scoreProductMatch({ title: 'Photo Frame' }, 'photo frame') > scoreProductMatch({ title: 'Gift Box' }, 'photo frame'));
});
