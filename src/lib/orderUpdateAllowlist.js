/** Allowed fields for PUT /api/orders/[id] — never accept raw body. */
export const ORDER_PUT_ALLOWED_KEYS = ['status', 'trackingNumber', 'trackingUrl', 'courierCompany'];
export const ORDER_PUT_ALLOWED_FIELDS = new Set(ORDER_PUT_ALLOWED_KEYS);

export const ORDER_PUT_STATUSES = ['ordered', 'on_process', 'dispatched', 'cancelled'];

export const ORDER_PUT_STATUS_ALIASES = {
  pending: 'ordered',
  processing: 'on_process',
  shipped: 'dispatched',
  delivered: 'dispatched',
};

export function normalizeOrderStatusForPut(status) {
  const raw = String(status || '');
  if (ORDER_PUT_STATUS_ALIASES[raw]) return ORDER_PUT_STATUS_ALIASES[raw];
  return raw;
}

/**
 * Validate and pick only allowlisted order update fields.
 * @returns {{ ok: true, patch: object, trackingTouched: boolean } | { ok: false, error: string }}
 */
export function parseOrderPutAllowlist(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, error: 'Invalid body' };
  }
  const keys = Object.keys(body);
  const rejected = keys.filter((k) => !ORDER_PUT_ALLOWED_FIELDS.has(k));
  if (rejected.length) {
    return { ok: false, error: `Field(s) not allowed: ${rejected.join(', ')}` };
  }
  if (!keys.length) {
    return { ok: false, error: 'No updatable fields provided' };
  }

  const patch = {};
  let trackingTouched = false;
  if (body.status !== undefined) {
    const normalized = normalizeOrderStatusForPut(String(body.status));
    if (!ORDER_PUT_STATUSES.includes(normalized)) {
      return { ok: false, error: 'Invalid status' };
    }
    patch.status = normalized;
  }
  if (body.trackingNumber !== undefined) {
    patch.trackingNumber = String(body.trackingNumber || '').trim();
    trackingTouched = true;
  }
  if (body.trackingUrl !== undefined) {
    patch.trackingUrl = String(body.trackingUrl || '').trim();
    trackingTouched = true;
  }
  if (body.courierCompany !== undefined) {
    patch.courierCompany = String(body.courierCompany || '').trim();
  }
  if (trackingTouched) {
    patch.trackingUpdatedAt = new Date();
  }
  return { ok: true, patch, trackingTouched };
}

/** @deprecated alias */
export function pickAllowedOrderPut(body) {
  return parseOrderPutAllowlist(body);
}
