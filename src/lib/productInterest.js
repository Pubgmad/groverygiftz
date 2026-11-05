/**
 * Promotional product-interest estimate (not verified live analytics).
 * Each product gets a stable base from its id; page loads add a small jitter.
 */

const DEFAULT_MIN = 250;
const DEFAULT_MAX = 1000;

function hashProductSeed(productId = '') {
  const text = String(productId || 'product');
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

export function getInterestBounds(config = {}) {
  const minRaw = Number(config.minViews);
  const maxRaw = Number(config.maxViews);
  const min = Number.isFinite(minRaw) && minRaw > 0 ? Math.floor(minRaw) : DEFAULT_MIN;
  const max = Number.isFinite(maxRaw) && maxRaw > min ? Math.floor(maxRaw) : Math.max(min + 1, DEFAULT_MAX);
  return { min, max };
}

/** Stable per-product base within [min, max]. */
export function getProductInterestBase(productId, config = {}) {
  const { min, max } = getInterestBounds(config);
  const span = max - min;
  const seed = hashProductSeed(productId);
  return min + (seed % (span + 1));
}

/** Refresh-time estimate: product base + small random jitter, clamped. */
export function generateProductInterestEstimate(productId, config = {}) {
  const { min, max } = getInterestBounds(config);
  const base = getProductInterestBase(productId, config);
  const jitterSpan = Math.min(80, Math.max(20, Math.floor((max - min) * 0.08)));
  const jitter = Math.floor(Math.random() * (jitterSpan * 2 + 1)) - jitterSpan;
  return Math.min(max, Math.max(min, base + jitter));
}

/** Soft live-style nudge while viewing the page. */
export function nudgeInterestEstimate(current, config = {}) {
  const { min, max } = getInterestBounds(config);
  const delta = Math.floor(Math.random() * 9) - 4; // -4..+4
  if (delta === 0) return current;
  return Math.min(max, Math.max(min, Number(current) + delta));
}

export function formatInterestLabel(count, config = {}) {
  const template = String(config.labelTemplate || '').trim()
    || '{count} live product views';
  return template.replace(/\{count\}/gi, String(count));
}
