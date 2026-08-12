export function normalizeNow(now = Date.now()) {
  if (now instanceof Date) return now.getTime();
  const timestamp = typeof now === 'number' ? now : new Date(now).getTime();
  return Number.isNaN(timestamp) ? Date.now() : timestamp;
}

export function getOfferStatus(product, now = Date.now()) {
  const regularPrice = Number(product?.regularPrice || 0);
  const salePrice = Number(product?.salePrice || 0);
  if (!salePrice || salePrice >= regularPrice) return 'inactive';

  const current = normalizeNow(now);
  const startsAt = product?.offerStartsAt ? new Date(product.offerStartsAt).getTime() : null;
  const endsAt = product?.offerEndsAt ? new Date(product.offerEndsAt).getTime() : null;

  if (startsAt && !Number.isNaN(startsAt) && current < startsAt) return 'upcoming';
  if (endsAt && !Number.isNaN(endsAt) && current > endsAt) return 'expired';
  return 'active';
}

export function isOfferActive(product, now = Date.now()) {
  return getOfferStatus(product, now) === 'active';
}

export function activeOfferMatch(now = new Date(), { includeActive = false } = {}) {
  return {
    ...(includeActive ? { isActive: true } : {}),
    salePrice: { $gt: 0 },
    $and: [
      { $or: [{ offerStartsAt: { $exists: false } }, { offerStartsAt: null }, { offerStartsAt: { $lte: now } }] },
      { $or: [{ offerEndsAt: { $exists: false } }, { offerEndsAt: null }, { offerEndsAt: { $gte: now } }] },
    ],
    $expr: { $lt: ['$salePrice', '$regularPrice'] },
  };
}

export function activeOfferExpression(now = new Date()) {
  return {
    $and: [
      { $gt: ['$salePrice', 0] },
      { $lt: ['$salePrice', '$regularPrice'] },
      { $or: [{ $eq: [{ $ifNull: ['$offerStartsAt', null] }, null] }, { $lte: ['$offerStartsAt', now] }] },
      { $or: [{ $eq: [{ $ifNull: ['$offerEndsAt', null] }, null] }, { $gte: ['$offerEndsAt', now] }] },
    ],
  };
}

export function effectivePriceExpression(now = new Date()) {
  return {
    $cond: [
      activeOfferExpression(now),
      '$salePrice',
      '$regularPrice',
    ],
  };
}
