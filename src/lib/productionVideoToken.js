import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_PREFIX = 'pv';
const DEFAULT_TTL_MS = 14 * 24 * 60 * 60 * 1000;

function signingSecret() {
  return String(process.env.NEXTAUTH_SECRET || process.env.PRODUCTION_VIDEO_TOKEN_SECRET || '').trim();
}

function encodePath(relativePath = '') {
  return Buffer.from(String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, ''), 'utf8').toString('base64url');
}

function decodePath(encoded = '') {
  try {
    return Buffer.from(String(encoded || ''), 'base64url').toString('utf8');
  } catch {
    return '';
  }
}

function sign(payload) {
  const secret = signingSecret();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`${TOKEN_PREFIX}:${payload}`)
    .digest('base64url')
    .slice(0, 28);
}

/** Token: pathB64.exp.sig — scoped to a production-videos relative path. */
export function createProductionVideoShareToken(relativePath, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const clean = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '').trim();
  if (!clean || !clean.startsWith('production-videos/')) return '';
  const pathB64 = encodePath(clean);
  const exp = String(Date.now() + Math.max(60_000, ttlMs));
  const payload = `${pathB64}.${exp}`;
  const sig = sign(payload);
  if (!sig) return '';
  return `${payload}.${sig}`;
}

export function verifyProductionVideoShareToken(token = '') {
  const raw = String(token || '').trim();
  const parts = raw.split('.');
  if (parts.length !== 3) return null;
  const [pathB64, exp, sig] = parts;
  if (!pathB64 || !exp || !sig) return null;
  const expMs = Number(exp);
  if (!Number.isFinite(expMs) || expMs < Date.now()) return null;
  const expected = sign(`${pathB64}.${exp}`);
  if (!expected) return null;
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const relativePath = decodePath(pathB64);
    if (!relativePath || !relativePath.startsWith('production-videos/')) return null;
    return { relativePath, exp: expMs };
  } catch {
    return null;
  }
}

export function buildProductionVideoShareUrl(relativePath, origin = '') {
  const token = createProductionVideoShareToken(relativePath);
  if (!token) return '';
  const clean = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const path = `/media/${clean}?share=${encodeURIComponent(token)}`;
  const base = String(origin || process.env.NEXTAUTH_URL || 'https://groverygiftz.in').replace(/\/$/, '');
  return `${base}${path}`;
}

export function buildWhatsAppVideoShareUrl(phone, message) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message || '')}`;
}
