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
  // Large refresh swing so reload visibly changes the number
  const swing = Math.max(120, Math.floor(span * 0.35));
  const jitter = Math.floor(Math.random() * (swing * 2 + 1)) - swing;
  // Extra full-range noise so slow refreshes also jump
  const noise = Math.floor(Math.random() * Math.max(60, Math.floor(span * 0.15))) - Math.floor(span * 0.075);
  return Math.min(max, Math.max(min, base + jitter + noise));
}

/** Live tick delta — often larger for a fast-moving feel. */
export function nudgeInterestEstimate(current, config = {}, intensity = 'fast') {
  const { min, max } = getInterestBounds(config);
  let magnitude;
  if (intensity === 'burst') magnitude = 8 + Math.floor(Math.random() * 18); // 8–25
  else if (intensity === 'slow') magnitude = 1 + Math.floor(Math.random() * 3); // 1–3
  else magnitude = 3 + Math.floor(Math.random() * 8); // 3–10

  const sign = Math.random() < 0.55 ? 1 : -1;
  const next = Number(current) + sign * magnitude;
  return Math.min(max, Math.max(min, next));
}

export function formatInterestLabel(count, config = {}) {
  const template = String(config.labelTemplate || '').trim()
    || '{count} live product views';
  return template.replace(/\{count\}/gi, String(count));
}

/** Pick next pace mode for fluctuating animation speed. */
export function nextInterestPace() {
  const roll = Math.random();
  if (roll < 0.45) {
    return { mode: 'burst', delayMs: 35 + Math.floor(Math.random() * 45) }; // very fast
  }
  if (roll < 0.75) {
    return { mode: 'fast', delayMs: 90 + Math.floor(Math.random() * 90) };
  }
  return { mode: 'slow', delayMs: 450 + Math.floor(Math.random() * 550) }; // sometimes slow
}
