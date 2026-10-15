import { getGoogleConsent, getGoogleConsentState, hasGooglePrivacySignal } from './googleConsent';
import { GA4_MEASUREMENT_ID, GA4_CURRENCY, ga4Money, ga4Text, ga4PublicUrl, buildGA4Cart, buildGA4Item, ga4SearchTerm } from './ga4Data';

const GA4_ECOMMERCE_EVENTS = new Set(['view_item', 'view_item_list', 'select_item', 'add_to_cart', 'remove_from_cart', 'view_cart', 'begin_checkout', 'add_shipping_info', 'add_payment_info']);
const ga4Browser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
export const isGA4AdminPath = (path = '') => ['/admin', '/account/manage'].some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
const ga4CanLoad = () => {
  if (!ga4Browser() || isGA4AdminPath(window.location.pathname) || hasGooglePrivacySignal()) return false;
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(window.location.hostname);
  if ((local || process.env.NODE_ENV === 'development') && process.env.NEXT_PUBLIC_GA4_DEBUG !== 'true') return false;
  const choice = getGoogleConsent();
  return choice.analytics === 'granted' || choice.advertising === 'granted';
};
export const isGA4TrackingAllowed = () => ga4CanLoad() && getGoogleConsent().analytics === 'granted';
const ga4Allowed = isGA4TrackingAllowed;
const ga4StorageAllowed = () => ga4Allowed();
const ga4State = () => window.__groveryGA4 || (window.__groveryGA4 = { initialized: false, ready: false, queue: [], pendingPurchases: new Set(), sentPurchases: new Set(), lastPage: '', lastPageKey: '', contextKey: '', referrer: '', impressions: new Set(), lastSearch: '' });
const ga4ReceiptPrefix = `gg-ga4-purchase-${GA4_MEASUREMENT_ID}-`;

function pruneGA4Receipts() {
  if (!ga4StorageAllowed()) return;
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (!key?.startsWith(ga4ReceiptPrefix)) continue;
      const recorded = Number(window.localStorage.getItem(key));
      if (!Number.isFinite(recorded) || recorded < Date.now() - 7 * 86400000) window.localStorage.removeItem(key);
    }
  } catch {}
}

function ga4ConsentState() {
  return getGoogleConsentState();
}

export function initializeGA4() {
  try {
    if (!ga4CanLoad()) return false;
    const state = ga4State();
    window[`ga-disable-${GA4_MEASUREMENT_ID}`] = false;
    if (state.initialized) return true;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') window.gtag = function gtag() { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', ga4ConsentState());
    window.gtag('set', 'ads_data_redaction', true);
    window.gtag('set', 'allow_ad_personalization_signals', getGoogleConsent().advertising === 'granted');
    window.gtag('js', new Date());
    const referrer = ga4PublicUrl(document.referrer || '', window.location.origin, true);
    const pageContext = { page_location: ga4PublicUrl(window.location.href), page_referrer: referrer, page_title: ga4Text(document.title) || 'GroveryGiftz' };
    // Keep page context out of config scope, so subsequent SPA set updates apply.
    window.gtag('set', pageContext);
    window.gtag('config', GA4_MEASUREMENT_ID, {
      send_page_view: false,
      allow_google_signals: false,
      ignore_referrer: /^https?:\/\/([a-z0-9-]+\.)*cashfree\.com\//i.test(referrer),
    });
    state.pageContextKey = JSON.stringify(pageContext);
    state.initialized = true;
    pruneGA4Receipts();
    return true;
  } catch { return false; }
}

export function syncGA4Privacy() {
  try {
    if (!ga4Browser()) return false;
    const state = ga4State();
    const canLoad = ga4CanLoad();
    const allowed = ga4Allowed();
    window[`ga-disable-${GA4_MEASUREMENT_ID}`] = !canLoad;
    if (!allowed) {
      state.queue = [];
      state.pendingPurchases.clear();
      state.lastPageKey = '';
      state.lastPage = '';
      state.referrer = '';
      state.contextKey = '';
      state.impressions.clear();
      state.lastSearch = '';
      clearGA4GoogleLogin();
      if (getGoogleConsent().analytics !== 'granted') {
        try {
          for (const name of ['_ga', `_ga_${GA4_MEASUREMENT_ID.slice(2)}`]) {
            for (const domain of ['', window.location.hostname, 'groverygiftz.in']) {
              document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
            }
          }
        } catch {}
      }
    }
    if (state.initialized && typeof window.gtag === 'function') {
      window.gtag('consent', 'update', ga4ConsentState());
      window.gtag('set', 'allow_ad_personalization_signals', canLoad && getGoogleConsent().advertising === 'granted');
    }
    if (getGoogleConsent().advertising !== 'granted') {
      try {
        const names = document.cookie.split(';').map((part) => part.split('=')[0].trim()).filter((name) => /^_gcl_[a-zA-Z0-9_]+$/.test(name));
        for (const name of names) {
          for (const domain of ['', window.location.hostname, 'groverygiftz.in']) document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${domain ? `; Domain=${domain}` : ''}`;
        }
      } catch {}
    }
    return canLoad;
  } catch { return false; }
}

function ga4Context() {
  const state = ga4State();
  if (state.contextKey !== window.location.href) {
    state.contextKey = window.location.href;
    state.impressions.clear();
    state.lastSearch = '';
  }
  const confirmation = state.checkoutComplete && window.location.pathname === '/checkout';
  const location = ga4PublicUrl(confirmation ? `${window.location.origin}/checkout/success` : window.location.href);
  return { page_location: location, page_title: confirmation ? 'Order placed successfully | GroveryGiftz' : ga4Text(document.title) || 'GroveryGiftz', page_referrer: state.referrer || ga4PublicUrl(document.referrer || '', window.location.origin, true) };
}

function ga4Send(event) {
  const state = ga4State();
  if (!ga4Allowed() || typeof window.gtag !== 'function' || Date.now() - event.createdAt > 1800000) return false;
  if (event.purchaseId && Date.now() / 1000 - event.purchaseTime > 72 * 3600) return false;
  if (event.purchaseId && state.sentPurchases.has(event.purchaseId)) return false;
  const pageContext = { page_location: event.params.page_location, page_referrer: event.params.page_referrer, page_title: event.params.page_title };
  const pageContextKey = JSON.stringify(pageContext);
  if (state.pageContextKey !== pageContextKey) {
    window.gtag('set', pageContext);
    state.pageContextKey = pageContextKey;
  }
  window.gtag('event', event.name, { ...event.params, send_to: GA4_MEASUREMENT_ID, ...(process.env.NEXT_PUBLIC_GA4_DEBUG === 'true' ? { debug_mode: true } : {}) });
  if (event.purchaseId) {
    state.sentPurchases.add(event.purchaseId);
    state.pendingPurchases.delete(event.purchaseId);
    if (ga4StorageAllowed()) {
      try { window.localStorage.setItem(`${ga4ReceiptPrefix}${event.purchaseId}`, String(Date.now())); } catch {}
    }
  }
  return true;
}

function ga4Queue(name, params, purchaseId = '', purchaseTime = 0) {
  try {
    if (!ga4Allowed()) return false;
    const state = ga4State();
    if (name !== 'page_view') trackGA4PageView();
    const event = { name, params: { ...ga4Context(), ...params }, purchaseId, purchaseTime, createdAt: Date.now() };
    if (state.ready) return ga4Send(event);
    if (purchaseId && state.pendingPurchases.has(purchaseId)) return false;
    if (state.queue.length >= 100) { const dropped = state.queue.shift(); if (dropped.purchaseId) state.pendingPurchases.delete(dropped.purchaseId); }
    state.queue.push(event);
    if (purchaseId) state.pendingPurchases.add(purchaseId);
    return true;
  } catch { return false; }
}

export function setGA4Ready() {
  try {
    if (!ga4CanLoad()) return;
    const state = ga4State();
    state.ready = true;
    const queued = state.queue;
    state.queue = [];
    for (const event of queued) {
      if (event.purchaseId) state.pendingPurchases.delete(event.purchaseId);
      try { ga4Send(event); } catch {}
    }
  } catch {}
}

export function trackGA4PageView(rawUrl) {
  try {
    if (!ga4Allowed()) return false;
    const state = ga4State();
    if (window.location.pathname !== '/checkout') state.checkoutComplete = false;
    const key = rawUrl || (state.checkoutComplete ? `${window.location.origin}/checkout/success` : window.location.href);
    const location = ga4PublicUrl(key);
    if (!location || state.lastPageKey === key) return false;
    state.referrer = state.lastPage || ga4PublicUrl(document.referrer || '', window.location.origin, true);
    const url = new URL(location);
    if (!ga4Queue('page_view', { page_location: location, page_path: url.pathname + url.search })) return false;
    state.lastPage = location;
    state.lastPageKey = key;
    return true;
  } catch { return false; }
}

export function trackGA4OrderConfirmation() {
  try {
    if (!ga4Allowed() || window.location.pathname !== '/checkout') return false;
    ga4State().checkoutComplete = true;
    return trackGA4PageView();
  } catch { return false; }
}

export function trackGA4Ecommerce(name, items, extra = {}) {
  try {
    if (!GA4_ECOMMERCE_EVENTS.has(name)) return false;
    const payload = name === 'view_cart' && Array.isArray(items) && items.length === 0 ? { currency: GA4_CURRENCY, value: 0, items: [] } : buildGA4Cart(items);
    if (!payload) return false;
    if (name === 'add_payment_info') payload.payment_type = 'Cashfree';
    for (const key of ['item_list_id', 'item_list_name']) if (extra[key]) payload[key] = ga4Text(extra[key]);
    return ga4Queue(name, payload);
  } catch { return false; }
}

export function trackGA4Product(name, product, options = {}) {
  try {
    if (!['view_item', 'view_item_list', 'select_item'].includes(name)) return false;
    const item = buildGA4Item(product, options);
    if (!item) return false;
    if (!ga4Allowed()) return false;
    ga4Context();
    const state = ga4State();
    const key = `${name}:${window.location.pathname}:${options.listId || ''}:${item.item_id}:${item.item_variant || ''}`;
    if (name !== 'select_item' && state.impressions.has(key)) return false;
    const payload = { items: [item], ...(item.price !== undefined ? { currency: GA4_CURRENCY, value: ga4Money(item.price * item.quantity) } : {}) };
    if (!ga4Queue(name, payload)) return false;
    if (name !== 'select_item') state.impressions.add(key);
    return true;
  } catch { return false; }
}

export function trackGA4Search(query, products) {
  try {
    if (!ga4Allowed()) return false;
    ga4Context();
    const term = ga4SearchTerm(query, products);
    if (!term || ga4State().lastSearch === term) return false;
    if (!ga4Queue('search', { search_term: term })) return false;
    ga4State().lastSearch = term;
    return true;
  } catch { return false; }
}

export function trackGA4Auth(name, method = 'Email') {
  if (!['login', 'sign_up'].includes(name) || !['Email', 'Google'].includes(method)) return false;
  return ga4Queue(name, { method });
}

export function trackGA4Purchase(result) {
  try {
    if (!ga4Allowed() || result?.success !== true || result.paymentStatus !== 'paid') return false;
    const snapshot = result.ga4Purchase;
    const params = snapshot?.params;
    const cart = buildGA4Cart((params?.items || []).map((item) => ({ productId: item.item_id, title: item.item_name, price: item.price, quantity: item.quantity, variant: item.item_variant })));
    const age = Date.now() / 1000 - snapshot?.eventTime;
    if (!cart || !Number.isFinite(age) || age < -300 || age > 72 * 3600 || params.currency !== GA4_CURRENCY || !/^GG\d{4,}$/.test(result.orderNumber || '') || !params.transaction_id?.startsWith(`${result.orderNumber}-`) || ga4Money(params.value) !== cart.value || ga4Money(params.shipping) === null || ga4Money(result.total) === null || Math.abs(cart.value + params.shipping - ga4Money(result.total)) > 0.01) return false;
    const id = params.transaction_id;
    const state = ga4State();
    if (state.sentPurchases.has(id) || state.pendingPurchases.has(id)) return false;
    if (ga4StorageAllowed()) {
      try {
        const recorded = Number(window.localStorage.getItem(`${ga4ReceiptPrefix}${id}`));
        if (recorded > Date.now() - 7 * 86400000) return false;
      } catch {}
    }
    return ga4Queue('purchase', { ...cart, transaction_id: id, shipping: ga4Money(params.shipping) }, id, snapshot.eventTime);
  } catch { return false; }
}

export function clearGA4GoogleLogin() {
  try { if (ga4Browser()) window.sessionStorage.removeItem('gg-ga4-google-login'); } catch {}
}

export function rememberGA4GoogleLogin() {
  try {
    if (!ga4StorageAllowed()) return;
    window.sessionStorage.setItem('gg-ga4-google-login', JSON.stringify({ startedAt: Date.now(), documentTime: window.performance.timeOrigin }));
  } catch {}
}

export function completeGA4GoogleLogin() {
  try {
    if (!ga4StorageAllowed()) return false;
    const pending = JSON.parse(window.sessionStorage.getItem('gg-ga4-google-login') || 'null');
    if (!pending || pending.documentTime === window.performance.timeOrigin) return false;
    clearGA4GoogleLogin();
    const elapsed = Date.now() - pending.startedAt;
    if (!Number.isFinite(elapsed) || elapsed < 0 || elapsed > 300000 || new URL(window.location.href).searchParams.has('error')) return false;
    return trackGA4Auth('login', 'Google');
  } catch { return false; }
}
