/**
 * Remove confirmed paid-order lines from a cart without touching unrelated lines.
 * Matching prefers cartItemId; unconfigured lines fall back to productId + variant.
 */

export function cartLineKey(item) {
  if (!item || typeof item !== 'object') return '';
  const cartItemId = String(item.cartItemId || '').trim();
  if (cartItemId) return `id:${cartItemId}`;
  const productId = String(item.productId || item.product || '').trim();
  if (!productId) return '';
  return `pv:${productId}:${String(item.variant || '')}`;
}

export function reconcileCartAgainstPurchasedItems(cart = [], purchasedItems = []) {
  const purchased = new Set((purchasedItems || []).map(cartLineKey).filter(Boolean));
  if (!purchased.size) return Array.isArray(cart) ? cart.slice() : [];
  return (Array.isArray(cart) ? cart : []).filter((item) => {
    const key = cartLineKey(item);
    return !key || !purchased.has(key);
  });
}
