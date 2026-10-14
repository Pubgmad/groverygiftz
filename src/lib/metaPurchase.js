// Cashfree order creation stores INR amounts in rupees, including shipping.
export const PURCHASE_CURRENCY = 'INR';

export function purchaseAmount(value) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !/^\d+(?:\.\d+)?$/.test(value.trim())) return null;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

export function buildMetaPurchase(order) {
  if (order?.paymentStatus !== 'paid' || !/^GG\d{4,}$/.test(String(order.orderNumber || ''))) return null;
  const value = purchaseAmount(order.total);
  const paidAt = order.paidAt ? new Date(order.paidAt).getTime() : NaN;
  if (value === null || !Number.isFinite(paidAt)) return null;
  if (order.currency && order.currency !== PURCHASE_CURRENCY) return null;
  const identity = String(order._id || '').trim();
  // Keep identifiers already sent to Meta; new orders use the immutable database ID.
  const eventId = String(order.metaConversionPurchaseEventId || (identity ? `purchase-${identity}` : '')).trim();
  if (!eventId) return null;
  const contents = (order.items || []).map((item) => ({
    id: String(item.product?._id || item.product || item.productId || '').trim(),
    quantity: Number(item.quantity),
    item_price: purchaseAmount(item.price),
  })).filter((item) => item.id && Number.isInteger(item.quantity) && item.quantity > 0 && item.item_price !== null);
  return {
    eventId,
    eventTime: Math.floor(paidAt / 1000),
    params: {
      value,
      currency: PURCHASE_CURRENCY,
      order_id: order.orderNumber,
      content_type: 'product',
      content_ids: contents.map((item) => item.id),
      contents,
      num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
    },
  };
}

export function isValidMetaPurchase(event) {
  return Boolean(event && typeof event.eventId === 'string' && event.eventId.trim() &&
    typeof event.params?.value === 'number' && purchaseAmount(event.params.value) !== null &&
    event.params.currency === PURCHASE_CURRENCY && /^GG\d{4,}$/.test(String(event.params.order_id || '')));
}
