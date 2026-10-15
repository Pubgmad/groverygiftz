export const GA4_MEASUREMENT_ID = 'G-JNPXLZQB0V';
export const GA4_CURRENCY = 'INR';

export function ga4Money(value) {
  if (value === null || value === undefined || typeof value === 'boolean' || String(value).trim() === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
}

export function ga4Text(value, limit = 100) {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (/@|(?:\+?\d[\s().-]*){10,}|(?:https?:|blob:|data:)/i.test(text)) return '';
  return text.replace(/[<>\x00-\x1f]/g, '').slice(0, limit);
}

export function ga4PublicUrl(raw, base = 'https://groverygiftz.in', referrer = false) {
  try {
    if (typeof raw !== 'string' || !raw.trim()) return '';
    const url = new URL(raw, base);
    if (!['https:', 'http:'].includes(url.protocol)) return '';
    if (referrer && url.origin !== new URL(base).origin) return `${url.origin}/`;
    if (/@|(?:\d[\s()-]*){10,}/.test(decodeURIComponent(url.pathname))) return `${url.origin}/`;
    const safe = new URL(url.origin + url.pathname);
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'dclid', 'fbclid', 'msclkid', 'page', 'sort']) {
      const value = url.searchParams.get(key);
      const clean = ga4Text(value, key.endsWith('clid') ? 1800 : 100);
      if (clean) safe.searchParams.set(key, clean);
    }
    return safe.href;
  } catch { return ''; }
}

export function buildGA4Item(product, options = {}) {
  if (!product || typeof product !== 'object') return null;
  const id = String(product.productId || product.product?._id || product.product || product._id || '');
  const itemId = /^[a-zA-Z0-9_-]{1,100}$/.test(id) ? id : '';
  const name = ga4Text(product.title || product.item_name);
  if (!itemId && !name) return null;
  const quantity = Number(options.quantity ?? product.quantity ?? 1);
  if (!Number.isInteger(quantity) || quantity < 1) return null;
  const price = ga4Money(options.price ?? product.price ?? product.regularPrice);
  const item = { ...(itemId ? { item_id: itemId } : {}), ...(name ? { item_name: name } : {}), quantity };
  if (price !== null && !(product.isQuoteOnly && price === 0)) item.price = price;
  const variant = ga4Text(options.variant ?? product.variant);
  const category = ga4Text(product.collections?.[0]?.name || product.collections?.[0]?.title || product.category?.name || product.category);
  if (variant) item.item_variant = variant;
  if (category) item.item_category = category;
  const regular = ga4Money(product.regularPrice);
  if (regular !== null && price !== null && regular > price) item.discount = ga4Money(regular - price);
  if (options.listId) item.item_list_id = ga4Text(options.listId);
  if (options.listName) item.item_list_name = ga4Text(options.listName);
  if (Number.isInteger(options.index) && options.index >= 0) item.index = options.index;
  return item;
}

export function buildGA4Cart(items) {
  if (!Array.isArray(items) || !items.length || items.length > 200) return null;
  if (items.some((item) => !Number.isInteger(Number(item?.quantity)) || Number(item.quantity) < 1)) return null;
  const mapped = items.map((item) => buildGA4Item(item));
  if (mapped.some((item) => !item || item.price === undefined)) return null;
  return { currency: GA4_CURRENCY, value: ga4Money(mapped.reduce((sum, item) => sum + item.price * item.quantity, 0)), items: mapped };
}

export function buildGA4Purchase(order) {
  if (!order || order.paymentStatus !== 'paid' || !/^GG\d{4,}$/.test(order.orderNumber || '')) return null;
  const id = String(order._id || '');
  const total = ga4Money(order.total);
  const shipping = ga4Money(order.shippingCost);
  const eventTime = Math.floor(new Date(order.paidAt).getTime() / 1000);
  const cart = buildGA4Cart(order.items);
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id) || !cart || total === null || shipping === null || !Number.isFinite(eventTime) || eventTime <= 0) return null;
  // Google's merchandise value excludes shipping, unlike Meta's grand-total policy.
  if (Math.abs(cart.value + shipping - total) > 0.01) return null;
  return { eventTime, params: { ...cart, transaction_id: `${order.orderNumber}-${id}`, shipping } };
}

export function ga4SearchTerm(query, products = []) {
  const term = ga4Text(query);
  if (!term) return '';
  const words = (value) => String(value).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
  const catalog = new Set(products.flatMap((product) => words(product.title)));
  const tokens = words(term);
  return tokens.length && tokens.every((word) => catalog.has(word)) ? term : '';
}
