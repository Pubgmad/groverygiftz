import { getOfferStatus, isOfferActive as checkOfferActive } from './offers';
export { getOfferStatus };

export function isOfferActive(product, now = Date.now()) {
  return checkOfferActive(product, now);
}

export function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(price) || 0);
}

export function getEffectivePrice(product, now = Date.now()) {
  return isOfferActive(product, now) ? Number(product.salePrice) : Number(product?.regularPrice || 0);
}

export function getVariantRegularPrice(option) {
  return Number(option?.regularPrice || 0);
}

export function getVariantSalePrice(option) {
  return Number(option?.salePrice || 0);
}

export function getVariantEffectivePrice(option, product = null, now = Date.now()) {
  const regular = getVariantRegularPrice(option);
  const sale = getVariantSalePrice(option);
  if (!(sale > 0 && sale < regular)) return regular;
  const hasOfferWindow = !!(product?.offerStartsAt || product?.offerEndsAt);
  return !hasOfferWindow || isOfferActive({ ...product, regularPrice: regular, salePrice: sale }, now) ? sale : regular;
}

export function getFirstPricedVariantOption(product) {
  return product?.variants
    ?.flatMap((variant) => variant.options || [])
    ?.find((option) => option?.useOwnPrice && getVariantRegularPrice(option) > 0 && option.inStock !== false);
}

export function getDisplayPrice(product, now = Date.now()) {
  const variantOption = getFirstPricedVariantOption(product);
  return variantOption ? getVariantEffectivePrice(variantOption, product, now) : getEffectivePrice(product, now);
}

export function getDisplayRegularPrice(product) {
  const variantOption = getFirstPricedVariantOption(product);
  return variantOption ? getVariantRegularPrice(variantOption) : Number(product?.regularPrice || 0);
}
export function calcSavings(regular, sale) {
  return Math.max(0, Number(regular || 0) - Number(sale || 0));
}

export function slugify(text) {
  return text.toString().toLowerCase().trim()
    .replace(/\s+/g, '-').replace(/[^\w-]+/g, '').replace(/--+/g, '-');
}

export function truncate(str, len = 100) {
  if (!str) return '';
  return str.length > len ? str.substring(0, len) + '...' : str;
}
