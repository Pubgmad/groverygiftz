const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const read = (path) => fs.readFileSync(path, 'utf8');
const source = (path) => read(path).replace(/^import .*;\r?\n/gm, '').replace(/export /g, '');
const shared = source('src/lib/metaAttribution.js');
const data = source('src/lib/ga4Data.js');
const analytics = source('src/lib/ga4.js');
const plain = (value) => JSON.parse(JSON.stringify(value));
const item = (changes = {}) => ({ productId: 'product-1', title: 'Metal Photo Frame', price: 500, quantity: 2, variant: 'Size: Large', ...changes });
const order = (changes = {}) => ({ _id: 'database-order-1', orderNumber: 'GG0064', paymentStatus: 'paid', paidAt: new Date().toISOString(), total: 1100, subtotal: 1000, shippingCost: 100, items: [item({ productId: undefined, product: 'product-1' })], ...changes });

function fixture(options = {}) {
  const events = [];
  const storage = options.storage || new Map();
  const session = options.session || new Map();
  const jar = new Map(Object.entries(options.cookies || {}));
  const document = { title: 'GroveryGiftz', referrer: options.referrer || '' };
  Object.defineProperty(document, 'cookie', {
    get: () => [...jar].map(([key, value]) => `${key}=${value}`).join('; '),
    set: (raw) => { const [entry] = raw.split(';'); const split = entry.indexOf('='); if (/Max-Age=0/.test(raw)) jar.delete(entry.slice(0, split)); else jar.set(entry.slice(0, split), entry.slice(split + 1)); },
  });
  const window = {
    location: new URL(options.url || 'https://groverygiftz.in/'), navigator: options.navigator || {},
    localStorage: { get length() { return storage.size; }, key: (index) => [...storage.keys()][index], getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    sessionStorage: { getItem: (key) => session.get(key), setItem: (key, value) => session.set(key, value), removeItem: (key) => session.delete(key) },
    performance: { timeOrigin: options.documentTime || 100 },
    gtag: (...args) => events.push(plain(args)),
  };
  const c = vm.createContext({ URL, console, process: { env: options.env || {} }, window, document, Date, Set, Map });
  vm.runInContext(shared + '\n' + data + '\n' + analytics, c);
  const ready = () => { c.initializeGA4(); c.setGA4Ready(); };
  const fired = (name) => events.filter((entry) => entry[0] === 'event' && (!name || entry[1] === name));
  const verified = (value = order()) => ({ success: true, paymentStatus: value.paymentStatus, orderNumber: value.orderNumber, total: value.total, ga4Purchase: c.buildGA4Purchase(value) });
  return { c, events, window, document, storage, session, jar, ready, fired, verified };
}

test('one exact measurement ID, one config, manual page views and no Google advertising features', () => {
  const b = fixture();
  b.ready(); b.c.initializeGA4();
  const configs = b.events.filter((entry) => entry[0] === 'config');
  assert.equal(configs.length, 1);
  assert.equal(configs[0][1], 'G-JNPXLZQB0V');
  assert.equal(configs[0][2].send_page_view, false);
  assert.equal(configs[0][2].allow_google_signals, false);
  assert.equal(configs[0][2].allow_ad_personalization_signals, false);
  assert.equal(b.fired().length, 0);
});
test('automatic mode permits analytics storage without inventing a choice or granting advertising permission', () => {
  const b = fixture(); b.ready();
  const first = b.events[0];
  assert.deepEqual(first, ['consent', 'default', { analytics_storage: 'granted', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied' }]);
  assert.equal(b.jar.size, 0);
  assert.equal(b.c.trackGA4PageView(), true);
});
test('an actual existing choice grants only analytics storage, not ads personalization', () => {
  const b = fixture({ cookies: { gg_marketing_consent: 'granted' } }); b.ready();
  assert.equal(b.events[0][2].analytics_storage, 'granted');
  assert.equal(b.events[0][2].ad_user_data, 'denied');
  assert.equal(b.events[0][2].ad_personalization, 'denied');
});
test('explicit denial, GPC, DNT, and strict unknown consent prevent all GA initialization/events', () => {
  for (const options of [{ cookies: { gg_marketing_consent: 'denied' } }, { navigator: { globalPrivacyControl: true } }, { navigator: { doNotTrack: '1' } }, { env: { NEXT_PUBLIC_META_REQUIRE_CONSENT: 'true' } }]) {
    const b = fixture(options); b.ready();
    assert.equal(b.c.trackGA4Ecommerce('add_to_cart', [item()]), false);
    assert.equal(b.c.trackGA4Purchase(b.verified()), false);
    assert.equal(b.events.length, 0);
  }
});
test('withdrawal drops pending events, disables the property and removes only GA cookies', () => {
  const b = fixture({ cookies: { _ga: 'old', _ga_JNPXLZQB0V: 'old', _fbc: 'meta', cart: 'saved', 'next-auth.session-token': 'auth' } });
  b.c.initializeGA4();
  b.c.trackGA4Purchase(b.verified());
  b.jar.set('gg_marketing_consent', 'denied');
  assert.equal(b.c.syncGA4Privacy(), false);
  b.c.setGA4Ready();
  assert.equal(b.fired().length, 0);
  assert.equal(b.window['ga-disable-G-JNPXLZQB0V'], true);
  assert.equal(b.jar.has('_ga'), false);
  assert.equal(b.jar.has('_ga_JNPXLZQB0V'), false);
  assert.equal(b.jar.get('_fbc'), 'meta');
  assert.equal(b.jar.get('cart'), 'saved');
  assert.equal(b.jar.get('next-auth.session-token'), 'auth');
});
test('withdrawal clears markers for unsent views, so a later valid grant can measure the current view', () => {
  const b = fixture(); b.c.initializeGA4();
  b.c.trackGA4Product('view_item_list', item());
  b.jar.set('gg_marketing_consent', 'denied'); b.c.syncGA4Privacy();
  b.jar.set('gg_marketing_consent', 'granted'); b.c.syncGA4Privacy();
  assert.equal(b.c.trackGA4Product('view_item_list', item()), true);
  b.c.setGA4Ready();
  assert.equal(b.fired('view_item_list').length, 1);
  assert.equal(b.fired('page_view').length, 1);
});
test('direct and client-side page views are deduplicated and referrers follow the journey', () => {
  const b = fixture({ referrer: 'https://www.google.com/search?q=private@example.invalid' }); b.ready();
  assert.equal(b.c.trackGA4PageView(), true);
  assert.equal(b.c.trackGA4PageView(), false);
  assert.equal(b.fired('page_view')[0][2].page_referrer, 'https://www.google.com/');
  b.window.location = new URL('https://groverygiftz.in/products/frame');
  b.c.trackGA4PageView();
  assert.equal(b.fired('page_view')[1][2].page_referrer, 'https://groverygiftz.in/');
  b.window.location = new URL('https://groverygiftz.in/'); b.c.trackGA4PageView();
  assert.equal(b.fired('page_view').length, 3);
});
test('route context uses one consistent scope and never repeats the tag config', () => {
  const b = fixture(); b.ready(); b.c.trackGA4PageView();
  b.window.location = new URL('https://groverygiftz.in/products/frame'); b.document.title = 'Metal Frame'; b.c.trackGA4PageView();
  const configs = b.events.filter((event) => event[0] === 'config');
  const contexts = b.events.filter((event) => event[0] === 'set' && typeof event[1] === 'object');
  assert.equal(configs.length, 1);
  assert.equal(configs[0][2].page_location, undefined);
  assert.equal(configs[0][2].page_title, undefined);
  assert.equal(contexts.at(-1)[1].page_location, 'https://groverygiftz.in/products/frame');
  assert.equal(contexts.at(-1)[1].page_title, 'Metal Frame');
});
test('URL measurement retains safe campaigns but never changes the actual URL or leaks tokens/PII', () => {
  const url = 'https://groverygiftz.in/auth/reset-password?token=secret&email=private@example.invalid&callbackUrl=/checkout&cashfree_order_id=private-order&utm_source=instagram&utm_medium=paid_social&utm_campaign=frames&fbclid=real_click#secret';
  const b = fixture({ url }); b.ready(); b.c.trackGA4PageView();
  const payload = b.fired('page_view')[0][2];
  assert.match(payload.page_location, /utm_source=instagram/);
  assert.match(payload.page_location, /fbclid=real_click/);
  for (const secret of ['secret', 'private@example', 'callbackUrl', 'cashfree_order_id']) assert.equal(JSON.stringify(b.events).includes(secret), false);
  assert.equal(b.window.location.href, url);
});
test('search-query route changes are counted without sending the raw query', () => {
  const b = fixture({ url: 'https://groverygiftz.in/search?q=metal' }); b.ready(); b.c.trackGA4PageView();
  b.window.location = new URL('https://groverygiftz.in/search?q=frame'); b.c.trackGA4PageView();
  assert.equal(b.fired('page_view').length, 2);
  assert.equal(b.fired('page_view').some((event) => event[2].page_location.includes('q=')), false);
});
test('admin routes never initialize GA and an SPA transition disables an existing tag', () => {
  const direct = fixture({ url: 'https://groverygiftz.in/account/manage/orders' }); direct.ready();
  assert.equal(direct.events.length, 0);
  const b = fixture(); b.ready(); b.c.trackGA4PageView();
  b.window.location = new URL('https://groverygiftz.in/account/manage/orders'); b.c.syncGA4Privacy();
  assert.equal(b.c.trackGA4PageView(), false);
  assert.equal(b.window['ga-disable-G-JNPXLZQB0V'], true);
});
test('local/development visits do not pollute the live property without explicit debug opt-in', () => {
  for (const options of [{ url: 'http://localhost:3000/' }, { env: { NODE_ENV: 'development' } }]) {
    const b = fixture(options); b.ready();
    assert.equal(b.c.trackGA4PageView(), false);
    assert.equal(b.events.length, 0);
  }
  const debug = fixture({ url: 'http://localhost:3000/', env: { NODE_ENV: 'development', NEXT_PUBLIC_GA4_DEBUG: 'true' } }); debug.ready();
  assert.equal(debug.c.trackGA4PageView(), true);
  assert.equal(debug.fired('page_view')[0][2].debug_mode, true);
});
test('Cashfree referral is ignored, not invented as a marketing source', () => {
  const b = fixture({ referrer: 'https://payments.cashfree.com/payment?token=private' }); b.ready();
  assert.equal(b.events.find((event) => event[0] === 'config')[2].ignore_referrer, true);
  const direct = fixture(); direct.ready();
  assert.equal(direct.events.find((event) => event[0] === 'set' && typeof event[1] === 'object')[1].page_referrer, '');
});
test('selected variants, discounted unit prices and real quantities are allowlisted', () => {
  const b = fixture();
  const product = item({ regularPrice: 700, customFields: { Name: 'Private Person' }, giftMessage: 'secret', image: 'https://private.invalid', email: 'private@example.invalid', collections: [{ name: 'Frames' }] });
  const value = plain(b.c.buildGA4Item(product));
  assert.equal(value.item_variant, 'Size: Large');
  assert.equal(value.price, 500);
  assert.equal(value.discount, 200);
  assert.equal(value.quantity, 2);
  assert.equal(value.item_category, 'Frames');
  assert.equal(JSON.stringify(value).includes('Private'), false);
  assert.equal(JSON.stringify(value).includes('secret'), false);
  assert.equal(JSON.stringify(value).includes('https:'), false);
});
test('zero-priced legitimate items remain zero; quote-only prices are omitted', () => {
  const b = fixture();
  assert.equal(b.c.buildGA4Item(item({ price: 0 })).price, 0);
  assert.equal(b.c.buildGA4Item(item({ price: 0, isQuoteOnly: true })).price, undefined);
});
test('list and item impressions are deduplicated per actual visit; real selections may repeat', () => {
  const b = fixture(); b.ready();
  for (let n = 0; n < 2; n += 1) b.c.trackGA4Product('view_item_list', item(), { listId: 'featured', index: 0 });
  b.c.trackGA4PageView();
  b.c.trackGA4Product('view_item_list', item(), { listId: 'featured', index: 0 });
  assert.equal(b.fired('view_item_list').length, 1);
  b.c.trackGA4Product('select_item', item()); b.c.trackGA4Product('select_item', item());
  assert.equal(b.fired('select_item').length, 2);
  b.window.location = new URL('https://groverygiftz.in/shop'); b.c.trackGA4PageView();
  b.window.location = new URL('https://groverygiftz.in/'); b.c.trackGA4Product('view_item_list', item(), { listId: 'featured' });
  assert.equal(b.fired('view_item_list').length, 2);
});
for (const name of ['add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info']) {
  test(`${name} uses item sums, quantities and INR without shipping or private selections`, () => {
    const b = fixture(); b.ready();
    b.c.trackGA4Ecommerce(name, [item(), item({ productId: 'second', price: 100, quantity: 1, customFields: { email: 'private@example.invalid' } })], { shippingAddress: { name: 'Private' } });
    const event = b.fired(name)[0][2];
    assert.equal(event.value, 1100); assert.equal(event.currency, 'INR'); assert.equal(event.items.length, 2);
    assert.equal(JSON.stringify(event).includes('Private'), false);
    if (name === 'add_payment_info') assert.equal(event.payment_type, 'Cashfree');
  });
}
test('empty cart view is real, but cannot become a purchase', () => {
  const b = fixture(); b.ready();
  assert.equal(b.c.trackGA4Ecommerce('view_cart', []), true);
  assert.equal(b.fired('view_cart')[0][2].value, 0);
  assert.equal(b.c.buildGA4Purchase(order({ items: [], total: 0, subtotal: 0, shippingCost: 0 })), null);
});
for (const [name, changes, expected] of [
  ['shipping included', {}, 1000],
  ['discounted units', { items: [item({ price: 450 })], total: 1000, subtotal: 900 }, 900],
  ['multiple products', { items: [item(), item({ productId: 'second', price: 150, quantity: 3 })], total: 1550, subtotal: 1450 }, 1450],
  ['zero-valued real purchase', { items: [item({ price: 0 })], total: 0, subtotal: 0, shippingCost: 0 }, 0],
]) {
  test(`verified purchase ${name} has Google merchandise value and separate shipping`, () => {
    const b = fixture(); b.ready();
    assert.equal(b.c.trackGA4Purchase(b.verified(order(changes))), true);
    const event = b.fired('purchase')[0][2];
    assert.equal(event.value, expected); assert.equal(event.shipping, changes.shippingCost ?? 100); assert.equal(event.currency, 'INR');
    assert.equal(event.items.reduce((sum, product) => sum + product.price * product.quantity, 0), event.value);
    assert.equal(event.transaction_id, 'GG0064-database-order-1');
  });
}
test('purchase builders reject unpaid, unfinalized, inconsistent or missing saved amounts', () => {
  const b = fixture();
  for (const changes of [{ paymentStatus: 'pending' }, { paymentStatus: 'failed' }, { paymentStatus: 'refunded' }, { orderNumber: 'PENDING-TEST' }, { total: undefined }, { total: -1 }, { total: NaN }, { total: 110000 }, { shippingCost: undefined }, { paidAt: undefined }, { items: [item({ quantity: undefined })] }, { items: [item({ price: undefined })] }]) assert.equal(b.c.buildGA4Purchase(order(changes)), null);
});
test('receipt refresh, repeat responses and blocked local storage do not emit duplicate purchases', () => {
  const b = fixture({ cookies: { gg_marketing_consent: 'granted' } }); b.ready();
  const response = b.verified();
  assert.equal(b.c.trackGA4Purchase(response), true);
  assert.equal(b.c.trackGA4Purchase(response), false);
  const refreshed = fixture({ storage: b.storage, cookies: { gg_marketing_consent: 'granted' } }); refreshed.ready();
  assert.equal(refreshed.c.trackGA4Purchase(response), false);
  b.window.localStorage = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } };
  const second = b.verified(order({ _id: 'new-order' }));
  assert.equal(b.c.trackGA4Purchase(second), true);
  assert.equal(b.c.trackGA4Purchase(second), false);
});
test('strict unknown and explicit opt-outs never access analytics storage or emit purchases', () => {
  for (const options of [{ env: { NEXT_PUBLIC_META_REQUIRE_CONSENT: 'true' } }, { cookies: { gg_marketing_consent: 'denied' } }, { navigator: { globalPrivacyControl: true } }, { navigator: { doNotTrack: '1' } }]) {
    const b = fixture(options); b.ready();
    let attempts = 0;
    b.window.localStorage = { getItem() { attempts += 1; }, setItem() { attempts += 1; } };
    b.window.sessionStorage = { getItem() { attempts += 1; }, setItem() { attempts += 1; } };
    assert.equal(b.c.trackGA4Purchase(b.verified()), false);
    assert.equal(b.c.trackGA4Purchase(b.verified()), false);
    b.c.rememberGA4GoogleLogin();
    assert.equal(b.c.completeGA4GoogleLogin(), false);
    assert.equal(attempts, 0);
    assert.equal(b.fired().length, 0);
  }
});

test('automatic mode persists purchase deduplication and fresh Google login intent', () => {
  const b = fixture(); b.ready();
  const response = b.verified();
  assert.equal(b.c.trackGA4Purchase(response), true);
  assert.equal(b.storage.has('gg-ga4-purchase-G-JNPXLZQB0V-GG0064-database-order-1'), true);
  b.c.rememberGA4GoogleLogin();
  assert.equal(b.jar.has('gg_marketing_consent'), false);
  const returned = fixture({ storage: b.storage, session: b.session, documentTime: 200 }); returned.ready();
  assert.equal(returned.c.trackGA4Purchase(response), false);
  assert.equal(returned.c.completeGA4GoogleLogin(), true);
});

test('strict mode starts tracking only after a real grant and stops on rejection', () => {
  const b = fixture({ env: { NEXT_PUBLIC_META_REQUIRE_CONSENT: 'true' } });
  b.ready();
  assert.equal(b.events.length, 0);
  b.jar.set('gg_marketing_consent', 'granted');
  assert.equal(b.c.syncGA4Privacy(), true);
  b.ready();
  assert.equal(b.events.find((event) => event[0] === 'consent' && event[1] === 'default')[2].analytics_storage, 'granted');
  assert.equal(b.c.trackGA4PageView(), true);
  b.jar.set('gg_marketing_consent', 'denied');
  assert.equal(b.c.syncGA4Privacy(), false);
  assert.equal(b.events.filter((event) => event[0] === 'consent').at(-1)[2].analytics_storage, 'denied');
  assert.equal(b.c.trackGA4Ecommerce('add_to_cart', [item()]), false);
});
test('old analytics receipt markers are pruned without touching cart/auth storage', () => {
  const storage = new Map([
    ['gg-ga4-purchase-G-JNPXLZQB0V-old', String(Date.now() - 8 * 86400000)],
    ['groverygiftz-cart', 'keep'], ['auth', 'keep'],
  ]);
  const b = fixture({ storage, cookies: { gg_marketing_consent: 'granted' } }); b.ready();
  assert.equal(storage.has('gg-ga4-purchase-G-JNPXLZQB0V-old'), false);
  assert.equal(storage.get('groverygiftz-cart'), 'keep');
  assert.equal(storage.get('auth'), 'keep');
});
test('reused display order numbers have distinct transaction IDs and do not collide with Meta IDs', () => {
  const b = fixture();
  const first = b.c.buildGA4Purchase(order()); const second = b.c.buildGA4Purchase(order({ _id: 'second-real-order' }));
  assert.notEqual(first.params.transaction_id, second.params.transaction_id);
  assert.notEqual(first.params.transaction_id, 'purchase-database-order-1');
});
test('SDK readiness queues a verified purchase once; stale receipts and invalid snapshots are rejected', () => {
  const b = fixture(); b.c.initializeGA4();
  const response = b.verified();
  assert.equal(b.c.trackGA4Purchase(response), true);
  assert.equal(b.c.trackGA4Purchase(response), false);
  assert.equal(b.fired().length, 0);
  b.c.setGA4Ready(); b.c.setGA4Ready();
  assert.equal(b.fired('purchase').length, 1);
  assert.equal(b.c.trackGA4Purchase(b.verified(order({ _id: 'old', paidAt: new Date(Date.now() - 4 * 86400000).toISOString() }))), false);
  assert.equal(b.c.trackGA4Purchase({ ...response, total: 1 }), false);
  assert.equal(b.c.trackGA4Purchase({ ...response, success: false }), false);
});
test('success virtual page is emitted once and redirect-query cleanup cannot create a phantom checkout', () => {
  const b = fixture({ url: 'https://groverygiftz.in/checkout?cashfree_order_id=private' }); b.ready();
  b.c.trackGA4PageView(); b.c.trackGA4Purchase(b.verified()); b.c.trackGA4OrderConfirmation();
  b.window.location = new URL('https://groverygiftz.in/checkout'); b.c.trackGA4PageView(); b.c.trackGA4OrderConfirmation();
  assert.equal(b.fired('page_view').length, 2);
  assert.equal(b.fired('page_view')[1][2].page_location, 'https://groverygiftz.in/checkout/success');
  assert.equal(b.fired('page_view')[1][2].page_title, 'Order placed successfully | GroveryGiftz');
});
test('search terms must match public catalog vocabulary and cannot contain contact information', () => {
  const b = fixture({ url: 'https://groverygiftz.in/search?q=metal' }); b.ready();
  const products = [{ title: 'Metal Photo Frame' }];
  assert.equal(b.c.trackGA4Search('metal frame', products), true);
  assert.equal(b.c.trackGA4Search('metal frame', products), false);
  for (const term of ['private@example.invalid', '9876543210', 'Alice Smith', '']) assert.equal(b.c.trackGA4Search(term, products), false);
  assert.equal(b.c.trackGA4Search('unknown personal text', []), false);
});
test('auth events contain only successful action/method; unrelated events cannot be invented', () => {
  const b = fixture(); b.ready();
  assert.equal(b.c.trackGA4Auth('login', 'Email'), true);
  assert.equal(b.c.trackGA4Auth('sign_up', 'Email'), true);
  assert.equal(b.c.trackGA4Auth('login', 'private@example.invalid'), false);
  assert.equal(b.c.trackGA4Ecommerce('refund', [item()]), false);
});
test('Google login requires a fresh intent, new document and no OAuth error; existing sessions are not logins', () => {
  const cookies = { gg_marketing_consent: 'granted' };
  const b = fixture({ cookies }); b.ready();
  assert.equal(b.c.completeGA4GoogleLogin(), false);
  b.c.rememberGA4GoogleLogin();
  assert.equal(b.c.completeGA4GoogleLogin(), false);
  const returned = fixture({ session: b.session, documentTime: 200, cookies }); returned.ready();
  assert.equal(returned.c.completeGA4GoogleLogin(), true);
  assert.equal(returned.c.completeGA4GoogleLogin(), false);
  assert.equal(returned.fired('login')[0][2].method, 'Google');
  b.c.rememberGA4GoogleLogin();
  const failed = fixture({ session: b.session, documentTime: 300, url: 'https://groverygiftz.in/auth/login?error=AccessDenied', cookies }); failed.ready();
  assert.equal(failed.c.completeGA4GoogleLogin(), false);
});
test('tracking exceptions cannot interrupt cart or checkout operations', () => {
  const b = fixture(); b.ready();
  b.window.gtag = () => { throw Error('Analytics blocked'); };
  assert.equal(b.c.trackGA4Ecommerce('add_to_cart', [item()]), false);
  assert.equal(b.c.trackGA4Purchase(b.verified()), false);
  assert.equal(b.c.trackGA4PageView(), false);
});

function cartFixture() {
  const b = fixture(); b.ready();
  b.c.cartRef = { current: [] };
  b.c.isAuthenticatedCustomer = false;
  b.c.applyCart = (items) => { b.c.cartRef.current = items; };
  b.c.persistGuestCart = () => {};
  b.c.setIsCartOpen = () => {};
  const text = read('src/context/CartContext.js');
  vm.runInContext(text.slice(text.indexOf('const isSameCartLine'), text.indexOf('const stripDisplayOnlyPreviewData')), b.c);
  vm.runInContext(text.slice(text.indexOf('  const addToCart ='), text.indexOf('  const cartCount =')) + '\nglobalThis.operations = { addToCart, removeFromCart, updateQuantity, clearCart };', b.c);
  return b;
}
test('real CartContext tracks actual stock-capped additions without changing stored quantities', () => {
  const b = cartFixture();
  b.c.operations.addToCart(item({ quantity: 2, availableStock: 3 }));
  b.c.operations.addToCart(item({ quantity: 2, availableStock: 3 }));
  b.c.operations.addToCart(item({ quantity: 2, availableStock: 3 }));
  assert.equal(b.c.cartRef.current[0].quantity, 3);
  assert.deepEqual(b.fired('add_to_cart').map((event) => event[2].items[0].quantity), [2, 1]);
});
test('real CartContext tracks quantity deltas and actual removal, but not payment clear or missing items', () => {
  const b = cartFixture();
  b.c.operations.addToCart(item({ quantity: 3, availableStock: 5 }));
  b.c.operations.updateQuantity('product-1', 'Size: Large', 1);
  b.c.operations.removeFromCart('missing', '');
  assert.equal(b.fired('remove_from_cart').length, 1);
  assert.equal(b.fired('remove_from_cart')[0][2].items[0].quantity, 2);
  b.c.operations.clearCart();
  assert.equal(b.c.cartRef.current.length, 0);
  assert.equal(b.fired('remove_from_cart').length, 1);
});
test('one framework script is globally mounted and Meta initialization is retained separately', () => {
  const layout = read('src/app/layout.js');
  const component = read('src/components/analytics/GoogleAnalytics.js');
  assert.equal(layout.match(/<GoogleAnalytics\s*\/>/g).length, 1);
  assert.equal(layout.match(/<MetaPixel\s*\/>/g).length, 1);
  assert.match(component, /strategy="afterInteractive"/);
  assert.match(component, /id="grovery-ga4-sdk"/);
  assert.match(component, /session\?\.user\?\.type === 'customer'/);
  assert.match(component, /requestAnimationFrame\(\(\) => trackGA4PageView\(\)\)/);
  const checkout = read('src/app/checkout/page.js');
  assert.match(checkout, /addEventListener\(META_CONSENT_EVENT, trackCheckout\)/);
  assert.match(checkout, /removeEventListener\(META_CONSENT_EVENT, trackCheckout\)/);
});
