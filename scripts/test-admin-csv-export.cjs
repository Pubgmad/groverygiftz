const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function load(rel) {
  return fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')
    .replace(/^import[\s\S]*?from ['"][^'"]+['"];?\s*/gm, '')
    .replace(/export /g, '');
}

const source = [
  load('src/lib/adminFilters.js'),
  load('src/lib/csvExport.js'),
  load('src/lib/adminOrderQuery.js'),
  load('src/lib/adminCustomerQuery.js'),
].join('\n');

const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}
module.exports = {
  csvCell, csvRow, csvDocument, formatInrAmount, csvFilename,
  parseIstRange, formatIstDateInput, istDayStart, istDayEnd,
  parseOrderReportFilters, buildAdminOrderFilter, orderCsvValues, ORDER_CSV_HEADERS, orderCsvFilename,
  parseCustomerReportFilters, buildCustomerAccountMatch, buildPurchaseMetricMatch,
  customerCsvValues, CUSTOMER_CSV_HEADERS, customerCsvFilename, customerReportPipeline, shapeCustomerRow,
};
`, context);
const {
  csvCell, csvRow, csvDocument, formatInrAmount, csvFilename,
  parseIstRange, formatIstDateInput, istDayStart, istDayEnd,
  parseOrderReportFilters, buildAdminOrderFilter, orderCsvValues, ORDER_CSV_HEADERS, orderCsvFilename,
  parseCustomerReportFilters, buildCustomerAccountMatch, buildPurchaseMetricMatch,
  customerCsvValues, CUSTOMER_CSV_HEADERS, customerCsvFilename, customerReportPipeline, shapeCustomerRow,
} = context.module.exports;

assert.strictEqual(csvCell('hello'), 'hello');
assert.strictEqual(csvCell('hello, world'), '"hello, world"');
assert.strictEqual(csvCell('He said "hi"'), '"He said ""hi"""');
assert.strictEqual(csvCell('line1\nline2'), '"line1\nline2"');
assert.strictEqual(csvCell('=cmd'), "'=cmd");
assert.strictEqual(csvCell('+1+1'), "'+1+1");
assert.strictEqual(csvCell('-2+3'), "'-2+3");
assert.strictEqual(csvCell('@SUM(A1)'), "'@SUM(A1)");
assert.ok(csvDocument(['A'], [['1']]).startsWith('\uFEFF'));
assert.strictEqual(formatInrAmount(1234), '1234.00');
assert.strictEqual(formatInrAmount(null), '');

const range = parseIstRange('2026-11-01', '2026-11-02');
assert.strictEqual(range.fromStr, '2026-11-01');
assert.strictEqual(range.toStr, '2026-11-02');
assert.strictEqual(istDayStart('2026-11-01').toISOString(), new Date('2026-11-01T00:00:00.000+05:30').toISOString());
assert.strictEqual(istDayEnd('2026-11-02').toISOString(), new Date('2026-11-02T23:59:59.999+05:30').toISOString());
assert.strictEqual(parseIstRange('2026-11-02', '2026-11-01').error, 'From date cannot be after To date');
assert.ok(parseIstRange('2026-11-31', '2026-11-31').error);

const params = new Map([
  ['status', 'on_process'],
  ['dateFrom', '2026-11-01'],
  ['dateTo', '2026-11-02'],
  ['mobile', '9600253921'],
  ['orderId', 'GG0001'],
]);
params.get = Map.prototype.get;
const parsedOrders = parseOrderReportFilters(params);
assert.strictEqual(parsedOrders.status, 'on_process');
assert.strictEqual(parsedOrders.mobile, '9600253921');
const orderFilter = buildAdminOrderFilter(parsedOrders);
assert.strictEqual(orderFilter.paymentStatus, 'paid');
assert.deepStrictEqual(JSON.parse(JSON.stringify(orderFilter.status.$in)), ['on_process', 'processing']);
assert.ok(orderFilter.orderNumber.$regex);
assert.strictEqual(Object.prototype.toString.call(orderFilter.paidAt.$gte), '[object Date]');
assert.strictEqual(Object.prototype.toString.call(orderFilter.paidAt.$lte), '[object Date]');
assert.strictEqual(csvFilename('orders', '2026-11-01', '2026-11-02'), 'orders_2026-11-01_to_2026-11-02.csv');
assert.strictEqual(orderCsvFilename(parsedOrders), 'orders_2026-11-01_to_2026-11-02.csv');

const emptyOrderFilter = buildAdminOrderFilter(parseOrderReportFilters({ get: () => null }));
assert.deepStrictEqual(JSON.parse(JSON.stringify(emptyOrderFilter)), { paymentStatus: 'paid' });

const orderRow = orderCsvValues({
  orderNumber: 'GG0001',
  paidAt: new Date('2026-11-01T10:00:00.000+05:30'),
  status: 'on_process',
  paymentMethod: 'Cashfree',
  paymentStatus: 'paid',
  subtotal: 900,
  shippingCost: 100,
  total: 1000,
  trackingNumber: 'ST123',
  shippingAddress: {
    fullName: 'Raj, Test',
    email: 'raj@example.com',
    phone: '9600253921',
    whatsappNumber: '9600253921',
    line1: '12 "Main" St',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
  },
  items: [
    { title: 'Frame', variant: 'Size: Large', quantity: 2, price: 300 },
    { title: 'Mug', variant: '', quantity: 1, price: 300 },
  ],
});
assert.strictEqual(orderRow[0], 'GG0001');
assert.ok(String(orderRow[1]).includes('IST'));
assert.strictEqual(orderRow[14], 'Size: Large | No variant');
assert.strictEqual(orderRow[15], '2 | 1');
assert.strictEqual(orderRow[16], '900.00');
assert.strictEqual(orderRow[18], '1000.00');
assert.strictEqual(orderRow.length, ORDER_CSV_HEADERS.length);
assert.ok(!ORDER_CSV_HEADERS.join(' ').toLowerCase().includes('cashfree'));
assert.ok(!ORDER_CSV_HEADERS.join(' ').toLowerCase().includes('password'));
assert.ok(!ORDER_CSV_HEADERS.includes('Discounts'));

const customerParams = new Map([
  ['name', 'Raj'],
  ['customerType', 'purchased'],
  ['dateFrom', '2026-11-01'],
  ['dateTo', '2026-11-30'],
]);
customerParams.get = Map.prototype.get;
const parsedCustomers = parseCustomerReportFilters(customerParams);
assert.strictEqual(parsedCustomers.name, 'Raj');
assert.strictEqual(parsedCustomers.customerType, 'purchased');
const accountMatch = buildCustomerAccountMatch(parsedCustomers);
assert.ok(accountMatch.name.$regex);
assert.strictEqual(Object.prototype.toString.call(accountMatch.createdAt.$gte), '[object Date]');
assert.deepStrictEqual(JSON.parse(JSON.stringify(buildPurchaseMetricMatch(parsedCustomers))), { customerType: 'purchased' });
assert.strictEqual(customerCsvFilename(parsedCustomers), 'customers_2026-11-01_to_2026-11-30.csv');

const badType = new Map([['customerType', 'bogus-type']]);
assert.strictEqual(parseCustomerReportFilters(badType).error, 'Unknown customer type filter');

const customerRow = customerCsvValues({
  _id: 'cust1',
  name: 'Raj',
  email: 'raj@example.com',
  phone: '9600253921',
  createdAt: new Date('2026-11-01T09:00:00.000+05:30'),
  totalOrders: 2,
  qualifyingOrders: 1,
  totalSpent: 1000,
  firstPurchaseAt: new Date('2026-11-01T10:00:00.000+05:30'),
  lastPurchaseAt: new Date('2026-11-02T10:00:00.000+05:30'),
  customerType: 'purchased',
});
assert.strictEqual(customerRow[0], 'cust1');
assert.strictEqual(customerRow[6], '1');
assert.strictEqual(customerRow[7], '1000.00');
assert.strictEqual(customerRow[10], 'Purchased');
assert.strictEqual(customerRow.length, CUSTOMER_CSV_HEADERS.length);
assert.ok(!CUSTOMER_CSV_HEADERS.join(' ').toLowerCase().includes('password'));
assert.ok(!CUSTOMER_CSV_HEADERS.join(' ').toLowerCase().includes('token'));

const listingPipeline = JSON.stringify(customerReportPipeline(parsedCustomers, { skip: 0, limit: 10 }));
const exportPipeline = JSON.stringify(customerReportPipeline(parsedCustomers));
assert.ok(listingPipeline.includes('$facet'));
assert.ok(!exportPipeline.includes('$facet'));
assert.ok(listingPipeline.includes('"customerType":"purchased"'));
assert.ok(exportPipeline.includes('"customerType":"purchased"'));
assert.strictEqual(shapeCustomerRow({ name: 'Raj', customerType: 'purchased', qualifyingOrders: 2 }).qualifyingOrders, 2);

const quoted = csvRow(['Raj, Test', 'He said "hi"']);
assert.strictEqual(quoted, '"Raj, Test","He said ""hi"""');

const today = formatIstDateInput();
assert.strictEqual(csvFilename('customers', '', ''), `customers_all_${today}.csv`);

console.log('Admin CSV export helper tests passed');
