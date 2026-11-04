import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_PREFIX = 'dp';
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function signingSecret() {
  return String(process.env.NEXTAUTH_SECRET || process.env.DESIGN_PREVIEW_TOKEN_SECRET || '').trim();
}

function sign(payload) {
  const secret = signingSecret();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`${TOKEN_PREFIX}:${payload}`)
    .digest('base64url')
    .slice(0, 28);
}

/** Token: orderId.version.exp.sig */
export function createDesignPreviewToken(orderId, version, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const id = String(orderId || '').trim();
  const ver = String(Number(version) || 0);
  if (!id || !ver || ver === '0') return '';
  const exp = String(Date.now() + Math.max(60_000, ttlMs));
  const payload = `${id}.${ver}.${exp}`;
  const sig = sign(payload);
  if (!sig) return '';
  return `${payload}.${sig}`;
}

export function verifyDesignPreviewToken(token = '') {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 4) return null;
  const [orderId, version, exp, sig] = parts;
  if (!orderId || !version || !exp || !sig) return null;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return null;
  const expected = sign(`${orderId}.${version}.${exp}`);
  if (!expected) return null;
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { orderId, version: Number(version), exp: expMs };
  } catch {
    return null;
  }
}

export function buildDesignPreviewPath(token) {
  if (!token) return '';
  return `/design/${encodeURIComponent(token)}`;
}

export function buildDesignPreviewUrl(token, origin = '') {
  const path = buildDesignPreviewPath(token);
  if (!path) return '';
  const base = String(origin || process.env.NEXTAUTH_URL || 'https://groverygiftz.in').replace(/\/$/, '');
  return `${base}${path}`;
}

export function buildWhatsAppShareUrl(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message || '')}`;
}
