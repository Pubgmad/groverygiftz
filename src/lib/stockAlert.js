import { getProductAvailableStock, getSelectedAvailableStock, isProductSoldOut } from '@/lib/stock';

/**
 * Separate urgency alert — only when inventory is low (not a replacement for the original stock display).
 */
export function resolveLowStockAlert(product, selectedOptions = [], stockAlert) {
  const config = stockAlert ?? product?.stockAlert ?? {};
  if (config.enabled === false) return null;

  if (isProductSoldOut(product)) return null;

  const available = selectedOptions?.length
    ? getSelectedAvailableStock(product, selectedOptions)
    : getProductAvailableStock(product);

  if (!(available > 0)) return null;

  const threshold = Math.max(1, Number(config.lowStockThreshold) > 0 ? Number(config.lowStockThreshold) : 5);
  if (available > threshold) return null;

  const template = String(config.lowStockLabel || '').trim() || 'Hurry! Only {count} left in stock';
  return {
    quantity: available,
    label: template.replace(/\{count\}/gi, String(available)),
  };
}
