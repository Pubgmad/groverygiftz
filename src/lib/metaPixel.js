import { isValidMetaPurchase, purchaseAmount } from './metaPurchase';

const ADMIN_PATH_PREFIXES = ['/admin', '/account/manage'];

function isBrowser() {
  return typeof window !== 'undefined';
}

export function isMetaAdminPath(pathname) {
  return ADMIN_PATH_PREFIXES.some((prefix) => String(pathname || '').startsWith(prefix));
}

export function configureMetaPixel(config = {}) {
  if (!isBrowser()) return;
  window.__groveryGiftzMetaPixel = {
    enabled: !!config.enabled,
    pixelId: String(config.pixelId || '').trim(),
    testEventCode: String(config.testEventCode || '').trim(),
    blocked: !!config.blocked,
  };
}

export function getMetaPixelConfig() {
  if (!isBrowser()) return { enabled: false, pixelId: '', testEventCode: '', blocked: true };
  return window.__groveryGiftzMetaPixel || { enabled: false, pixelId: '', testEventCode: '', blocked: true };
}

export function trackMetaEvent(eventName, params = {}, options = {}) {
  if (!isBrowser() || typeof window.fbq !== 'function') return false;
  const config = getMetaPixelConfig();
  if (!config.enabled || !config.pixelId || config.blocked) return false;

  const payload = { ...params };
  const eventID = String(payload.event_id || payload.eventID || '').trim();
  if (eventName === 'Purchase' && (!options.verifiedPurchase || !isValidMetaPurchase({ eventId: eventID, params: payload }))) return false;
  delete payload.event_id;
  delete payload.eventID;
  if (config.testEventCode) payload.test_event_code = config.testEventCode;

  const args = eventName === 'Purchase'
    ? ['trackSingle', config.pixelId, eventName, payload]
    : [options.custom ? 'trackCustom' : 'track', eventName, payload];
  if (eventID) args.push({ eventID });
  window.fbq(...args);
  return true;
}

export function trackVerifiedMetaPurchase(result) {
  if (!isBrowser() || result?.success !== true || result.paymentStatus !== 'paid') return false;
  const event = result.metaPurchase;
  if (!isValidMetaPurchase(event) || event.params.order_id !== result.orderNumber || event.params.value !== purchaseAmount(result.total)) {
    console.warn('Meta Purchase skipped: invalid verified order tracking payload');
    return false;
  }
  // Revisiting a historic receipt must not become a new browser conversion.
  const age = Date.now() / 1000 - event.eventTime;
  if (!Number.isFinite(age) || age < -300 || age > 48 * 60 * 60) return false;
  const pending = window.__groveryGiftzMetaPurchasesPending ||= new Map();
  pending.set(event.eventId, event);
  flushMetaPurchases();
  return true;
}

export function flushMetaPurchases() {
  if (!isBrowser()) return;
  const config = getMetaPixelConfig();
  if (!config.enabled || !config.pixelId || config.blocked || typeof window.fbq !== 'function') return;
  const pending = window.__groveryGiftzMetaPurchasesPending;
  if (!pending) return;
  const sent = window.__groveryGiftzMetaPurchasesSent ||= new Set();
  for (const [id, event] of pending) {
    const key = `groverygiftz-meta-purchase:${config.pixelId}:${id}`;
    let previouslySent = sent.has(key);
    try { previouslySent ||= window.localStorage.getItem(key) === 'sent'; } catch {}
    if (!previouslySent) {
      try {
        if (!trackMetaEvent('Purchase', { ...event.params, event_id: id }, { verifiedPurchase: true })) continue;
      } catch {
        console.warn('Meta Purchase could not be queued');
        continue;
      }
      sent.add(key);
      try { window.localStorage.setItem(key, 'sent'); } catch {}
    }
    pending.delete(id);
  }
}

export function trackMetaCustomEvent(eventName, params = {}) {
  trackMetaEvent(eventName, params, { custom: true });
}

export function buildProductMetaPayload(product, overrides = {}) {
  const id = String(product?._id || product?.productId || product?.id || product?.slug || '');
  const title = product?.title || product?.name || 'Product';
  const quantity = Number(product?.quantity || overrides.quantity || 1);
  const unitPrice = Number(overrides.price ?? product?.price ?? product?.salePrice ?? product?.regularPrice ?? 0);

  return {
    content_ids: id ? [id] : [],
    content_name: title,
    content_type: 'product',
    contents: id ? [{ id, quantity, item_price: unitPrice }] : [],
    currency: 'INR',
    value: Number(overrides.value ?? unitPrice * quantity) || 0,
    num_items: quantity,
    ...overrides,
  };
}

export function buildCartMetaPayload(items = [], value = 0, overrides = {}) {
  const normalizedItems = (items || []).filter(Boolean);
  const contents = normalizedItems.map((item) => ({
    id: String(item.productId || item._id || item.id || item.slug || ''),
    quantity: Number(item.quantity || 1),
    item_price: Number(item.price || item.salePrice || item.regularPrice || 0),
  })).filter((item) => item.id);

  return {
    content_ids: contents.map((item) => item.id),
    content_name: normalizedItems.map((item) => item.title || item.name).filter(Boolean).join(', '),
    content_type: 'product',
    contents,
    currency: 'INR',
    value: Number(value) || contents.reduce((sum, item) => sum + item.item_price * item.quantity, 0),
    num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
    ...overrides,
  };
}
