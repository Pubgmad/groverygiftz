const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const source = (file) => fs.readFileSync(file, 'utf8').replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const plain = (value) => JSON.parse(JSON.stringify(value));
const load = (files, globals = {}) => {
  const c = vm.createContext({ console, Headers, Buffer, AbortController, DOMException, setTimeout, clearTimeout, ...globals });
  vm.runInContext(files.map(source).join('\n'), c);
  return c;
};
const json = (body, init = {}) => ({ body, status: init.status || 200, headers: init.headers });

test('valid Cashfree signature authenticates exact raw bytes; forged, missing or reserialized payloads fail', () => {
  const c = load(['src/lib/cashfreeWebhook.js'], crypto);
  const raw = '{ "data": {"order_id":"provider-order"} }';
  const timestamp = String(Date.now());
  const signature = crypto.createHmac('sha256', 'test-secret').update(timestamp + raw).digest('base64');
  const headers = new Headers({ 'x-webhook-signature': signature, 'x-webhook-timestamp': timestamp });
  assert.equal(c.verifyCashfreeWebhook(raw, headers, 'test-secret'), true);
  assert.equal(c.verifyCashfreeWebhook(JSON.stringify(JSON.parse(raw)), headers, 'test-secret'), false);
  assert.equal(c.verifyCashfreeWebhook(raw, headers, 'wrong-secret'), false);
  assert.equal(c.verifyCashfreeWebhook(raw, new Headers(), 'test-secret'), false);
});

function verification(session, owned = true) {
  let finalized = 0;
  let lookup;
  const c = load(['src/app/api/orders/verify-cashfree-payment/route.js'], {
    NextResponse: { json }, getServerSession: async () => session, authOptions: {},
    dbConnect: async () => {},
    Order: { findOne: (filter) => { lookup = filter; return { select: () => ({ lean: async () => owned ? { _id: 'test-order' } : null }) }; } },
    refreshMetaVerificationAttribution: async () => {},
    finalizeCashfreeOrder: async () => { finalized++; return { success: true, paymentStatus: 'paid' }; },
    CashfreeFinalizeError: class extends Error {},
  });
  return { c, counts: () => finalized, lookup: () => lookup, req: { json: async () => ({ orderId: 'provider-order' }) } };
}

test('verification requires the owning customer before payment or attribution processing', async () => {
  for (const session of [null, { user: { type: 'admin', id: 'admin' } }]) {
    const f = verification(session);
    assert.equal((await f.c.POST(f.req)).status, 401);
    assert.equal(f.counts(), 0);
  }
  const other = verification({ user: { type: 'customer', id: 'customer-2' } }, false);
  assert.equal((await other.c.POST(other.req)).status, 404);
  assert.equal(other.counts(), 0);
  const owner = verification({ user: { type: 'customer', id: 'customer-1' } });
  const response = await owner.c.POST(owner.req);
  assert.equal(response.status, 200);
  assert.deepEqual(plain(owner.lookup()), { cashfreeOrderId: 'provider-order', customer: 'customer-1' });
  assert.equal(response.headers['Cache-Control'], 'private, no-store');
});

test('webhook rejects unsigned requests before finalization and propagates retryable delivery failures', async () => {
  let finalized = 0;
  class FinalizeError extends Error { constructor() { super('Retry delivery'); this.status = 503; } }
  const c = load(['src/lib/cashfreeWebhook.js', 'src/app/api/orders/cashfree-webhook/route.js'], {
    ...crypto, NextResponse: { json }, dbConnect: async () => {},
    Settings: { findOne: () => ({ lean: async () => ({}) }) }, getCashfreeConfig: () => ({ secretKey: 'test-secret' }),
    CashfreeFinalizeError: FinalizeError,
    finalizeCashfreeOrder: async (id, options) => { finalized++; assert.equal(id, 'provider-order'); assert.equal(options.retryTracking, true); throw new FinalizeError(); },
    console: { error() {} },
  });
  const raw = '{"data":{"order":{"order_id":"provider-order"}}}';
  const req = { text: async () => raw, headers: new Headers() };
  assert.equal((await c.POST(req)).status, 401);
  assert.equal(finalized, 0);
  const timestamp = String(Date.now());
  req.headers = new Headers({ 'x-webhook-timestamp': timestamp, 'x-webhook-signature': crypto.createHmac('sha256', 'test-secret').update(timestamp + raw).digest('base64') });
  assert.equal((await c.POST(req)).status, 503);
  assert.equal(finalized, 1);
});

const payment = () => load(['src/lib/checkoutPayment.js']);
test('browser verification recovers from concurrent finalization and pending responses without initiating payment', async () => {
  const c = payment();
  const requests = [];
  const waits = [];
  const replies = [
    { ok: false, status: 409, json: async () => ({ retryable: true }) },
    { ok: true, status: 200, json: async () => ({ success: false, retryable: true }) },
    { ok: true, status: 200, json: async () => ({ success: true, paymentStatus: 'paid', orderNumber: 'GG0064' }) },
  ];
  const result = await c.verifyCheckoutPayment('provider-order', { request: async (url) => { requests.push(url); return replies.shift(); }, wait: async (ms) => waits.push(ms) });
  assert.equal(result.success, true);
  assert.deepEqual(requests, Array(3).fill('/api/orders/verify-cashfree-payment'));
  assert.deepEqual(waits, [1500, 3000]);
});

test('network failures retry a bounded number of times; terminal failures do not retry', async () => {
  const c = payment();
  let calls = 0;
  const result = await c.verifyCheckoutPayment('provider-order', { request: async () => { calls++; throw Error('Network unavailable'); }, wait: async () => {} });
  assert.equal(calls, 4);
  assert.equal(result.success, false);
  assert.equal(result.retryable, true);
  calls = 0;
  await c.verifyCheckoutPayment('provider-order', { request: async () => { calls++; return { ok: false, status: 404, json: async () => ({ error: 'Not found' }) }; } });
  assert.equal(calls, 1);
});

test('aborted return effects cannot continue verification after cleanup', async () => {
  const c = payment();
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(c.verifyCheckoutPayment('provider-order', { signal: controller.signal, request: async () => { throw Error('Should not request'); } }), { name: 'AbortError' });
});

test('receipt restoration is customer-scoped, expires, and never replaces a new nonempty cart with an old completed receipt', () => {
  const store = new Map();
  const c = load(['src/lib/checkoutPayment.js'], { window: { sessionStorage: { getItem: (k) => store.get(k), setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) } } });
  c.rememberCheckoutReturn('customer-1', 'provider-order');
  assert.equal(c.readCheckoutReturn('customer-1'), 'provider-order');
  assert.equal(c.readCheckoutReturn('customer-2'), '');
  c.rememberCheckoutReturn('customer-1', 'provider-order', true);
  assert.equal(c.readCheckoutReturn('customer-1'), '');
  assert.equal(c.readCheckoutReturn('customer-1', true), 'provider-order');
  store.set('gg-checkout-return:customer-1', JSON.stringify({ orderId: 'provider-order', createdAt: Date.now() - 73 * 3600000 }));
  assert.equal(c.readCheckoutReturn('customer-1', true), '');
  store.set('unrelated', 'keep'); c.forgetCheckoutReturn('customer-1');
  assert.equal(store.get('unrelated'), 'keep');
});

test('server pricing retains existing base offers, variant adjustments, own prices and gift wrapping', () => {
  const c = load(['src/lib/offers.js', 'src/lib/stock.js', 'src/lib/orderPricing.js']);
  c.getEffectivePrice = (product) => c.isOfferActive(product) ? product.salePrice : product.regularPrice;
  const product = { _id: 'p', regularPrice: 500, salePrice: 400, giftWrap: { enabled: true, price: 20 }, variants: [{ name: 'Size', options: [{ label: 'Large', priceAdjustment: 50 }, { label: 'Own', useOwnPrice: true, regularPrice: 800, salePrice: 700 }] }] };
  for (const [variant, giftWrap, price] of [['', false, 400], ['Size: Large', false, 450], ['Size: Large', true, 470], ['Size: Own', false, 700]]) {
    assert.doesNotThrow(() => c.assertOrderPricing([{ productId: 'p', quantity: 2, variant, giftWrap, price }], { p: product }));
  }
  for (const changes of [{ price: 1 }, { quantity: 0 }, { quantity: 1.5 }, { price: NaN }]) {
    assert.throws(() => c.assertOrderPricing([{ productId: 'p', quantity: 1, price: 400, ...changes }], { p: product }), /pricing/);
  }
});

test('checkout outcome URLs stay on-site and preserve legacy Cashfree identifiers', () => {
  const c = payment();
  assert.equal(c.checkoutOutcomeUrl('return', 'PENDING-LEGACY123'), '/checkout/return?cashfree_order_id=PENDING-LEGACY123');
  assert.equal(c.checkoutOutcomeUrl('confirmation', 'PENDING-LEGACY123'), '/checkout/success?cashfree_order_id=PENDING-LEGACY123');
  assert.equal(c.checkoutOutcomeUrl('return', 'https://untrusted.invalid/order'), '/checkout/return');
  assert.equal(c.checkoutOutcomeUrl('confirmation', ''), '/checkout/success');
});

function outcomeFixture(mode, result = { success: true, paymentStatus: 'paid', orderNumber: 'GG0064', items: [{ product: 'p', price: 500, quantity: 1 }], subtotal: 500, shippingCost: 100, total: 600, deliveryEstimate: '8 working days' }) {
  const storage = new Map();
  const calls = { cleared: 0, ga: 0, meta: 0, confirmation: 0, routes: [], result: null, step: 1, messages: [] };
  const c = load(['src/lib/checkoutPayment.js'], {
    mode, orderId: 'provider-order',
    window: { sessionStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) }, scrollTo() {} },
    session: { user: { id: 'customer-1' } }, receiptOwnerRef: { current: 'customer-1' }, returnVerifyRef: { current: '' },
    cart: [{ product: 'new-cart-product', quantity: 1 }], cartTotal: 500, grandTotal: 600, shippingCost: 100, deliveryEstimate: '8 working days',
    clearCart: () => calls.cleared++, router: { replace: (url) => calls.routes.push(url) },
    trackGA4Purchase: () => calls.ga++, trackVerifiedMetaPurchase: () => calls.meta++, trackGA4OrderConfirmation: () => calls.confirmation++,
    setOrderResult: (value) => { calls.result = value; }, setStep: (value) => { calls.step = value; },
    setVerificationMessage: (value) => calls.messages.push(value), toast: { error: (value) => calls.messages.push(value) },
  });
  c.verifyCheckoutPayment = async () => result;
  const flow = fs.readFileSync('src/components/checkout/CheckoutFlow.js', 'utf8');
  const handlers = flow.slice(flow.indexOf('  const showSuccessfulOrder ='), flow.indexOf('  const handleAddressNext ='));
  vm.runInContext(handlers + '\nglobalThis.verify = verifyCashfreeOrder;', c);
  return { c, calls };
}

test('paid checkout and Cashfree return navigate to confirmation and clear the completed cart only once', async () => {
  for (const mode of ['checkout', 'return']) {
    const f = outcomeFixture(mode);
    assert.equal(await f.c.verify('provider-order'), true);
    assert.deepEqual(f.calls.routes, ['/checkout/success?cashfree_order_id=provider-order']);
    assert.equal(f.calls.cleared, 1);
    assert.equal(f.calls.ga + f.calls.meta, 0);
    await f.c.verify('provider-order');
    assert.equal(f.calls.cleared, 1);
  }
});

test('verified confirmation renders the same order without clearing a new cart on refresh', async () => {
  const f = outcomeFixture('confirmation');
  assert.equal(await f.c.verify('provider-order'), true);
  assert.equal(f.calls.result.orderNumber, 'GG0064');
  assert.equal(f.calls.result.total, 600);
  assert.equal(f.calls.result.deliveryEstimate, '8 working days');
  assert.equal(f.calls.step, 3);
  assert.equal(f.calls.ga, 1);
  assert.equal(f.calls.meta, 1);
  assert.equal(f.calls.confirmation, 1);
  assert.equal(f.calls.cleared, 0);
  assert.equal(f.calls.routes.length, 0);
});

test('pending, unauthorized and failed outcomes never show success, clear cart or emit Purchase', async () => {
  for (const mode of ['return', 'confirmation']) {
    for (const result of [{ success: false, paymentStatus: 'pending' }, { success: false, error: 'Order not found' }, { success: true, paymentStatus: 'failed' }]) {
      const f = outcomeFixture(mode, result);
      assert.equal(await f.c.verify('provider-order'), false);
      assert.equal(f.calls.result, null);
      assert.equal(f.calls.cleared, 0);
      assert.equal(f.calls.ga + f.calls.meta, 0);
      assert.equal(f.calls.routes.length, 0);
    }
  }
});

test('routes share one checkout flow, legacy returns redirect, and return UI cannot start another payment', () => {
  for (const path of ['src/app/checkout/page.js', 'src/app/checkout/return/page.js', 'src/app/checkout/success/page.js']) {
    const wrapper = fs.readFileSync(path, 'utf8');
    assert.match(wrapper, /import CheckoutFlow from '@\/components\/checkout\/CheckoutFlow'/);
    assert.doesNotMatch(wrapper, /create-cashfree-order|clearCart|Order\.create/);
  }
  assert.match(fs.readFileSync('src/app/checkout/page.js', 'utf8'), /if \(orderId\) redirect\(checkoutOutcomeUrl\('return', orderId\)\)/);
  const flow = fs.readFileSync('src/components/checkout/CheckoutFlow.js', 'utf8').replace(/\r\n/g, '\n');
  const pending = flow.slice(flow.indexOf("  if (mode !== 'checkout') {\n    return ("), flow.indexOf('<div className="max-w-6xl'));
  assert.match(pending, /retryPaymentVerification/);
  assert.doesNotMatch(pending, /handleCashfreePayment|Pay \{/);
  assert.match(flow, /encodeURIComponent\(authenticationCallback\)/);
});
