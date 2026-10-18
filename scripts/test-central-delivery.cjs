const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { execFileSync } = require('node:child_process');
const read = (file) => fs.readFileSync(file, 'utf8');
const plain = (value) => JSON.parse(JSON.stringify(value));
const strip = (text) => text.replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const source = (file) => strip(read(file));
const dates = source('src/lib/deliveryDate.js');
const central = source('src/lib/centralDeliveryEstimates.js');
const settings = { tamilNaduDeliveryEstimate: '3-4 working days', otherStateDeliveryEstimate: '5-7 days', tamilNaduShippingCost: 0, otherStateShippingCost: 120, deliveryHolidays: [] };
function load(text = '', globals = {}) {
  const c = vm.createContext({ console, URL, ...globals });
  vm.runInContext(dates + '\n' + central + '\n' + text, c);
  return c;
}

test('central duration validation accepts existing formats and rejects invalid, empty, reversed and extreme ranges', () => {
  const c = load();
  for (const value of ['3-4 days', 'Within 8 working days', '1 day', '365 days', '3\u20134 days']) assert.ok(c.validateDeliveryEstimate(value));
  for (const value of ['', null, 3, '0 days', '-1 days', '4-3 days', '366 days', '2.5 days', 'about a week', '3 days <script>', '1e2 days']) assert.equal(c.validateDeliveryEstimate(value), null);
});

test('only Tamil Nadu uses its category; all existing supported destinations use Other States', () => {
  const c = load();
  const shippingPage = read('src/app/account/manage/shipping/page.js');
  vm.runInContext(shippingPage.slice(shippingPage.indexOf('const INDIAN_STATES'), shippingPage.indexOf('const blankRates')) + '\nglobalThis.states = INDIAN_STATES;', c);
  for (const state of c.states) assert.equal(c.getCentralDeliveryEstimate(settings, state), state === 'Tamil Nadu' ? settings.tamilNaduDeliveryEstimate : settings.otherStateDeliveryEstimate);
  for (const state of [' tamil nadu ', 'TAMIL NADU', 'Tamil  Nadu', 'TamilNadu']) assert.equal(c.getCentralDeliveryEstimate(settings, state), settings.tamilNaduDeliveryEstimate);
  assert.equal(c.getCentralDeliveryEstimate(settings, 'Tamil Nadu border'), settings.otherStateDeliveryEstimate);
  assert.equal(c.getCentralDeliveryEstimate(settings, ''), '');
  assert.equal(c.buildCurrentDeliveryEstimate(settings, ''), 'Select state to see delivery estimate');
  assert.equal(c.buildCurrentDeliveryEstimate({}, 'Kerala'), 'Delivery estimate unavailable');
});

test('all weights project current delivery days without modifying stored rates, state rows or template identity', () => {
  const c = load();
  const rows = [{ state: 'Tamil Nadu', shippingCost: 45, deliveryEstimate: '99 days' }, { state: 'Delhi', shippingCost: 250, deliveryEstimate: '90 days' }];
  const before = plain(rows);
  for (const name of ['0-500 g', '1 KG', '3-4 KG']) {
    const template = { _id: name, name, rates: rows };
    const current = c.centralizeTemplateRates(template.rates, settings);
    assert.equal(current[0].deliveryEstimate, settings.tamilNaduDeliveryEstimate);
    assert.equal(current[1].deliveryEstimate, settings.otherStateDeliveryEstimate);
    assert.deepEqual(current.map((row) => row.shippingCost), [45, 250]);
    assert.deepEqual(plain(rows), before);
  }
});

test('existing and future template reads, edits and variants use the latest single configuration', async () => {
  let current = { ...settings };
  const templates = [{ _id: 'template-1', rates: [{ state: 'Tamil Nadu', shippingCost: 35, deliveryEstimate: '99 days' }, { state: 'Kerala', shippingCost: 110, deliveryEstimate: '99 days' }] }];
  const c = load(source('src/lib/shippingTemplateHydration.js'), { readDeliveryEstimateSettings: async () => current, ShippingTemplate: { find: () => ({ lean: async () => templates }) } });
  const makeProduct = () => ({ _id: 'product-1', regularPrice: 1399, stock: 8, delivery: { useCustomDelivery: true, shippingTemplate: 'template-1', tamilNaduShippingCost: 60 }, variants: [{ name: 'Size', options: [{ label: 'Large', shippingTemplate: 'template-1', priceAdjustment: 200 }] }] });
  const first = makeProduct();
  await c.hydrateProductShippingTemplates(first);
  assert.equal(first.delivery.stateOverrides[0].deliveryEstimate, settings.tamilNaduDeliveryEstimate);
  current = { ...settings, tamilNaduDeliveryEstimate: '2-3 days', otherStateDeliveryEstimate: '4-6 days' };
  const next = makeProduct(); await c.hydrateProductShippingTemplates(next);
  assert.equal(next.delivery.stateOverrides[0].deliveryEstimate, '2-3 days');
  assert.equal(next.variants[0].options[0].stateOverrides[1].deliveryEstimate, '4-6 days');
  assert.equal(next.delivery.stateOverrides[0].shippingCost, 35);
  assert.equal(next.variants[0].options[0].stateOverrides[1].shippingCost, 110);
  assert.equal(next.regularPrice, 1399); assert.equal(next.stock, 8);
  assert.equal(next.delivery.shippingTemplate, 'template-1');
  assert.equal(next.variants[0].options[0].priceAdjustment, 200);
  const unassigned = { delivery: { useCustomDelivery: true, stateOverrides: [{ state: 'Delhi', shippingCost: 70, deliveryEstimate: '99 days' }] } };
  await c.hydrateProductShippingTemplates(unassigned);
  assert.equal(unassigned.delivery.stateOverrides[0].deliveryEstimate, '4-6 days');
  assert.equal(unassigned.delivery.stateOverrides[0].shippingCost, 70);
});

test('central estimates still skip Sundays and configured holidays in the actual expected-date calculation', () => {
  const c = load();
  const value = c.buildCurrentDeliveryEstimate({ ...settings, tamilNaduDeliveryEstimate: '8 working days', deliveryHolidays: ['2026-08-26'] }, 'Tamil Nadu', { startDate: new Date('2026-08-23T12:00:00+05:30') });
  assert.match(value, /2 Sept|2 Sep/);
});

function baseline(file) { return strip(execFileSync('git', ['show', `HEAD:${file}`], { encoding: 'utf8' })); }
test('shipping costs and payment totals are identical to HEAD for product, variant, mixed-cart and quantity cases', () => {
  const currentClient = load(source('src/lib/shipping.js'));
  const oldClient = load(baseline('src/lib/shipping.js'));
  const currentServer = load(source('src/app/api/orders/create-cashfree-order/route.js'));
  const oldServer = load(baseline('src/app/api/orders/create-cashfree-order/route.js'));
  vm.runInContext('globalThis.shipping = calculateShipping;', currentServer);
  vm.runInContext('globalThis.shipping = calculateShipping;', oldServer);
  for (const state of ['Tamil Nadu', 'Kerala', 'Delhi']) {
    for (const quantity of [1, 2, 5]) {
      const productDelivery = { useCustomDelivery: true, tamilNaduShippingCost: 40, otherStateShippingCost: 90, stateOverrides: [{ state, shippingCost: 65, deliveryEstimate: '99 days' }] };
      const cases = [
        [{ productId: 'p', price: 100, quantity }],
        [{ productId: 'p', price: 100, quantity, delivery: productDelivery }],
        [{ productId: 'p', price: 100, quantity, delivery: productDelivery, variantDelivery: { stateOverrides: [{ state, shippingCost: 80, deliveryEstimate: '88 days' }] } }],
        [{ productId: 'p', price: 100, quantity, delivery: productDelivery }, { productId: 'q', price: 200, quantity: 2 }],
      ];
      for (const items of cases) {
        const a = currentClient.calculateCartShipping(items, state, settings);
        const b = oldClient.calculateCartShipping(items, state, settings);
        assert.equal(a.cost, b.cost);
        const now = currentServer.shipping(items, {}, state, settings);
        const old = oldServer.shipping(items, {}, state, settings);
        assert.equal(now.cost, old.cost);
        assert.equal(now.cost, a.cost);
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        assert.equal(subtotal + now.cost, subtotal + old.cost);
        assert.ok(a.estimate.startsWith(state === 'Tamil Nadu' ? settings.tamilNaduDeliveryEstimate : settings.otherStateDeliveryEstimate));
      }
    }
  }
});

test('placed orders retain their stored dated promise despite new central values and holiday changes', () => {
  const c = load(source('src/lib/orderDeliveryEstimate.js'));
  const order = { paidAt: '2026-08-23T12:00:00+05:30', shippingAddress: { state: 'Tamil Nadu' }, deliveryEstimate: 'Within 8 working days - expected by Wed, 2 Sept, 2026 (Sundays and government/public holidays skipped)' };
  assert.equal(c.getOrderDeliveryEstimate(order, ['2026-09-02']), order.deliveryEstimate);
  const legacy = c.getOrderDeliveryEstimate({ ...order, deliveryEstimate: '8 working days' }, ['2026-08-26']);
  assert.match(legacy, /^8 working days - expected by/);
});

function apiFixture({ admin = true, fail = false } = {}) {
  const calls = [];
  const c = load(source('src/app/api/delivery-estimates/route.js'), {
    NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200, headers: init.headers }) },
    getServerSession: async () => admin ? { user: { type: 'admin' } } : null, authOptions: {}, dbConnect: async () => {},
    readDeliveryEstimateSettings: async () => settings, revalidatePath: (...args) => calls.push(['revalidate', ...args]),
    Settings: { findOneAndUpdate: async (filter, update, options) => { calls.push({ filter, update, options }); if (fail) throw Error('Database unavailable'); return update.$set; } },
  });
  return { c, calls };
}
test('only admins can atomically save both valid categories; unrelated rates/settings cannot be written', async () => {
  const f = apiFixture();
  const response = await f.c.PUT({ json: async () => ({ tamilNaduDeliveryEstimate: '2-3 days', otherStateDeliveryEstimate: '4-6 days', otherStateShippingCost: 9999 }) });
  assert.equal(response.status, 200);
  assert.deepEqual(plain(f.calls[0].update), { $set: { tamilNaduDeliveryEstimate: '2-3 days', otherStateDeliveryEstimate: '4-6 days' } });
  assert.equal(f.calls[0].options.runValidators, true);
  assert.equal(response.headers['Cache-Control'], 'no-store');
  const denied = apiFixture({ admin: false });
  assert.equal((await denied.c.PUT({ json: async () => settings })).status, 401);
  assert.equal(denied.calls.length, 0);
});

test('invalid or failed central saves never partially update one category or report success', async () => {
  const f = apiFixture();
  assert.equal((await f.c.PUT({ json: async () => ({ ...settings, otherStateDeliveryEstimate: '9-2 days' }) })).status, 400);
  assert.equal(f.calls.length, 0);
  const failed = apiFixture({ fail: true });
  assert.equal((await failed.c.PUT({ json: async () => settings })).status, 503);
  assert.equal(failed.calls.length, 1);
});

test('template creation and editing ignore client duration overrides but retain exact state charges', async () => {
  for (const path of ['src/app/api/shipping-templates/route.js', 'src/app/api/shipping-templates/[id]/route.js']) {
    let captured;
    const query = { select: () => ({ lean: async () => [] }), then: (resolve) => Promise.resolve([]).then(resolve) };
    const c = load(source('src/lib/shippingTemplatePayload.js') + '\n' + source(path), {
      NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) }, getServerSession: async () => ({ user: { type: 'admin' } }), authOptions: {}, dbConnect: async () => {},
      readDeliveryEstimateSettings: async () => settings, revalidatePath() {},
      ShippingTemplate: { create: async (body) => { captured = body; return { ...body, _id: 't' }; }, findByIdAndUpdate: async (id, body) => { captured = body; return { ...body, _id: 't' }; } },
      Product: { updateMany: async () => {}, find: () => query },
    });
    const req = { json: async () => ({ name: '3-4 KG', isActive: false, rates: [{ state: 'Kerala', shippingCost: 125, deliveryEstimate: '999 days' }] }) };
    if (path.includes('[id]')) await c.PUT(req, { params: { id: 't' } }); else await c.POST(req);
    assert.equal(captured.rates[0].shippingCost, 125);
    assert.equal(captured.rates[0].deliveryEstimate, settings.otherStateDeliveryEstimate);
    assert.equal(captured.isActive, false);
  }
});

test('general Settings saves cannot overwrite central durations from a stale open form', async () => {
  let captured;
  const c = load(source('src/app/api/settings/route.js'), {
    NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) },
    getServerSession: async () => ({ user: { type: 'admin' } }), authOptions: {}, dbConnect: async () => {}, revalidatePath() {},
    Settings: { findOneAndUpdate: async (filter, body) => { captured = body; return body; } },
  });
  await c.PUT({ json: async () => ({ siteName: 'GroveryGiftz', tamilNaduDeliveryEstimate: '99 days', otherStateDeliveryEstimate: '99 days', otherStateShippingCost: 125 }) });
  assert.equal(captured.tamilNaduDeliveryEstimate, undefined);
  assert.equal(captured.otherStateDeliveryEstimate, undefined);
  assert.equal(captured.otherStateShippingCost, 125);
});

function hookFixture() {
  const windowListeners = new Map();
  const documentListeners = new Map();
  const requests = [];
  const updates = [];
  let cleanup;
  let interval;
  const document = { visibilityState: 'visible', addEventListener: (name, handler) => documentListeners.set(name, handler), removeEventListener: (name) => documentListeners.delete(name) };
  const window = { addEventListener: (name, handler) => windowListeners.set(name, handler), removeEventListener: (name) => windowListeners.delete(name), setInterval: (handler, delay) => { interval = { handler, delay }; return 1; }, clearInterval: () => { interval = null; } };
  const c = vm.createContext({ window, document, AbortController, useState: (initial) => [initial, (next) => updates.push(next)], useEffect: (effect) => { cleanup = effect(); }, fetch: (url, options) => new Promise((resolve) => requests.push({ url, options, resolve })) });
  vm.runInContext(strip(read('src/hooks/useDeliverySettings.js').replace('export default function', 'function')) + '\nglobalThis.initial = useDeliverySettings();', c);
  return { requests, updates, windowListeners, documentListeners, document, initial: c.initial, interval: () => interval, cleanup: () => cleanup() };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
test('mounted customer settings refresh on focus, visibility, save signals and active-page polling without guessing days', async () => {
  const f = hookFixture();
  assert.equal(f.initial.tamilNaduDeliveryEstimate, '');
  assert.equal(f.requests[0].options.cache, 'no-store');
  f.requests[0].resolve({ ok: true, json: async () => settings }); await settle();
  assert.equal(f.updates.at(-1).otherStateDeliveryEstimate, settings.otherStateDeliveryEstimate);
  f.windowListeners.get('focus')();
  f.windowListeners.get('storage')({ key: 'gg-delivery-estimates-updated' });
  f.windowListeners.get('groverygiftz:delivery-estimates')();
  assert.equal(f.requests.length, 4);
  assert.equal(f.interval().delay, 15000);
  f.document.visibilityState = 'hidden'; f.interval().handler(); assert.equal(f.requests.length, 4);
  f.document.visibilityState = 'visible'; f.documentListeners.get('visibilitychange')(); assert.equal(f.requests.length, 5);
  f.cleanup();
  assert.equal(f.windowListeners.size, 0); assert.equal(f.documentListeners.size, 0); assert.equal(f.interval(), null);
});

test('late and unmounted settings requests cannot replace a newer central configuration', async () => {
  const f = hookFixture();
  f.windowListeners.get('focus')();
  assert.equal(f.requests[0].options.signal.aborted, true);
  f.requests[1].resolve({ ok: true, json: async () => ({ ...settings, tamilNaduDeliveryEstimate: '2-3 days' }) }); await settle();
  f.requests[0].resolve({ ok: true, json: async () => settings }); await settle();
  assert.equal(f.updates.length, 1); assert.equal(f.updates[0].tamilNaduDeliveryEstimate, '2-3 days');
  f.windowListeners.get('focus')(); f.cleanup();
  f.requests[2].resolve({ ok: true, json: async () => settings }); await settle();
  assert.equal(f.updates.length, 1);
});

test('the dedicated admin form exposes only two duration inputs and independent editors are read-only', () => {
  const form = read('src/app/account/manage/estimated-delivery/page.js');
  assert.equal((form.match(/<input\b/g) || []).length, 2);
  assert.match(form, /validateDeliveryEstimate\(form\.tamilNaduDeliveryEstimate\)/);
  assert.match(form, /validateDeliveryEstimate\(form\.otherStateDeliveryEstimate\)/);
  assert.match(form, /groverygiftz:delivery-estimates/);
  const templates = read('src/app/account/manage/shipping/page.js');
  const products = read('src/app/account/manage/products/[id]/page.js');
  assert.doesNotMatch(templates + products, /onChange=\{[^\n]*deliveryEstimate.*e\.target\.value/);
  assert.match(templates, /readOnly aria-label/);
});

test('legacy generated policy promises render central guidance without rewriting saved policy data', () => {
  const page = read('src/app/policies/[slug]/page.js');
  const content = page.slice(page.indexOf('const titleMap'), page.indexOf('export default async function'));
  const c = vm.createContext({}); vm.runInContext(content + '\nglobalThis.result = defaultPolicyContent["shipping-policy"].replace(legacyShippingTimeline, currentShippingTimeline);', c);
  assert.doesNotMatch(c.result, /Within 6 Working Days|Estimated Delivery:<\/strong> 2 Working Days/);
  assert.match(page, /DeliveryEstimateSummary/);
  assert.doesNotMatch(page, /Page\.(update|delete|findOneAndUpdate)/);
});
