import mongoose from 'mongoose';
import {
  buildShippingLabelTrackUrl,
  createShippingLabelToken,
} from '@/lib/shippingLabelToken';
import { formatIstDateTime } from '@/lib/adminFilters';
import {
  MAX_SHIPPING_LABEL_ORDERS,
  normalizeShippingLabelLayout,
  pageCountForLabels,
} from '@/lib/shippingLabelLayout';

export {
  MAX_SHIPPING_LABEL_ORDERS,
  SHIPPING_LABEL_LAYOUTS,
  normalizeShippingLabelLayout,
  pageCountForLabels,
} from '@/lib/shippingLabelLayout';

const CANCELLED = new Set(['cancelled']);

function trimText(value) {
  return String(value || '').trim();
}

function digitsOnly(value) {
  return String(value || '').replace(/\D/g, '');
}

export function parseOrderObjectIds(ids = []) {
  const unique = [];
  const seen = new Set();
  for (const raw of ids) {
    const id = String(raw || '').trim();
    if (!id || seen.has(id)) continue;
    if (!mongoose.Types.ObjectId.isValid(id) || String(new mongoose.Types.ObjectId(id)) !== id) continue;
    seen.add(id);
    unique.push(new mongoose.Types.ObjectId(id));
    if (unique.length >= MAX_SHIPPING_LABEL_ORDERS) break;
  }
  return unique;
}

/** Required packing/shipping fields. Landmark/district are optional (not stored). */
export function validateOrderForShippingLabel(order) {
  const missing = [];
  if (!order) return { ok: false, missing: ['order'], reason: 'Order not found' };

  if (order.paymentStatus !== 'paid') {
    return { ok: false, missing: ['paymentStatus'], reason: 'Order is not paid' };
  }
  if (CANCELLED.has(String(order.status || '').toLowerCase())) {
    return { ok: false, missing: ['status'], reason: 'Cancelled orders cannot receive shipping labels' };
  }

  const address = order.shippingAddress || {};
  if (!trimText(address.fullName)) missing.push('recipient name');
  if (!trimText(address.line1)) missing.push('address line 1');
  if (!trimText(address.city)) missing.push('city');
  if (!trimText(address.state)) missing.push('state');
  if (!trimText(address.pincode)) missing.push('pincode');

  const phone = trimText(address.phone) || trimText(address.whatsappNumber);
  if (!phone || digitsOnly(phone).length < 10) missing.push('mobile number');

  const items = Array.isArray(order.items) ? order.items : [];
  if (!items.length) missing.push('order items');
  else if (items.some((item) => !trimText(item.title) || !(Number(item.quantity) > 0))) {
    missing.push('valid product quantities');
  }

  if (missing.length) {
    return {
      ok: false,
      missing,
      reason: `Missing required shipping fields: ${missing.join(', ')}`,
    };
  }
  return { ok: true, missing: [] };
}

function sanitizeItems(items = []) {
  return items.map((item) => ({
    title: trimText(item.title) || 'Product',
    quantity: Math.max(1, Number(item.quantity) || 1),
    variant: trimText(item.variant),
  }));
}

/** Strip every financial and sensitive field before label/PDF use. */
export function toShippingLabelOrder(order, { origin } = {}) {
  const address = order.shippingAddress || {};
  const token = createShippingLabelToken(order._id);
  const trackUrl = buildShippingLabelTrackUrl(token, origin);
  const phone = trimText(address.phone) || trimText(address.whatsappNumber);
  return {
    id: String(order._id),
    orderNumber: trimText(order.orderNumber),
    orderDateIst: formatIstDateTime(order.paidAt || order.createdAt),
    recipientName: trimText(address.fullName),
    phone,
    line1: trimText(address.line1),
    line2: trimText(address.line2),
    landmark: trimText(address.landmark),
    district: trimText(address.district),
    city: trimText(address.city),
    state: trimText(address.state),
    pincode: trimText(address.pincode),
    items: sanitizeItems(order.items),
    trackUrl,
    token,
  };
}

export function companyFromSettings(settings = {}) {
  return {
    siteName: trimText(settings.siteName) || trimText(settings.tradeName) || 'GroveryGiftz',
    tradeName: trimText(settings.tradeName) || trimText(settings.siteName) || 'GroveryGiftz',
    logoUrl: trimText(settings.desktopLogo) || trimText(settings.logo) || '',
    returnAddress: trimText(settings.address),
    phone: trimText(settings.phone),
    email: trimText(settings.email),
  };
}

export function buildShippingLabelPayload({
  orders = [],
  settings = {},
  layoutInput = 'four',
  origin = '',
  requestedIds = [],
} = {}) {
  const layout = normalizeShippingLabelLayout(layoutInput);
  const byId = new Map(orders.map((order) => [String(order._id), order]));
  const valid = [];
  const invalid = [];

  for (const id of requestedIds) {
    const key = String(id);
    const order = byId.get(key);
    if (!order) {
      invalid.push({ id: key, orderNumber: '', reason: 'Order not found', missing: ['order'] });
      continue;
    }
    const check = validateOrderForShippingLabel(order);
    if (!check.ok) {
      invalid.push({
        id: key,
        orderNumber: trimText(order.orderNumber),
        reason: check.reason,
        missing: check.missing,
      });
      continue;
    }
    valid.push(toShippingLabelOrder(order, { origin }));
  }

  return {
    layout,
    company: companyFromSettings(settings),
    valid,
    invalid,
    pageCount: pageCountForLabels(valid.length, layout),
    maxOrders: MAX_SHIPPING_LABEL_ORDERS,
  };
}
