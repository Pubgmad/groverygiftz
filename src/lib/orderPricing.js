import { getEffectivePrice } from '@/lib/utils';
import { findSelectedVariantOptions } from '@/lib/stock';

export function assertOrderPricing(items, productsById) {
  for (const item of items) {
    const product = productsById[String(item.productId || item.product || '')];
    const options = findSelectedVariantOptions(product, item.variant).map(({ option }) => option);
    const ownPrice = options.find((option) => option.useOwnPrice && Number(option.regularPrice) > 0);
    const regular = Number(ownPrice?.regularPrice || 0);
    const sale = Number(ownPrice?.salePrice || 0);
    // Match ProductDetail's existing selected-variant and gift-pack pricing rules.
    const base = ownPrice ? (sale > 0 && sale < regular ? sale : regular) : getEffectivePrice(product);
    const extras = options.reduce((sum, option) => sum + (option.useOwnPrice ? 0 : Number(option.priceAdjustment ?? option.price ?? 0)), 0);
    const wrapping = item.giftWrap && product?.giftWrap?.enabled ? Number(product.giftWrap.price || 0) : 0;
    const expected = base + extras + wrapping;
    const supplied = Number(item.price);
    if (!product || !Number.isInteger(item.quantity) || item.quantity < 1 || !Number.isFinite(supplied) || supplied < 0 || !Number.isFinite(expected) || expected < 0 || Math.abs(expected - supplied) > 0.01) {
      const error = new Error('Product pricing has changed or is invalid. Please review your cart before paying.');
      error.name = 'OrderPricingError';
      error.status = 409;
      throw error;
    }
  }
}
