const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const crypto = require('node:crypto');
const { isIP } = require('node:net');

const read = (file) => fs.readFileSync(file, 'utf8');
const source = (file) => read(file).replace(/^import .*;\r?\n/gm, '').replace(/export default /g, '').replace(/export /g, '');
const plain = (value) => JSON.parse(JSON.stringify(value));
const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fields = { em: hash('customer@example.invalid'), external_id: hash('customer-a') };
const shared = source('src/lib/metaAttribution.js');
const customer = source('src/lib/metaCustomerData.js');
const pixel = source('src/lib/metaPixel.js');
const purchase = source('src/lib/metaPurchase.js');

function browser() {
  const calls = [];
  const listeners = new Map();
  const scripts = new Map();
  const document = {
    cookie: '', getElementById: (id) => scripts.get(id), createElement: () => ({}),
    head: { appendChild: (script) => scripts.set(script.id, script) },
  };
  const window = {
    location: new URL('https://groverygiftz.in/shop'), navigator: {},
    fbq: (...args) => calls.push(plain(args)),
    dispatchEvent() {}, addEventListener: (name, fn) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
    setTimeout, clearTimeout,
  };
  window.fbq.callMethod = () => {};
  const c = vm.createContext({ window, document, console, URL, Event, Headers, AbortController, crypto, isIP, process: { env: {} } });
  vm.runInContext(shared + '\n' + purchase + '\n' + pixel, c);
  c.configureMetaPixel({ enabled: true, pixelId: 'pixel' });
  return { c, window, document, calls, listeners };
}

test('manual matching accepts only allowlisted SHA-256 fields and initializes once', () => {
  const b = browser();
  assert.equal(b.c.applyMetaAdvancedMatching('customer-a', { ...fields, phone: '9876543210', ph: '9876543210', access_token: 'secret', address: 'private' }), true);
  assert.deepEqual(b.calls, [['init', 'pixel', fields]]);
  assert.equal(b.c.applyMetaAdvancedMatching('customer-a', fields), true);
  assert.equal(b.calls.length, 1);
  assert.equal(b.window.localStorage, undefined);
  assert.equal(b.document.cookie, '');
});

test('empty identity, raw email and malformed hashes never enable manual matching', () => {
  for (const data of [{}, { em: 'customer@example.invalid', external_id: fields.external_id }, { em: fields.em }, { external_id: fields.external_id }, { ...fields, external_id: 'bad' }]) {
    const b = browser();
    assert.equal(b.c.applyMetaAdvancedMatching('customer-a', data), false);
    assert.equal(b.calls.length, 0);
  }
});

test('denial, GPC, DNT, admin/config blocking and stale session guard prevent matching', () => {
  for (const block of [
    (b) => { b.document.cookie = 'gg_marketing_consent=denied'; },
    (b) => { b.window.navigator.globalPrivacyControl = true; },
    (b) => { b.window.navigator.doNotTrack = '1'; },
    (b) => b.c.configureMetaPixel({ enabled: true, pixelId: 'pixel', blocked: true }),
    (b) => b.c.configureMetaPixel({ enabled: false, pixelId: 'pixel' }),
    (b) => { b.window.__groveryGiftzMetaIdentityGuard = () => false; },
  ]) {
    const b = browser(); block(b);
    assert.equal(b.c.applyMetaAdvancedMatching('customer-a', fields), false);
    assert.equal(b.calls.length, 0);
  }
});

test('account switch revokes and locks the old SDK document, without redirects or fake purchases', () => {
  const b = browser();
  b.c.applyMetaAdvancedMatching('customer-a', fields);
  b.window.__groveryGiftzMetaPurchasesPending = new Map([['old', {}]]);
  assert.equal(b.c.applyMetaAdvancedMatching('customer-b', { ...fields, external_id: hash('customer-b') }), false);
  assert.equal(b.window.__groveryGiftzMetaIdentityLocked, true);
  assert.equal(b.window.__groveryGiftzMetaMatchedCustomer, undefined);
  assert.equal(b.window.__groveryGiftzMetaPurchasesPending.size, 0);
  b.c.configureMetaPixel({ enabled: true, pixelId: 'pixel' });
  assert.equal(b.c.trackMetaEvent('PageView'), false);
  assert.equal(b.c.applyMetaAdvancedMatching('customer-b', fields), false);
  assert.equal(b.calls.filter(([command]) => command === 'init').length, 1);
  assert.deepEqual(b.calls.at(-1), ['consent', 'revoke']);
  assert.equal(b.window.location.href, 'https://groverygiftz.in/shop');
});

function api({ session = { user: { id: 'customer-a', type: 'customer' } }, settings = { metaPixelEnabled: true, metaPixelId: 'pixel' }, account = { _id: 'customer-a', name: 'Account Owner', email: ' ACCOUNT@example.invalid ', phone: '9876543210' }, fail = false } = {}) {
  const calls = [];
  const c = vm.createContext({
    crypto, isIP, process: { env: {} }, authOptions: {},
    NextResponse: { json: (body, options) => ({ body, ...options }) },
    getServerSession: async () => session,
    dbConnect: async () => { calls.push('db'); if (fail) throw new Error('Unavailable'); },
    Settings: { findOne: () => ({ select: () => ({ lean: async () => settings }) }) },
    Customer: { findById: (id) => { calls.push(id); return { select: (projection) => { calls.push(projection); return { lean: async () => account }; } }; } },
  });
  vm.runInContext(shared + '\n' + customer + '\n' + source('src/app/api/meta/matching/route.js'), c);
  return { c, calls };
}

test('matching API reads only authenticated account fields and responds with hashes, not raw PII', async () => {
  const a = api();
  const result = await a.c.GET({ headers: new Headers(), url: 'https://groverygiftz.in/api/meta/matching?customerId=other-person' });
  assert.equal(result.status, 200);
  assert.deepEqual(a.calls, ['db', 'customer-a', '_id name email phone']);
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.equal(result.headers.Vary, 'Cookie');
  assert.equal(result.body.customerId, 'customer-a');
  assert.deepEqual(plain(result.body.userData), { em: hash('account@example.invalid'), ph: hash('919876543210'), fn: hash('account'), ln: hash('owner'), external_id: hash('customer-a') });
  assert.equal(JSON.stringify(result.body).includes('9876543210'), false);
  assert.equal(JSON.stringify(result.body).includes('@'), false);
});

test('matching API rejects guests/admins and honors privacy choices before reading the database', async () => {
  for (const session of [null, { user: { type: 'admin', id: 'admin' } }]) {
    const a = api({ session });
    assert.equal((await a.c.GET({ headers: new Headers() })).status, 401);
    assert.equal(a.calls.length, 0);
  }
  for (const headers of [{ cookie: 'gg_marketing_consent=denied' }, { 'sec-gpc': '1' }, { dnt: '1' }]) {
    const a = api();
    assert.deepEqual(plain((await a.c.GET({ headers: new Headers(headers) })).body), { userData: {} });
    assert.equal(a.calls.length, 0);
  }
});

test('disabled Pixel, deleted account and database failures never leak matching data', async () => {
  for (const [options, expected] of [[{ settings: { metaPixelEnabled: false } }, 200], [{ account: null }, 404], [{ fail: true }, 503]]) {
    const a = api(options);
    const result = await a.c.GET({ headers: new Headers() });
    assert.equal(result.status, expected);
    assert.equal(result.body.userData?.em, undefined);
  }
});

test('strict permission mode does not expose account matching until granted', async () => {
  const a = api();
  // The shared permission constant is compiled from the existing deployment setting.
  const strict = vm.createContext({ ...a.c, process: { env: { NEXT_PUBLIC_META_REQUIRE_CONSENT: 'true' } } });
  vm.runInContext(shared + '\n' + customer + '\n' + source('src/app/api/meta/matching/route.js'), strict);
  const blocked = await strict.GET({ headers: new Headers() });
  assert.deepEqual(plain(blocked.body), { userData: {} });
  assert.equal(a.calls.length, 0);
  const allowed = await strict.GET({ headers: new Headers({ cookie: 'gg_marketing_consent=granted' }) });
  assert.equal(allowed.body.userData.em, hash('account@example.invalid'));
});

test('temporary session loading preserves a pending purchase without dispatching it', () => {
  const b = browser();
  const pending = new Map([['purchase', { eventTime: Date.now() / 1000 }]]);
  b.window.__groveryGiftzMetaPurchasesPending = pending;
  b.window.__groveryGiftzMetaIdentityGuard = () => false;
  b.c.flushMetaPurchases();
  assert.equal(pending.size, 1);
  assert.equal(b.calls.length, 0);
});

function component() {
  const b = browser();
  const slots = [];
  let index = 0;
  let jobs = [];
  let currentSession = { status: 'authenticated', data: { user: { id: 'customer-a', type: 'customer' } } };
  const pending = [];
  Object.assign(b.c, {
    useSession: () => currentSession, usePathname: () => '/shop',
    useRef: (initial) => { const i = index++; return slots[i] ||= { current: initial }; },
    useState: (initial) => { const i = index++; if (!slots[i]) slots[i] = { value: initial }; return [slots[i].value, (value) => { slots[i].value = value; }]; },
    useEffect: (fn, deps) => { const i = index++; const old = slots[i]; if (!old || deps.some((dep, n) => dep !== old.deps[n])) { slots[i] = { deps, cleanup: old?.cleanup }; jobs.push(() => { old?.cleanup?.(); slots[i].cleanup = fn(); }); } },
    fetch: (url, options) => new Promise((resolve) => pending.push({ resolve, url, options })),
  });
  vm.runInContext(source('src/components/meta/MetaPixelClient.js'), b.c);
  const render = (session = currentSession, props = {}) => {
    currentSession = session; index = 0; jobs = [];
    b.c.MetaPixelClient({ enabled: true, pixelId: 'pixel', ...props });
    jobs.forEach((job) => job());
  };
  const unmount = () => slots.forEach((slot) => slot?.cleanup?.());
  return { ...b, pending, render, unmount };
}

test('component applies current account matching after SDK init without duplicating PageView', async () => {
  const b = component(); b.render();
  assert.equal(b.pending.length, 1);
  assert.equal(b.pending[0].url, '/api/meta/matching');
  assert.equal(b.pending[0].options.cache, 'no-store');
  b.pending[0].resolve({ ok: true, json: async () => ({ customerId: 'customer-a', userData: fields }) });
  await new Promise(setImmediate);
  assert.deepEqual(b.calls.filter(([command]) => command === 'init'), [['init', 'pixel'], ['init', 'pixel', fields]]);
  assert.equal(b.calls.filter(([command, event]) => command === 'track' && event === 'PageView').length, 1);
  b.unmount();
});

test('stale/mismatched/unmounted matching responses cannot attach the previous account identity', async () => {
  for (const change of ['logout', 'switch', 'unmount', 'wrong-response']) {
    const b = component(); b.render();
    if (change === 'logout') b.render({ status: 'unauthenticated', data: null });
    if (change === 'switch') b.render({ status: 'authenticated', data: { user: { type: 'customer', id: 'customer-b' } } });
    if (change === 'unmount') b.unmount();
    b.pending[0].resolve({ ok: true, json: async () => ({ customerId: change === 'wrong-response' ? 'customer-b' : 'customer-a', userData: fields }) });
    await new Promise(setImmediate);
    assert.equal(b.calls.some(([command, , data]) => command === 'init' && data?.em), false, change);
    b.unmount();
  }
});

test('component logout quarantines matched Pixel and later same-document sign-in cannot reuse it', async () => {
  const b = component(); b.render();
  b.pending[0].resolve({ ok: true, json: async () => ({ customerId: 'customer-a', userData: fields }) });
  await new Promise(setImmediate);
  b.render({ status: 'unauthenticated', data: null });
  assert.equal(b.window.__groveryGiftzMetaIdentityLocked, true);
  b.render({ status: 'authenticated', data: { user: { type: 'customer', id: 'customer-b' } } });
  assert.equal(b.c.trackMetaEvent('AddToCart', { value: 100 }), false);
  assert.equal(b.pending.length, 1);
  b.unmount();
});

test('focus response for an expired or different authenticated session quarantines matching', async () => {
  for (const mode of ['expired', 'different']) {
    const b = component(); b.render();
    b.pending[0].resolve({ ok: true, json: async () => ({ customerId: 'customer-a', userData: fields }) });
    await new Promise(setImmediate);
    for (const focus of b.listeners.get('focus')) focus();
    assert.equal(b.pending.length, 2);
    b.pending[1].resolve(mode === 'expired' ? { ok: false, status: 401 } : { ok: true, json: async () => ({ customerId: 'customer-b', userData: fields }) });
    await new Promise(setImmediate);
    assert.equal(b.window.__groveryGiftzMetaIdentityLocked, true);
    assert.equal(b.c.trackMetaEvent('PageView'), false);
    b.unmount();
  }
});
