import { getProductAvailableStock, getSelectedAvailableStock, hasVariantManagedStock, isProductSoldOut } from '@/lib/stock';

export function resolveStockAlertState(product, selectedOptions = [], stockAlert) {
  const config = stockAlert ?? product?.stockAlert ?? {};
  if (config.enabled === false) return null;

  const soldOut = isProductSoldOut(product);
  const variantManaged = hasVariantManagedStock(product);
  const available = selectedOptions?.length
    ? getSelectedAvailableStock(product, selectedOptions)
    : getProductAvailableStock(product);

  // No inventory signal configured / nothing meaningful to show
  if (!soldOut && !variantManaged && !(Number(product?.stock) > 0) && available <= 0) {
    return null;
  }

  const threshold = Math.max(1, Number(config.lowStockThreshold) > 0 ? Number(config.lowStockThreshold) : 5);

  if (soldOut || available <= 0) {
    return {
      tone: 'out',
      quantity: 0,
      label: String(config.outOfStockLabel || '').trim() || 'Out of stock',
      showQuantity: false,
    };
  }

  if (available <= threshold) {
    const template = String(config.lowStockLabel || '').trim() || 'Only {count} left in stock!';
    return {
      tone: 'low',
      quantity: available,
      label: template.replace(/\{count\}/gi, String(available)),
      showQuantity: true,
    };
  }

  if (config.showInStock === false) return null;

  const inStockLabel = String(config.inStockLabel || '').trim() || 'In stock';
  return {
    tone: 'ok',
    quantity: available,
    label: inStockLabel,
    showQuantity: false,
    variantManaged,
  };
}
