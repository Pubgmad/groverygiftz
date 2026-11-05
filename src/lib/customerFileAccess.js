import { createHmac, timingSafeEqual } from 'crypto';

const DISPLAY_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days — covers guest carts through checkout

function signingSecret() {
  const secret = String(process.env.NEXTAUTH_SECRET || process.env.CUSTOMER_UPLOAD_SIGNING_SECRET || '').trim();
  if (!secret && process.env.NODE_ENV !== 'test') {
    // Warn operators — without a secret, display URLs cannot be signed and guest
    // customers will receive 401 when the editor tries to load their just-uploaded photo.
    // Set NEXTAUTH_SECRET (or CUSTOMER_UPLOAD_SIGNING_SECRET) in your production .env.
    console.warn('[customerFileAccess] NEXTAUTH_SECRET is not set. Customer file display URLs will not be signed and guest access will be denied. Set NEXTAUTH_SECRET in production.');
  }
  return secret;
}

function encodePath(relativePath = '') {
  return String(relativePath || '')
    .split('/')
    .filter(Boolean)
    .map(encodeURIComponent)
    .join('/');
}

function normalizeRelativePath(relativePath = '') {
  return String(relativePath || '')
    .split('/')
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    })
    .filter(Boolean)
    .join('/');
}

function signPayload(relativePath, exp) {
  const secret = signingSecret();
  if (!secret) return '';
  return createHmac('sha256', secret)
    .update(`${normalizeRelativePath(relativePath)}.${exp}`)
    .digest('base64url');
}

export function buildCustomerDisplayUrl(relativePath, { ttlSeconds = DISPLAY_TTL_SECONDS } = {}) {
  const path = normalizeRelativePath(relativePath);
  if (!path.startsWith('customizations/')) return '';
  const encoded = encodePath(path);
  const base = `/api/customization-upload/customer-file/${encoded}`;
  const secret = signingSecret();
  if (!secret) return base;
  const exp = Math.floor(Date.now() / 1000) + Math.max(60, Number(ttlSeconds) || DISPLAY_TTL_SECONDS);
  const sig = signPayload(path, exp);
  if (!sig) return base;
  return `${base}?exp=${exp}&sig=${sig}`;
}

export function verifyCustomerDisplayAccess(relativePath, searchParams) {
  const path = normalizeRelativePath(relativePath);
  if (!path.startsWith('customizations/')) return false;
  const secret = signingSecret();
  if (!secret) return false;
  const exp = Number(searchParams?.get?.('exp') || searchParams?.exp || 0);
  const sig = String(searchParams?.get?.('sig') || searchParams?.sig || '');
  if (!Number.isFinite(exp) || exp <= 0 || !sig) return false;
  if (exp < Math.floor(Date.now() / 1000)) return false;
  const expected = signPayload(path, exp);
  if (!expected) return false;
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function extractCustomizationPathFromUrl(url = '') {
  const raw = String(url || '');
  const markers = [
    '/api/customization-upload/customer-file/',
    '/api/customization-upload/original-file/',
  ];
  for (const marker of markers) {
    const index = raw.indexOf(marker);
    if (index === -1) continue;
    const encodedPath = raw.slice(index + marker.length).split('?')[0];
    if (!encodedPath) continue;
    return normalizeRelativePath(encodedPath);
  }
  const mediaMarker = '/media/customizations/';
  const mediaIndex = raw.indexOf(mediaMarker);
  if (mediaIndex !== -1) {
    const rest = raw.slice(mediaIndex + mediaMarker.length).split('?')[0];
    if (rest) return normalizeRelativePath(`customizations/${rest}`);
  }
  if (raw.startsWith('customizations/')) return normalizeRelativePath(raw);
  return '';
}

/**
 * Prefer JPEG/PNG preview path for HEIC/HEIF originals so <img> works in Chrome/Firefox.
 * Falls back to original storagePath, then any path parsed from existing URLs.
 */
export function resolveCustomerDisplayPath(asset = {}) {
  const previewPath = normalizeRelativePath(asset?.previewStoragePath || '');
  if (previewPath.startsWith('customizations/')) return previewPath;

  const storagePath = normalizeRelativePath(asset?.storagePath || '');
  // Prefer non-HEIC storage when preview path is missing but URL already points at a preview.
  const fromDisplay = extractCustomizationPathFromUrl(asset?.displayUrl || '');
  if (fromDisplay.startsWith('customizations/previews/')) return fromDisplay;
  if (storagePath.startsWith('customizations/')) return storagePath;

  const fromUrl = extractCustomizationPathFromUrl(asset?.displayUrl || asset?.url || asset?.originalUrl || '');
  return fromUrl.startsWith('customizations/') ? fromUrl : '';
}

export function resignCustomerDisplayUrls(value) {
  if (Array.isArray(value)) return value.map(resignCustomerDisplayUrls);
  if (!value || typeof value !== 'object') return value;

  const next = Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, resignCustomerDisplayUrls(entry)])
  );

  const path = resolveCustomerDisplayPath(next);
  if (path.startsWith('customizations/')) {
    next.displayUrl = buildCustomerDisplayUrl(path);
  }
  return next;
}
