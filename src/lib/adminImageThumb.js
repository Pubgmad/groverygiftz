/**
 * Admin display thumbs for customer-file URLs.
 * Client-safe URL helpers only — never import sharp from this file.
 */

const THUMB_MIN = 64;
const THUMB_MAX = 1280;
const DEFAULT_THUMB_WIDTH = 320;

export function boundedThumbWidth(width) {
  const n = Number(width);
  if (!Number.isFinite(n)) return DEFAULT_THUMB_WIDTH;
  return Math.min(THUMB_MAX, Math.max(THUMB_MIN, Math.round(n)));
}

export function withAdminThumbUrl(url, width = DEFAULT_THUMB_WIDTH) {
  const raw = String(url || '').trim();
  if (!raw) return '';
  if (raw.startsWith('data:') || raw.startsWith('blob:')) return raw;
  if (!raw.includes('/api/customization-upload/customer-file/')) return raw;
  if (/[?&]thumb=/.test(raw)) return raw;
  const w = boundedThumbWidth(width);
  return `${raw}${raw.includes('?') ? '&' : '?'}thumb=1&w=${w}`;
}
