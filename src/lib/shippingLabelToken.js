import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_PREFIX = 'sl';

function signingSecret() {
  return String(process.env.NEXTAUTH_SECRET || process.env.SHIPPING_LABEL_TOKEN_SECRET || '').trim();
}

function signOrderId(orderId) {
  const secret = signingSecret();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`${TOKEN_PREFIX}:${String(orderId)}`)
    .digest('base64url')
    .slice(0, 24);
}

/** Unguessable tracking token — no address/phone/price payload. */
export function createShippingLabelToken(orderId) {
  const id = String(orderId || '').trim();
  if (!id) return '';
  const sig = signOrderId(id);
  if (!sig) return '';
  return `${id}.${sig}`;
}

export function verifyShippingLabelToken(token = '') {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 2) return null;
  const [orderId, sig] = parts;
  if (!orderId || !sig) return null;
  const expected = signOrderId(orderId);
  if (!expected) return null;
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return orderId;
  } catch {
    return null;
  }
}

export function buildShippingLabelTrackPath(token) {
  if (!token) return '';
  return `/track/label/${encodeURIComponent(token)}`;
}

export function buildShippingLabelTrackUrl(token, origin = '') {
  const path = buildShippingLabelTrackPath(token);
  if (!path) return '';
  const base = String(origin || process.env.NEXTAUTH_URL || 'https://groverygiftz.in').replace(/\/$/, '');
  return `${base}${path}`;
}
