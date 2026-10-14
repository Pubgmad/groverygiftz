const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');

const read = (file) => fs.readFileSync(file, 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
const source = (file) => read(file).replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const purchaseSource = source('src/lib/metaPurchase.js');
function load(extraSource = '', globals = {}) {
  const context = vm.createContext({ console: { warn() {}, info() {}, error() {} }, URL, AbortSignal, crypto, process: { env: {} }, ...globals });
  vm.runInContext(purchaseSource + '\n' + extraSource, context);
  return context;
}
const paidOrder = (overrides = {}) => ({
  _id: 'order-database-id-1', orderNumber: 'GG0063', paymentStatus: 'paid',
  paidAt: new Date().toISOString(), total: 1499, subtotal: 1399, shippingCost: 100,
  items: [{ product: 'product-1', price: 1399, quantity: 1 }],
  shippingAddress: { fullName: 'Test Customer', email: 'test@example.invalid', phone: '9876543210', city: 'Chennai', state: 'Tamil Nadu', pincode: '600001' },
  ...overrides,
});
const settings = { metaPixelId: 'test-pixel', metaConversionApiEnabled: true, metaConversionApiAccessToken: 'test-token' };
const browserSource = source('src/lib/metaPixel.js');
const serverSource = source('src/lib/metaConversionApi.js');
function browser(storage = new Map(), ready = true) {
  const events = [];
  const window = { localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) } };
  if (ready) window.fbq = (...args) => events.push(plain(args));
  const context = load(browserSource, { window });
  context.configureMetaPixel({ enabled: true, pixelId: 'test-pixel' });
  return { context, events, window, storage };
}
function verified(context, order) {
  return { success: true, paymentStatus: 'paid', orderNumber: order.orderNumber, total: order.total, metaPurchase: context.buildMetaPurchase(order) };
}

for (const [name, changes] of [
  ['discounted product', { total: 999, subtotal: 999, shippingCost: 0, items: [{ product: 'p', price: 999, regularPrice: 1499, quantity: 1 }] }],
  ['shipping included', { total: 1549, subtotal: 1399, shippingCost: 150 }],
  ['multiple products and quantities', { total: 2500, items: [{ product: 'a', price: 500, quantity: 2 }, { product: 'b', price: 750, quantity: 2 }] }],
  ['selected variant price', { total: 750, items: [{ product: 'p', variant: 'Size: Large', price: 750, quantity: 1 }] }],
  ['zero-valued legitimate order', { total: 0 }],
  ['different legitimate total', { total: 199.5 }],
]) {
  test(`matching Pixel/CAPI INR amount for ${name}`, () => {
    const { context, events } = browser();
    const order = paidOrder(changes);
    const server = load(serverSource);
    const payload = server.buildPurchasePayload(order, settings).payload.data[0];
    context.trackVerifiedMetaPurchase(verified(context, order));
    assert.equal(events.length, 1);
    assert.equal(events[0][0], 'trackSingle');
    assert.equal(events[0][1], 'test-pixel');
    assert.deepEqual(events[0][3], plain(payload.custom_data));
    assert.equal(events[0][3].value, order.total);
    assert.equal(events[0][3].currency, 'INR');
    assert.equal(events[0][4].eventID, payload.event_id);
  });
}
test('gateway minor-unit metadata never overrides saved rupee total', () => {
  const c = load();
  assert.equal(c.buildMetaPurchase(paidOrder({ total: 1499, gatewayAmountInPaise: 149900 })).params.value, 1499);
});
for (const status of ['pending', 'failed', 'cancelled', 'refunded']) {
  test(`${status} payment cannot produce Purchase`, () => {
    const { context, events } = browser();
    const order = paidOrder({ paymentStatus: status });
    assert.equal(context.buildMetaPurchase(order), null);
    assert.equal(context.trackVerifiedMetaPurchase({ ...verified(context, paidOrder()), success: false, paymentStatus: status }), false);
    assert.equal(events.length, 0);
  });
}
test('invalid or missing totals and timestamps are rejected without zero/subtotal fallback', () => {
  const c = load();
  for (const total of [undefined, null, '', ' ', 'INR 1,499', '₹1,499', NaN, Infinity, -1, true, {}]) {
    assert.equal(c.buildMetaPurchase(paidOrder({ total })), null, String(total));
  }
  assert.equal(c.buildMetaPurchase(paidOrder({ paidAt: undefined })), null);
  assert.equal(c.buildMetaPurchase(paidOrder({ paidAt: 'invalid' })), null);
});
test('numeric saved amounts and INR default are normalized consistently', () => {
  const c = load();
  assert.equal(c.buildMetaPurchase(paidOrder({ total: '1499.50' })).params.value, 1499.5);
  assert.equal(c.buildMetaPurchase(paidOrder()).params.currency, 'INR');
  assert.equal(c.buildMetaPurchase(paidOrder({ currency: 'USD' })), null);
});
test('reused display order number cannot reuse a new Meta event ID', () => {
  const c = load();
  assert.notEqual(c.buildMetaPurchase(paidOrder({ _id: 'first' })).eventId, c.buildMetaPurchase(paidOrder({ _id: 'second' })).eventId);
  assert.equal(c.buildMetaPurchase(paidOrder({ metaConversionPurchaseEventId: 'purchase-GG0063' })).eventId, 'purchase-GG0063');
});
test('a pending order number or missing identity cannot produce Purchase', () => {
  const c = load();
  assert.equal(c.buildMetaPurchase(paidOrder({ orderNumber: 'PENDING-TEST' })), null);
  assert.equal(c.buildMetaPurchase(paidOrder({ _id: '' })), null);
});
test('receipt refresh and repeated verification produce one browser event', () => {
  const first = browser();
  const result = verified(first.context, paidOrder());
  first.context.trackVerifiedMetaPurchase(result);
  first.context.trackVerifiedMetaPurchase(result);
  assert.equal(first.events.length, 1);
  const reloaded = browser(first.storage);
  reloaded.context.trackVerifiedMetaPurchase(result);
  assert.equal(reloaded.events.length, 0);
});
test('a historic receipt cannot create a new browser conversion', () => {
  const { context, events } = browser();
  context.trackVerifiedMetaPurchase(verified(context, paidOrder({ paidAt: new Date(Date.now() - 3 * 86400000).toISOString() })));
  assert.equal(events.length, 0);
});
test('verified Purchase is queued until Pixel initialization and then sent once', () => {
  const { context, events, window } = browser(new Map(), false);
  context.trackVerifiedMetaPurchase(verified(context, paidOrder()));
  assert.equal(events.length, 0);
  window.fbq = (...args) => events.push(plain(args));
  context.flushMetaPurchases();
  context.flushMetaPurchases();
  assert.equal(events.length, 1);
});
test('browser rejects malformed snapshots, stale cart totals, and unverified manual Purchase', () => {
  const { context, events } = browser();
  const result = verified(context, paidOrder());
  assert.equal(context.trackVerifiedMetaPurchase({ ...result, total: 1 }), false);
  assert.equal(context.trackVerifiedMetaPurchase({ ...result, metaPurchase: { ...result.metaPurchase, params: { ...result.metaPurchase.params, currency: undefined } } }), false);
  assert.equal(context.trackMetaEvent('Purchase', { value: 1499, currency: 'INR', order_id: 'GG0063', event_id: 'manual' }), false);
  assert.equal(events.length, 0);
});
test('blocked storage still deduplicates in memory; independent purchases still fire', () => {
  const { context, events, window } = browser();
  window.localStorage.getItem = () => { throw new Error('Blocked storage'); };
  window.localStorage.setItem = () => { throw new Error('Blocked storage'); };
  const result = verified(context, paidOrder());
  context.trackVerifiedMetaPurchase(result);
  context.trackVerifiedMetaPurchase(result);
  context.trackVerifiedMetaPurchase(verified(context, paidOrder({ _id: 'other', orderNumber: 'GG0064' })));
  assert.equal(events.length, 2);
});
test('PageView, ViewContent, AddToCart, InitiateCheckout, Search and custom events still work', () => {
  const { context, events } = browser();
  for (const name of ['PageView', 'ViewContent', 'AddToCart', 'InitiateCheckout', 'Search']) context.trackMetaEvent(name, { currency: 'INR', value: 100 });
  context.trackMetaCustomEvent('CustomizeProduct', { field_label: 'Frame' });
  assert.equal(events.length, 6);
  assert.equal(events[5][0], 'trackCustom');
  assert.equal(context.buildCartMetaPayload([{ productId: 'p', price: 100, quantity: 2 }], 250).value, 250);
});
test('Pixel initialization disables automatic setup before init and installs one SDK', () => {
  const { context, events, window } = browser();
  const scripts = new Map();
  context.document = { getElementById: (id) => scripts.get(id), createElement: () => ({}), head: { appendChild: (script) => scripts.set(script.id, script) } };
  const install = read('src/components/meta/MetaPixelClient.js').split('function installMetaPixel')[1].split('export default')[0];
  vm.runInContext('function installMetaPixel' + install, context);
  context.installMetaPixel('test-pixel');
  context.installMetaPixel('test-pixel');
  assert.deepEqual(events[0], ['set', 'autoConfig', false, 'test-pixel']);
  assert.deepEqual(events[1], ['init', 'test-pixel']);
  assert.equal(events.length, 2);
  assert.equal(scripts.size, 1);
  assert.equal(window.__groveryGiftzMetaPixelId, 'test-pixel');
});

function matches(doc, filter) {
  return Object.entries(filter).every(([key, value]) => {
    if (key === '$or') return value.some((entry) => matches(doc, entry));
    if (value === null) return doc[key] == null;
    if (value && typeof value === 'object' && '$exists' in value) return (doc[key] !== undefined) === value.$exists;
    if (value && typeof value === 'object' && '$lt' in value) return doc[key] != null && new Date(doc[key]) < value.$lt;
    if (value instanceof Date) return doc[key] != null && new Date(doc[key]).getTime() === value.getTime();
    return doc[key] === value;
  });
}
function apply(doc, update) {
  Object.assign(doc, update.$set || {});
  for (const key of Object.keys(update.$unset || {})) delete doc[key];
}
function serverFixture(order = paidOrder(), fetchImpl = async () => ({ ok: true, status: 200, json: async () => ({ events_received: 1 }) }), config = settings) {
  const doc = { ...order };
  const requests = [];
  const Order = {
    async findOneAndUpdate(filter, update) {
      if (!matches(doc, filter)) return null;
      apply(doc, update);
      return { ...doc };
    },
    async updateOne(filter, update) {
      if (!matches(doc, filter)) return { matchedCount: 0 };
      apply(doc, update);
      return { matchedCount: 1 };
    },
  };
  const context = load(serverSource, {
    Order, Settings: { findOne: () => ({ select: () => ({ lean: async () => config }) }) },
    fetch: async (url, options) => { requests.push({ url, payload: JSON.parse(options.body), signal: options.signal }); return fetchImpl(requests.length); },
  });
  return { context, requests, doc };
}
test('duplicate and concurrent webhooks send one CAPI event', async () => {
  const { context, requests, doc } = serverFixture();
  await Promise.all([context.sendMetaPurchaseEvent(doc._id), context.sendMetaPurchaseEvent(doc._id)]);
  await context.sendMetaPurchaseEvent(doc._id);
  assert.equal(requests.length, 1);
  assert.ok(doc.metaConversionPurchaseSentAt);
  assert.equal(doc.metaConversionPurchaseEventId, 'purchase-order-database-id-1');
  assert.equal(doc.metaConversionPurchaseStartedAt, undefined);
  assert.equal(requests[0].url.includes('test-token'), false);
  assert.ok(requests[0].signal);
});
test('transient Meta failure retries the identical event, value and currency', async () => {
  const { context, requests, doc } = serverFixture(paidOrder(), async (call) => ({ ok: call > 1, status: call > 1 ? 200 : 503, json: async () => call > 1 ? { events_received: 1 } : { error: { is_transient: true } } }));
  assert.equal((await context.sendMetaPurchaseEvent(doc._id)).sent, true);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].payload, requests[1].payload);
});
test('network timeout retries once with the same identifier', async () => {
  const { context, requests, doc } = serverFixture(paidOrder(), async (call) => {
    if (call === 1) { const error = new Error('Timeout'); error.name = 'TimeoutError'; throw error; }
    return { ok: true, status: 200, json: async () => ({ events_received: 1 }) };
  });
  await context.sendMetaPurchaseEvent(doc._id);
  assert.equal(requests.length, 2);
  assert.deepEqual(requests[0].payload, requests[1].payload);
});
test('unsuccessful acknowledgement is not marked sent and releases the claim', async () => {
  const { context, doc } = serverFixture(paidOrder(), async () => ({ ok: true, status: 200, json: async () => ({ events_received: 0 }) }));
  assert.equal((await context.sendMetaPurchaseEvent(doc._id)).sent, false);
  assert.equal(doc.metaConversionPurchaseSentAt, undefined);
  assert.equal(doc.metaConversionPurchaseStartedAt, undefined);
  assert.match(doc.metaConversionPurchaseError, /not accepted/);
});
test('stale interrupted send lock can be recovered, fresh lock is respected', async () => {
  const stale = serverFixture(paidOrder({ metaConversionPurchaseStartedAt: new Date(Date.now() - 600000), metaConversionPurchaseEventId: 'existing-stable-id' }));
  await stale.context.sendMetaPurchaseEvent(stale.doc._id);
  assert.equal(stale.requests.length, 1);
  assert.equal(stale.requests[0].payload.data[0].event_id, 'existing-stable-id');
  const fresh = serverFixture(paidOrder({ metaConversionPurchaseStartedAt: new Date() }));
  await fresh.context.sendMetaPurchaseEvent(fresh.doc._id);
  assert.equal(fresh.requests.length, 0);
});
test('server never posts pending, invalid-valued or disabled-config purchases', async () => {
  for (const changes of [{ paymentStatus: 'pending' }, { total: undefined }, { total: NaN }, { total: -1 }]) {
    const fixture = serverFixture(paidOrder(changes));
    await fixture.context.sendMetaPurchaseEvent(fixture.doc._id);
    assert.equal(fixture.requests.length, 0);
  }
  const fixture = serverFixture(paidOrder(), undefined, { ...settings, metaConversionApiEnabled: false });
  await fixture.context.sendMetaPurchaseEvent(fixture.doc._id);
  assert.equal(fixture.requests.length, 0);
});
test('CAPI retains hashed matching, verified purchase time and checkout source', () => {
  const c = load(serverSource);
  const order = paidOrder();
  const event = c.buildPurchasePayload(order, { ...settings, metaPixelTestEventCode: 'TEST-ONLY' }).payload;
  assert.equal(event.data[0].event_time, Math.floor(new Date(order.paidAt).getTime() / 1000));
  assert.equal(event.data[0].event_source_url, 'https://groverygiftz.in/checkout');
  assert.equal(event.data[0].action_source, 'website');
  assert.equal(event.data[0].user_data.ph, crypto.createHash('sha256').update('919876543210').digest('hex'));
  for (const hash of Object.values(event.data[0].user_data)) assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(event.test_event_code, 'TEST-ONLY');
});
test('cashfree verification response exposes tracking only after confirmed payment', () => {
  const c = load('', { getDisplayDeliveryEstimate: () => '8 working days' });
  const text = read('src/lib/cashfreeOrderFinalization.js');
  const start = text.indexOf('const responseForOrder =');
  const end = text.indexOf('export async function finalizeCashfreeOrder', start);
  vm.runInContext(text.slice(start, end) + '\nglobalThis.responseForOrder = responseForOrder;', c);
  assert.equal(c.responseForOrder(paidOrder(), false).metaPurchase, null);
  assert.equal(c.responseForOrder(paidOrder(), true).metaPurchase.params.value, 1499);
});

function paymentFixture(providerStatus) {
  let deductions = 0;
  let conversions = 0;
  let numbers = 0;
  const doc = { ...paidOrder({ paymentStatus: 'pending', orderNumber: 'PENDING-TEST' }), cashfreeOrderId: 'provider-order', async save() {} };
  const context = load(source('src/lib/cashfreeOrderFinalization.js'), {
    dbConnect: async () => {},
    Settings: { findOne: () => ({ lean: async () => ({}) }) },
    getCashfreeConfig: () => ({ appId: 'sandbox-id', secretKey: 'sandbox-secret', environment: 'sandbox' }),
    fetch: async () => ({ ok: true, json: async () => ({ order_status: providerStatus, cf_order_id: 'test-provider-id' }) }),
    Order: {
      findOne: async () => doc, findById: async () => doc,
      findOneAndUpdate: async (filter, update) => { if (!matches(doc, filter)) return null; apply(doc, update); return doc; },
      updateOne: async (filter, update) => { apply(doc, update); },
    },
    isFinalOrderNumber: (number) => /^GG\d{4,}$/.test(number),
    getNextPaidOrderNumber: async () => { numbers += 1; return 'GG0063'; },
    deductOrderInventory: async () => { deductions += 1; },
    sendMetaPurchaseEvent: async () => { conversions += 1; },
    getOrderDeliveryEstimate: () => '8 working days',
  });
  return { context, doc, counts: () => ({ deductions, conversions, numbers }) };
}
test('payment finalization preserves order creation, totals and stock deduction', async () => {
  const fixture = paymentFixture('PAID');
  const first = await fixture.context.finalizeCashfreeOrder('provider-order');
  assert.equal(first.success, true);
  assert.equal(first.paymentStatus, 'paid');
  assert.equal(first.orderNumber, 'GG0063');
  assert.equal(first.total, 1499);
  assert.equal(first.shippingCost, 100);
  assert.equal(first.metaPurchase.params.value, 1499);
  assert.equal(fixture.doc.status, 'ordered');
  await fixture.context.finalizeCashfreeOrder('provider-order');
  assert.equal(fixture.counts().deductions, 1);
  assert.equal(fixture.counts().numbers, 1);
});
test('gateway pending/failed/cancelled responses never invoke the Purchase sender', async () => {
  for (const status of ['ACTIVE', 'EXPIRED', 'TERMINATED']) {
    const fixture = paymentFixture(status);
    const result = await fixture.context.finalizeCashfreeOrder('provider-order');
    assert.equal(result.success, false);
    assert.equal(result.metaPurchase, null);
    assert.equal(fixture.counts().deductions, 0);
    assert.equal(fixture.counts().conversions, 0);
  }
});
