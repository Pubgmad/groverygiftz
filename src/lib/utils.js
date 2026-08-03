export function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(Number(price) || 0);
}

export function isOfferActive(product, now = Date.now()) {
  if (!product?.salePrice || Number(product.salePrice) >= Number(product.regularPrice || 0)) return false;
  const startsAt = product.offerStartsAt ? new Date(product.offerStartsAt).getTime() : null;
  const endsAt = product.offerEndsAt ? new Date(product.offerEndsAt).getTime() : null;
  if (startsAt && !Number.isNaN(startsAt) && now < startsAt) return false;
  if (endsAt && !Number.isNaN(endsAt) && now > endsAt) return false;
  return true;
}

export function getEffectivePrice(product, now = Date.now()) {
  return isOfferActive(product, now) ? Number(product.salePrice) : Number(product?.regularPrice || 0);
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
