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

export function activeAdminOfferMatch(now = new Date(), { includeActive = false } = {}) {
  return {
    ...(includeActive ? { isActive: true } : {}),
    isOffer: true,
    offerStartsAt: { $exists: true, $ne: null, $lte: now },
    offerEndsAt: { $exists: true, $ne: null, $gte: now },
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

export function productPriceCandidatesExpression(now = new Date()) {
  const basePrice = effectivePriceExpression(now);
  const offerWindowActive = [
    { $or: [{ $eq: [{ $ifNull: ['$offerStartsAt', null] }, null] }, { $lte: ['$offerStartsAt', now] }] },
    { $or: [{ $eq: [{ $ifNull: ['$offerEndsAt', null] }, null] }, { $gte: ['$offerEndsAt', now] }] },
  ];
  const variantOptions = {
    $filter: {
      input: {
        $reduce: {
          input: { $ifNull: ['$variants', []] },
          initialValue: [],
          in: { $concatArrays: ['$$value', { $ifNull: ['$$this.options', []] }] },
        },
      },
      as: 'option',
      cond: {
        $and: [
          { $ne: ['$$option.inStock', false] },
          { $or: [{ $eq: [{ $ifNull: ['$$option.stock', null] }, null] }, { $gt: ['$$option.stock', 0] }] },
        ],
      },
    },
  };
  const variantPrices = {
    $map: {
      input: variantOptions,
      as: 'option',
      in: {
        $cond: [
          { $and: [{ $eq: ['$$option.useOwnPrice', true] }, { $gt: ['$$option.regularPrice', 0] }] },
          {
            $cond: [
              {
                $and: [
                  { $gt: ['$$option.salePrice', 0] },
                  { $lt: ['$$option.salePrice', '$$option.regularPrice'] },
                  ...offerWindowActive,
                ],
              },
              '$$option.salePrice',
              '$$option.regularPrice',
            ],
          },
          { $add: [basePrice, { $ifNull: ['$$option.priceAdjustment', { $ifNull: ['$$option.price', 0] }] }] },
        ],
      },
    },
  };

  return {
    $cond: [
      { $gt: [{ $size: variantPrices }, 0] },
      variantPrices,
      [basePrice],
    ],
  };
}

export function variantAwareEffectivePriceExpression(now = new Date()) {
  return { $min: productPriceCandidatesExpression(now) };
}

export function priceRangeMatchExpression(range, now = new Date()) {
  const checks = [{ $gte: ['$$candidatePrice', Number(range.min || 0)] }];
  if (range.max !== null && range.max !== undefined) checks.push({ $lte: ['$$candidatePrice', Number(range.max)] });
  return {
    $gt: [
      {
        $size: {
          $filter: {
            input: productPriceCandidatesExpression(now),
            as: 'candidatePrice',
            cond: { $and: checks },
          },
        },
      },
      0,
    ],
  };
}

