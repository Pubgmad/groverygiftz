/**
 * Lean product-card / listing projection.
 * Excludes preview3d, making videos, about copy, and other PDP-only blobs.
 */
export const PRODUCT_CARD_SELECT = [
  'title', 'slug', 'images', 'responsiveImages', 'regularPrice', 'salePrice',
  'stock', 'variants', 'isQuoteOnly', 'isOffer', 'offerStartsAt', 'offerEndsAt',
  'isBestSeller', 'isFeatured', 'isActive', 'customFields', 'giftWrap', 'giftMessage',
  'collections', 'createdAt',
].join(' ');

export const PRODUCT_CARD_PROJECT = {
  title: 1,
  slug: 1,
  images: 1,
  responsiveImages: 1,
  regularPrice: 1,
  salePrice: 1,
  stock: 1,
  variants: 1,
  isQuoteOnly: 1,
  isOffer: 1,
  offerStartsAt: 1,
  offerEndsAt: 1,
  isBestSeller: 1,
  isFeatured: 1,
  isActive: 1,
  customFields: 1,
  giftWrap: 1,
  giftMessage: 1,
  collections: 1,
  createdAt: 1,
};
