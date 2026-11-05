import { getProductAvailableStock, getSelectedAvailableStock, isProductSoldOut } from '@/lib/stock';

const DEFAULT_LOW = 5;
const DEFAULT_MEDIUM = 20;

function applyCount(template, count) {
  return String(template || '').replace(/\{count\}/gi, String(count));
}

function readThresholds(config = {}) {
  const low = Math.max(1, Number(config.lowStockThreshold) > 0 ? Number(config.lowStockThreshold) : DEFAULT_LOW);
  const mediumRaw = Number(config.mediumStockThreshold);
  const medium = Math.max(low + 1, Number.isFinite(mediumRaw) && mediumRaw > 0 ? mediumRaw : DEFAULT_MEDIUM);
  return { low, medium };
}

/**
 * Resolve display quantity from Admin inventory for the current selection.
 * Selected variant stock wins; otherwise product / variant-managed total.
 */
export function resolveDisplayStockQuantity(product, selectedOptions = []) {
  if (selectedOptions?.length) {
    return getSelectedAvailableStock(product, selectedOptions);
  }
  return getProductAvailableStock(product);
}

/**
 * Full stock availability indicator (high / medium / low / sold_out).
 * Quantities always come from Admin Panel inventory via existing stock helpers.
 */
export function resolveStockAvailabilityIndicator(product, selectedOptions = [], stockAlert) {
  const config = stockAlert ?? product?.stockAlert ?? {};
  if (config.enabled === false) return null;

  const quantity = resolveDisplayStockQuantity(product, selectedOptions);
  const productSoldOut = isProductSoldOut(product);
  const soldOut = productSoldOut || !(quantity > 0);

  if (soldOut) {
    return {
      level: 'sold_out',
      quantity: 0,
      label: String(config.soldOutLabel || '').trim() || 'Currently Sold Out',
      tone: 'neutral',
    };
  }

  const { low, medium } = readThresholds(config);

  if (quantity <= low) {
    const template = String(config.lowStockLabel || '').trim() || 'Hurry! Only {count} Left in Stock';
    return {
      level: 'low',
      quantity,
      label: applyCount(template, quantity),
      tone: 'danger',
    };
  }

  if (quantity <= medium) {
    const template = String(config.mediumStockLabel || '').trim() || 'Only {count} Left in Stock';
    return {
      level: 'medium',
      quantity,
      label: applyCount(template, quantity),
      tone: 'warning',
    };
  }

  const template = String(config.highStockLabel || '').trim() || 'In Stock — {count} Available';
  return {
    level: 'high',
    quantity,
    label: applyCount(template, quantity),
    tone: 'success',
  };
}

/**
 * Backward-compatible low-stock-only helper (used elsewhere if needed).
 */
export function resolveLowStockAlert(product, selectedOptions = [], stockAlert) {
  const indicator = resolveStockAvailabilityIndicator(product, selectedOptions, stockAlert);
  if (!indicator || indicator.level !== 'low') return null;
  return { quantity: indicator.quantity, label: indicator.label };
}
