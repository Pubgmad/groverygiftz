const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { isIP } = require('node:net');
const mongoose = require('mongoose');

const read = (file) => fs.readFileSync(file, 'utf8');
const source = (file) => read(file).replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const shared = source('src/lib/metaAttribution.js');
const server = source('src/lib/metaAttributionServer.js');
const customer = source('src/lib/metaCustomerData.js');
const pixel = source('src/lib/metaPixel.js');
const purchase = source('src/lib/metaPurchase.js');
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const now = Date.now();
const fbc = `fb.1.${now}.genuine_test_click_id`;
const fbp = `fb.1.${now}.123456789`;

function context(extra = '', globals = {}) {
  const value = vm.createContext({ URL, URLSearchParams, Headers, Event, AbortSignal, crypto, isIP, process: { env: {} }, global: {}, console: { error() {}, info() {}, warn() {} }, ...globals });
  vm.runInContext(shared + '\n' + customer + '\n' + server + '\n' + extra, value);
  return value;
}
function browser(url = 'https://groverygiftz.in/', initial = {}, navigator = {}) {
  const jar = new Map(Object.entries(initial));
  const calls = [];
  const requests = [];
  const events = [];
  const document = {};
  Object.defineProperty(document, 'cookie', {
    get: () => Array.from(jar, ([key, value]) => `${key}=${value}`).join('; '),
    set: (raw) => {
      const part = raw.split(';')[0];
      const index = part.indexOf('=');
      const name = part.slice(0, index);
      if (/Max-Age=0(?:;|$)/.test(raw)) jar.delete(name);
      else jar.set(name, part.slice(index + 1));
    },
  });
  const window = {
    location: new URL(url), navigator, fbq: (...args) => calls.push(args),
    dispatchEvent: (event) => events.push(event.type),
    fetch: async (...args) => { requests.push(args); return {}; },
    localStorage: { getItem: () => null, setItem() {} },
  };
  const c = context(purchase + '\n' + pixel, { window, document });
  return { c, window, document, jar, calls, requests, events };
}
function request(headers = {}) {
  return { headers: new Headers(headers), url: 'https://groverygiftz.in/api/orders/create-cashfree-order' };
}
const permitted = { cookie: `gg_marketing_consent=granted; _fbc=${fbc}; _fbp=${fbp}`, 'user-agent': 'Original customer browser' };

test('ad landing creates fbc only from the actual URL after consent', () => {
  const b = browser('https://groverygiftz.in/?fbclid=actual_click');
  b.c.captureMetaLandingAttribution();
  assert.equal(b.jar.has('_fbc'), false);
  b.c.setMarketingConsent('granted');
  b.c.captureMetaLandingAttribution();
  assert.match(b.jar.get('_fbc'), /^fb\.1\.\d{13}\.actual_click$/);
  assert.equal(b.jar.has('_fbp'), false);
});
test('no-ad landing never manufactures fbc or fbp', () => {
  const b = browser('https://groverygiftz.in/', { gg_marketing_consent: 'granted' });
  b.c.captureMetaLandingAttribution();
  assert.equal(b.jar.has('_fbc'), false);
  assert.equal(b.jar.has('_fbp'), false);
});
test('valid existing attribution survives navigation and a repeated click ID', () => {
  const b = browser('https://groverygiftz.in/products/frame', { gg_marketing_consent: 'granted', _fbc: fbc, _fbp: fbp });
  b.c.captureMetaLandingAttribution();
  assert.equal(b.jar.get('_fbc'), fbc);
  b.c.captureMetaLandingAttribution('https://groverygiftz.in/?fbclid=genuine_test_click_id');
  assert.equal(b.jar.get('_fbc'), fbc);
  assert.equal(b.jar.get('_fbp'), fbp);
});
test('a new genuine click updates fbc while cross-origin/malformed inputs do not', () => {
  const b = browser('https://groverygiftz.in/', { gg_marketing_consent: 'granted', _fbc: fbc });
  b.c.captureMetaLandingAttribution('https://other.invalid/?fbclid=other_click');
  assert.equal(b.jar.get('_fbc'), fbc);
  b.c.captureMetaLandingAttribution('https://groverygiftz.in/?fbclid=%3Cscript%3E');
  assert.equal(b.jar.get('_fbc'), fbc);
  b.c.captureMetaLandingAttribution('https://groverygiftz.in/?fbclid=new_real_click');
  assert.match(b.jar.get('_fbc'), /\.new_real_click$/);
});
test('basic and official Parameter Builder appendices are accepted unchanged', () => {
  const c = context();
  const appendix = Buffer.from([1, 4, 0, 0, 0, 0]).toString('base64url');
  for (const suffix of ['', '.AQ', '.BA', `.${appendix}`]) {
    assert.equal(c.validateMetaIdentifier(fbc + suffix, 'fbc'), fbc + suffix);
    assert.equal(c.validateMetaIdentifier(fbp + suffix, 'fbp'), fbp + suffix);
  }
});
test('malformed, expired, future and swapped attribution identifiers are rejected', () => {
  const c = context();
  for (const value of [null, '', 'fake', `fb.1.${now}.bad<script>`, `fb.1.${now}.click.invalid`, `fb.1.${now}.click.more.segments`, `fb.1.${now + 600000}.click`, `fb.1.${now - 91 * 86400000}.click`]) {
    assert.equal(c.validateMetaIdentifier(value, 'fbc'), '');
  }
  assert.equal(c.validateMetaIdentifier(fbc, 'fbp'), '');
});
test('denial clears ad cookies and pending events but leaves login/cart cookies alone', () => {
  const b = browser('https://groverygiftz.in/', { gg_marketing_consent: 'granted', _fbc: fbc, _fbp: fbp, 'next-auth.session-token': 'session', cart: 'cart-state' });
  b.window.__groveryGiftzMetaPurchasesPending = new Map([['event', {}]]);
  assert.equal(b.c.setMarketingConsent('denied'), 'denied');
  assert.equal(b.jar.has('_fbc'), false);
  assert.equal(b.jar.has('_fbp'), false);
  assert.equal(b.jar.get('next-auth.session-token'), 'session');
  assert.equal(b.jar.get('cart'), 'cart-state');
  assert.equal(b.window.__groveryGiftzMetaPurchasesPending.size, 0);
  assert.deepEqual(b.calls[0], ['consent', 'revoke']);
  assert.equal(b.requests[0][0], '/api/meta/consent');
});
test('unknown consent, GPC, and DNT prevent all manual Pixel events', () => {
  for (const [cookie, nav] of [[{}, {}], [{ gg_marketing_consent: 'denied' }, {}], [{ gg_marketing_consent: 'granted' }, { globalPrivacyControl: true }], [{ gg_marketing_consent: 'granted' }, { doNotTrack: '1' }]]) {
    const b = browser('https://groverygiftz.in/', cookie, nav);
    b.c.configureMetaPixel({ enabled: true, pixelId: 'test-pixel' });
    assert.equal(b.c.trackMetaEvent('PageView'), false);
    assert.equal(b.calls.length, 0);
  }
});
test('GPC cannot be overridden by the Accept action', () => {
  const b = browser('https://groverygiftz.in/?fbclid=click', {}, { globalPrivacyControl: true });
  assert.equal(b.c.setMarketingConsent('granted'), 'denied');
  b.c.captureMetaLandingAttribution();
  assert.equal(b.jar.has('_fbc'), false);
});
test('original browser metadata is captured verbatim; fbc and fbp are not hashed', () => {
  const c = context();
  const data = c.captureMetaOrderAttribution(request(permitted));
  assert.equal(data.allowed, true);
  assert.equal(data.fbc, fbc);
  assert.equal(data.fbp, fbp);
  assert.equal(data.clientUserAgent, 'Original customer browser');
  assert.equal(new Date(data.expiresAt) - new Date(data.capturedAt), 7 * 86400000);
});
test('absence of ad cookies still yields a valid consented website event', () => {
  const c = context();
  const data = c.captureMetaOrderAttribution(request({ cookie: 'gg_marketing_consent=granted', 'user-agent': 'Browser' }));
  const userData = c.buildMetaBrowserData(data);
  assert.equal(userData.client_user_agent, 'Browser');
  assert.equal(userData.fbc, undefined);
  assert.equal(userData.fbp, undefined);
});
test('denied/unknown/server privacy signals capture no identifiers or browser metadata', () => {
  const c = context();
  for (const headers of [{}, { ...permitted, cookie: 'gg_marketing_consent=denied' }, { ...permitted, 'sec-gpc': '1' }, { ...permitted, dnt: '1' }]) {
    const data = c.captureMetaOrderAttribution(request(headers));
    assert.equal(data.allowed, false);
    assert.equal(data.clientUserAgent, undefined);
    assert.equal(data.fbc, undefined);
    assert.equal(data.fbp, undefined);
    assert.equal(c.buildMetaBrowserData(data), null);
  }
});
test('untrusted forwarded headers and malformed client IPs are ignored', () => {
  const c = context();
  const req = request({ 'x-forwarded-for': '198.51.100.42, 10.0.0.1', 'x-real-ip': '198.51.100.42' });
  assert.equal(c.trustedMetaClientIp(req, {}), '');
  assert.equal(c.trustedMetaClientIp(req, { META_TRUSTED_CLIENT_IP_HEADER: 'x-forwarded-for' }), '');
  assert.equal(c.trustedMetaClientIp(request({ 'x-real-ip': 'not-an-ip' }), { META_TRUSTED_CLIENT_IP_HEADER: 'x-real-ip' }), '');
  assert.equal(c.trustedMetaClientIp(request({ 'x-real-ip': '198.51.100.42, 198.51.100.43' }), { META_TRUSTED_CLIENT_IP_HEADER: 'x-real-ip' }), '');
});
test('explicitly trusted proxy configuration supports IPv4, IPv6 and right-side hop selection', () => {
  const c = context();
  assert.equal(c.trustedMetaClientIp(request({ 'x-real-ip': '198.51.100.42' }), { META_TRUSTED_CLIENT_IP_HEADER: 'x-real-ip' }), '198.51.100.42');
  assert.equal(c.trustedMetaClientIp(request({ 'cf-connecting-ip': '2001:db8::1234' }), { META_TRUSTED_CLIENT_IP_HEADER: 'cf-connecting-ip' }), '2001:db8::1234');
  const req = request({ 'x-forwarded-for': '203.0.113.99, 198.51.100.42, 10.0.0.1' });
  assert.equal(c.trustedMetaClientIp(req, { META_TRUSTED_CLIENT_IP_HEADER: 'x-forwarded-for', META_TRUSTED_PROXY_HOPS: '2' }), '198.51.100.42');
});
test('email, names, city, state, postcode and country are normalized before hashing', () => {
  const c = context();
  const data = c.buildMetaCustomerData({ customer: 'customer-1', shippingAddress: { fullName: ' Alice  Smith ', email: ' ALICE@Example.Invalid ', phone: '09876543210', city: ' New Delhi. ', state: 'Tamil Nadu', pincode: '600 001' } });
  assert.equal(data.em, hash('alice@example.invalid'));
  assert.equal(data.ph, hash('919876543210'));
  assert.equal(data.fn, hash('alice'));
  assert.equal(data.ln, hash('smith'));
  assert.equal(data.ct, hash('newdelhi'));
  assert.equal(data.st, hash('tamilnadu'));
  assert.equal(data.zp, hash('600001'));
  assert.equal(data.country, hash('in'));
  assert.equal(data.external_id, hash('customer-1'));
  assert.equal(data.db, undefined);
  assert.equal(data.ge, undefined);
});
test('Indian country code and existing SHA-256 fields are never double hashed', () => {
  const c = context();
  for (const phone of ['9876543210', '+91 98765 43210', '0091-9876543210', '09876543210']) assert.equal(c.normalizeMetaPhone(phone), '919876543210');
  assert.equal(c.hashMetaField(hash('alice@example.invalid')), hash('alice@example.invalid'));
  assert.equal(c.normalizeMetaPhone('bad'), '');
  assert.equal(c.hashMetaField(''), undefined);
});
test('external ID is stable across browser/device orders for the same registered customer', () => {
  const c = context();
  const first = c.buildMetaCustomerData({ customer: 'customer-1', _id: 'order-a' });
  const second = c.buildMetaCustomerData({ customer: { _id: 'customer-1' }, _id: 'order-b' });
  assert.equal(first.external_id, second.external_id);
  assert.notEqual(first.external_id, c.buildMetaCustomerData({ customer: 'customer-2' }).external_id);
  assert.equal(c.buildMetaCustomerData({ _id: 'order-without-customer-identity' }).external_id, undefined);
});
for (const [label, agent] of [
  ['Android Chrome', 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/129.0.0.0 Mobile Safari/537.36'],
  ['iOS Safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_6 like Mac OS X) AppleWebKit/605.1.15 Version/17.6 Mobile/15E148 Safari/604.1'],
  ['desktop browser', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/129.0.0.0 Safari/537.36'],
]) {
  test(`${label} user agent survives the checkout/webhook boundary unchanged`, () => {
    const c = context();
    const captured = c.captureMetaOrderAttribution(request({ ...permitted, 'user-agent': agent }));
    const restored = JSON.parse(JSON.stringify(captured));
    assert.equal(c.buildMetaBrowserData(restored).client_user_agent, agent);
  });
}
test('missing/expired/malformed user agent or permission cannot produce website CAPI metadata', () => {
  const c = context();
  const valid = c.captureMetaOrderAttribution(request(permitted));
  for (const changes of [{ allowed: false }, { allowed: 'false' }, { expiresAt: 'invalid' }, { expiresAt: new Date(0) }, { clientUserAgent: '' }, { clientUserAgent: 'browser\r\nforged' }, { clientUserAgent: 'x'.repeat(2049) }]) assert.equal(c.buildMetaBrowserData({ ...valid, ...changes }), null);
});
test('attribution storage is private by default and has no order-deleting TTL', () => {
  const localMongoose = new mongoose.Mongoose();
  const c = vm.createContext({ mongoose: localMongoose });
  vm.runInContext(read('src/models/Order.js').replace(/^import .*;\r?\n/gm, '').replace('export default ', 'globalThis.OrderModel = '), c);
  assert.equal(c.OrderModel.schema.path('metaAttribution').options.select, false);
  assert.equal(c.OrderModel.schema.indexes().some(([, options]) => options.expireAfterSeconds !== undefined), false);
});
test('expiry maintenance removes only metadata and runs at most once per day', async () => {
  const updates = [];
  const c = context('', { Order: { updateMany: async (...args) => updates.push(args) } });
  await c.cleanupExpiredMetaAttribution();
  await c.cleanupExpiredMetaAttribution();
  assert.equal(updates.length, 1);
  assert.deepEqual(Object.keys(updates[0][0]), ['metaAttribution.expiresAt']);
  assert.deepEqual(JSON.parse(JSON.stringify(updates[0][1])), { $unset: { metaAttribution: '' } });
});
test('verification preserves original cookies and browser agent after redirect', async () => {
  const updates = [];
  const c = context('', {
    dbConnect: async () => {},
    Order: { findOne: () => ({ select: () => ({ lean: async () => ({ metaAttribution: { clientUserAgent: 'Original browser', fbc } }) }) }), updateOne: async (...args) => updates.push(args) },
  });
  await c.refreshMetaVerificationAttribution(request({ cookie: 'gg_marketing_consent=granted', 'user-agent': 'Return browser' }), 'provider-order', 'customer-1');
  assert.equal(updates.length, 0);
});
test('verification honors withdrawal and can recover legacy metadata only for its owner', async () => {
  const updates = [];
  let owner;
  const c = context('', {
    dbConnect: async () => {},
    Order: {
      findOne: (filter) => { owner = filter.customer; return { select: () => ({ lean: async () => ({}) }) }; },
      updateOne: async (...args) => updates.push(args),
    },
  });
  await c.refreshMetaVerificationAttribution(request(permitted), 'provider-order', 'customer-1');
  assert.equal(owner, 'customer-1');
  assert.equal(updates[0][0].customer, 'customer-1');
  assert.equal(updates[0][1].$set.metaAttribution.clientUserAgent, 'Original customer browser');
  await c.refreshMetaVerificationAttribution(request({ cookie: 'gg_marketing_consent=denied' }), 'provider-order', 'customer-1');
  assert.equal(updates[1][1].$set.metaAttribution.allowed, false);
  assert.equal(updates[1][1].$set.metaAttribution.fbc, undefined);
});

function checkoutFixture(session, headers = permitted) {
  let record;
  let providerBody;
  const c = context(source('src/app/api/orders/create-cashfree-order/route.js'), {
    NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) },
    dbConnect: async () => {}, getServerSession: async () => session, authOptions: {},
    Settings: { findOne: () => ({ lean: async () => ({ tamilNaduShippingCost: 100, tamilNaduDeliveryEstimate: '8 working days' }) }) },
    getCashfreeConfig: () => ({ enabled: true, appId: 'sandbox-id', secretKey: 'sandbox-secret', environment: 'sandbox' }),
    Product: { find: () => ({ select: () => ({ lean: async () => [] }) }) },
    hydrateProductShippingTemplates: async () => {}, assertStockAvailable() {}, getGroupedStockRequests: () => [],
    buildDeliveryEstimateText: () => '8 working days',
    fetch: async (url, options) => { providerBody = JSON.parse(options.body); return { ok: true, json: async () => ({ order_id: 'provider-order', cf_order_id: 'test-provider', payment_session_id: 'sandbox-session' }) }; },
    Order: { create: async (data) => { record = data; return { ...data, _id: 'test-order' }; } },
  });
  const req = { ...request(headers), json: async () => ({ items: [{ productId: 'p', title: 'Product', price: 500, quantity: 2 }], shippingAddress: { fullName: 'Test Customer', email: 'test@example.invalid', phone: '9876543210', state: 'Tamil Nadu', pincode: '600001' }, metaAttribution: { allowed: true, clientUserAgent: 'forged-body-agent', clientIpAddress: '203.0.113.99' } }) };
  return { c, req, record: () => record, providerBody: () => providerBody };
}
test('guest checkout still requires sign-in and creates no provider order', async () => {
  const fixture = checkoutFixture(null);
  assert.equal((await fixture.c.POST(fixture.req)).status, 401);
  assert.equal(fixture.record(), undefined);
  assert.equal(fixture.providerBody(), undefined);
});
test('logged-in checkout stores actual headers privately without changing payment totals', async () => {
  const fixture = checkoutFixture({ user: { type: 'customer', id: 'customer-1', email: 'test@example.invalid' } });
  const response = await fixture.c.POST(fixture.req);
  assert.equal(response.status, 201);
  assert.equal(fixture.record().metaAttribution.clientUserAgent, 'Original customer browser');
  assert.equal(fixture.record().metaAttribution.clientIpAddress, undefined);
  assert.equal(fixture.record().metaAttribution.fbc, fbc);
  assert.equal(fixture.providerBody().order_amount, 1100);
  assert.equal(fixture.providerBody().order_currency, 'INR');
  assert.equal(JSON.stringify(fixture.providerBody()).includes(fbc), false);
  assert.equal(response.body.metaAttribution, undefined);
});
test('denied checkout still succeeds and ignores forged body attribution', async () => {
  const fixture = checkoutFixture({ user: { type: 'customer', id: 'customer-1' } }, { cookie: 'gg_marketing_consent=denied', 'user-agent': 'Browser' });
  assert.equal((await fixture.c.POST(fixture.req)).status, 201);
  assert.equal(fixture.record().metaAttribution.allowed, false);
  assert.equal(fixture.record().metaAttribution.clientUserAgent, undefined);
});

function withdrawalFixture(session, origin = 'https://groverygiftz.in') {
  const updates = [];
  const c = context(source('src/app/api/meta/consent/route.js'), {
    NextResponse: { json: (body, init = {}) => ({ body, status: init.status || 200 }) },
    getServerSession: async () => session, authOptions: {}, dbConnect: async () => {},
    process: { env: { NEXTAUTH_URL: 'https://groverygiftz.in/' } },
    Order: { updateMany: async (...args) => updates.push(args) },
  });
  return { c, updates, req: { url: 'https://groverygiftz.in/api/meta/consent', headers: new Headers(origin ? { origin } : {}) } };
}
test('withdrawal revokes only the authenticated customer unsent attribution without changing orders', async () => {
  const fixture = withdrawalFixture({ user: { type: 'customer', id: 'customer-1' } });
  assert.equal((await fixture.c.POST(fixture.req)).status, 200);
  const [filter, update] = fixture.updates[0];
  assert.equal(filter.customer, 'customer-1');
  assert.equal(filter.metaConversionPurchaseSentAt, null);
  assert.equal(filter['metaAttribution.allowed'], true);
  assert.deepEqual(Object.keys(update.$set), ['metaAttribution.allowed']);
  assert.equal(update.$set['metaAttribution.allowed'], false);
  assert.deepEqual(Object.keys(update.$unset).sort(), ['metaAttribution.clientIpAddress', 'metaAttribution.clientUserAgent', 'metaAttribution.fbc', 'metaAttribution.fbp', 'metaConversionPurchaseStartedAt'].sort());
});
test('guest withdrawal cannot change account orders and cross-origin withdrawal is forbidden', async () => {
  const guest = withdrawalFixture(null);
  assert.equal((await guest.c.POST(guest.req)).status, 200);
  assert.equal(guest.updates.length, 0);
  for (const origin of ['https://untrusted.invalid', null]) {
    const fixture = withdrawalFixture({ user: { type: 'customer', id: 'customer-1' } }, origin);
    assert.equal((await fixture.c.POST(fixture.req)).status, 403);
    assert.equal(fixture.updates.length, 0);
  }
});
