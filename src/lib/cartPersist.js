/**
 * Cart / order persistence helpers.
 * Never store ephemeral browser URLs (blob:/data:) or display-only preview fields.
 */

const EPHEMERAL_KEYS = new Set(['previewUrl', 'finalPreviewDataUrl']);

export function isEphemeralMediaUrl(value = '') {
  const raw = String(value || '').trim();
  return raw.startsWith('blob:') || raw.startsWith('data:');
}

/** Durable photo/file fields safe to put in cart JSON / Mongo. */
export function durableUploadRef(photo) {
  if (!photo || typeof photo !== 'object') return null;
  if (!photo.url || isEphemeralMediaUrl(photo.url)) return null;
  const ref = {
    name: photo.name || '',
    type: photo.type || '',
    size: Number(photo.size || 0) || undefined,
    url: photo.url,
    originalUrl: photo.originalUrl || photo.url,
    displayUrl: isEphemeralMediaUrl(photo.displayUrl) ? '' : (photo.displayUrl || ''),
    storagePath: photo.storagePath || '',
    previewStoragePath: photo.previewStoragePath || '',
  };
  if (photo.width) ref.width = photo.width;
  if (photo.height) ref.height = photo.height;
  if (photo.label) ref.label = photo.label;
  if (photo.previewType) ref.previewType = photo.previewType;
  return ref;
}

/**
 * Deep-clean cart/order payloads before localStorage or Mongo writes.
 * Drops previewUrl / finalPreviewDataUrl and any blob:/data: string values.
 */
export function stripDisplayOnlyPreviewData(value) {
  if (Array.isArray(value)) return value.map(stripDisplayOnlyPreviewData);
  if (typeof value === 'string') return isEphemeralMediaUrl(value) ? '' : value;
  if (!value || typeof value !== 'object') return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !EPHEMERAL_KEYS.has(key))
      .flatMap(([key, entry]) => {
        if (typeof entry === 'string' && isEphemeralMediaUrl(entry)) return [];
        return [[key, stripDisplayOnlyPreviewData(entry)]];
      })
  );
}

export function isSameCartLine(cartItem, productId, variant, cartItemId) {
  if (cartItemId) return cartItem.cartItemId === cartItemId;
  return cartItem.productId === productId && cartItem.variant === variant && !cartItem.cartItemId;
}

function hasDurableAsset(entry) {
  if (!entry || typeof entry !== 'object') return false;
  if (entry.storagePath || entry.previewStoragePath) return true;
  return [entry.url, entry.displayUrl, entry.originalUrl].some((value) => value && !isEphemeralMediaUrl(value));
}

export function cartItemHasConfiguredImages(item) {
  if (!item || typeof item !== 'object') return false;
  const fields = item.customFields;
  if (fields && typeof fields === 'object') {
    for (const [label, value] of Object.entries(fields)) {
      if (label === 'Customer Photos' && Array.isArray(value) && value.some(hasDurableAsset)) return true;
      if (label === 'Variant Label Uploads' && value && typeof value === 'object') {
        if (Object.values(value).some(hasDurableAsset)) return true;
      }
      if (hasDurableAsset(value)) return true;
    }
  }
  if (Array.isArray(item.collageUploads) && item.collageUploads.some((g) => (g?.images || []).some(hasDurableAsset))) {
    return true;
  }
  if (Array.isArray(item.customizationPreview?.previews) && item.customizationPreview.previews.some((preview) => (
    hasDurableAsset(preview)
    || hasDurableAsset(preview?.uploadedFile)
    || hasDurableAsset(preview?.finalPreviewImage)
  ))) {
    return true;
  }
  return false;
}

const capMergedQuantity = (quantity, availableStock) => {
  const limit = Number(availableStock);
  if (!Number.isFinite(limit) || limit < 0) return quantity;
  return Math.min(quantity, limit);
};

/**
 * Merge guest localStorage cart into the account cart on sign-in.
 * Guest customization wins when the guest line has durable images.
 * Does not drop unique customized lines.
 */
export function mergeGuestCartIntoAccount(accountCart = [], localCart = []) {
  const merged = [...accountCart];
  localCart.forEach((item) => {
    let existingIndex = !item.cartItemId
      ? merged.findIndex((entry) => isSameCartLine(entry, item.productId, item.variant))
      : -1;
    if (existingIndex < 0) {
      existingIndex = merged.findIndex((entry) => (
        entry.productId === item.productId
        && entry.variant === item.variant
        && !cartItemHasConfiguredImages(entry)
      ));
    }
    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      const guestHasImages = cartItemHasConfiguredImages(item);
      merged[existingIndex] = {
        ...existing,
        ...(guestHasImages ? {
          customFields: item.customFields,
          collageUploads: item.collageUploads,
          customizationPreview: item.customizationPreview,
          giftWrap: item.giftWrap,
          giftMessage: item.giftMessage,
          cartItemId: item.cartItemId || existing.cartItemId,
        } : {}),
        quantity: capMergedQuantity(
          Number(existing.quantity || 0) + Number(item.quantity || 1),
          existing.availableStock ?? item.availableStock,
        ),
      };
      return;
    }
    merged.push({
      ...item,
      quantity: capMergedQuantity(Number(item.quantity || 1), item.availableStock),
    });
  });
  return merged;
}
