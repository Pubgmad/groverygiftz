/**
 * Live-style product interest count helpers.
 * Each product has a preferred band; refreshes and live ticks vary within min–max.
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

/** Stable per-product center within [min, max]. */
export function getProductInterestBase(productId, config = {}) {
  const { min, max } = getInterestBounds(config);
  const span = max - min;
  const seed = hashProductSeed(productId);
  return min + (seed % (span + 1));
}

/**
 * Fresh value on page/tab refresh — clearly different each load,
 * still biased toward the product's base so products stay distinct.
 */
export function generateProductInterestEstimate(productId, config = {}) {
  const { min, max } = getInterestBounds(config);
  const base = getProductInterestBase(productId, config);
  const span = max - min;
  const swing = Math.max(80, Math.floor(span * 0.28));
  const jitter = Math.floor(Math.random() * (swing * 2 + 1)) - swing;
  return Math.min(max, Math.max(min, base + jitter));
}

/** Gentle live tick — small natural changes. */
export function nudgeInterestEstimate(current, config = {}, intensity = 'normal') {
  const { min, max } = getInterestBounds(config);
  let magnitude;
  if (intensity === 'quicker') magnitude = 1 + Math.floor(Math.random() * 3); // 1–3
  else if (intensity === 'slow') magnitude = 1; // ±1
  else magnitude = 1 + Math.floor(Math.random() * 2); // 1–2

  const sign = Math.random() < 0.52 ? 1 : -1;
  const next = Number(current) + sign * magnitude;
  return Math.min(max, Math.max(min, next));
}

export function formatInterestLabel(count, config = {}) {
  const template = String(config.labelTemplate || '').trim()
    || '{count} live product views';
  return template.replace(/\{count\}/gi, String(count));
}

/** Natural fluctuating pace — mostly calm, occasionally a bit quicker. */
export function nextInterestPace() {
  const roll = Math.random();
  if (roll < 0.25) {
    return { mode: 'quicker', delayMs: 1800 + Math.floor(Math.random() * 1400) }; // ~1.8–3.2s
  }
  if (roll < 0.7) {
    return { mode: 'normal', delayMs: 3200 + Math.floor(Math.random() * 2800) }; // ~3.2–6s
  }
  return { mode: 'slow', delayMs: 5500 + Math.floor(Math.random() * 4500) }; // ~5.5–10s
}
