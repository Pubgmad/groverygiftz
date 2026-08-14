const normalizeStockKey = (value) => String(value || '').trim().toLowerCase();

export const hasOwnStock = (value) => value !== '' && value !== null && value !== undefined && Number.isFinite(Number(value));

export const optionHasOwnStock = (option) => hasOwnStock(option?.stock);

export function hasVariantManagedStock(product) {
  return (product?.variants || []).some((variant) =>
    (variant.options || []).some((option) => optionHasOwnStock(option))
  );
}

export function isVariantOptionSoldOut(product, option) {
  if (option?.inStock === false) return true;
  if (optionHasOwnStock(option)) return Number(option.stock) <= 0;
  return !hasVariantManagedStock(product) && Number(product?.stock || 0) <= 0;
}

export function isProductSoldOut(product) {
  if (hasVariantManagedStock(product)) {
    return !(product?.variants || []).some((variant) =>
      (variant.options || []).some((option) => !isVariantOptionSoldOut(product, option))
    );
  }
  return Number(product?.stock || 0) <= 0;
}

export function getVariantAvailableStock(product) {
  return (product?.variants || []).reduce((sum, variant) => (
    sum + (variant.options || []).reduce((optionSum, option) => (
      optionSum + (!isVariantOptionSoldOut(product, option) && optionHasOwnStock(option) ? Number(option.stock) : 0)
    ), 0)
  ), 0);
}

export function getProductAvailableStock(product) {
  return hasVariantManagedStock(product)
    ? getVariantAvailableStock(product)
    : Math.max(0, Number(product?.stock || 0));
}

export function getSelectedAvailableStock(product, selectedOptions = []) {
  const managedStocks = selectedOptions
    .filter((option) => optionHasOwnStock(option))
    .map((option) => Math.max(0, Number(option.stock || 0)));

  if (managedStocks.length > 0) return Math.min(...managedStocks);
  return Math.max(0, Number(product?.stock || 0));
}

export function parseVariantSelection(variantText = '') {
  return String(variantText || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((map, part) => {
      const separatorIndex = part.indexOf(':');
      if (separatorIndex === -1) return map;
      const name = normalizeStockKey(part.slice(0, separatorIndex));
      const label = normalizeStockKey(part.slice(separatorIndex + 1));
      if (name && label) map[name] = label;
      return map;
    }, {});
}

export function findSelectedVariantOptions(product, variantText = '') {
  const selections = parseVariantSelection(variantText);
  return (product?.variants || []).flatMap((variant) => {
    const selectedLabel = selections[normalizeStockKey(variant.name)];
    if (!selectedLabel) return [];
    const option = (variant.options || []).find((opt) => normalizeStockKey(opt?.label) === selectedLabel);
    return option ? [{ variant, option }] : [];
  });
}

