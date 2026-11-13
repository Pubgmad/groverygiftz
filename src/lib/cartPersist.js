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

const GUEST_CART_KEY = 'groverygiftz-cart';

const readStorageJson = (storage) => {
  try {
    const saved = storage?.getItem?.(GUEST_CART_KEY);
    if (!saved) return null;
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeStorageJson = (storage, items) => {
  try {
    storage?.setItem?.(GUEST_CART_KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
};

const clearStorageKey = (storage) => {
  try { storage?.removeItem?.(GUEST_CART_KEY); } catch {}
};

export const isSameCartLine = (cartItem, productId, variant, cartItemId) => {
  if (cartItemId) return cartItem.cartItemId === cartItemId;
  return cartItem.productId === productId && cartItem.variant === variant && !cartItem.cartItemId;
};

const normalizeStockLimit = (value) => {
  const limit = Number(value);
  return Number.isFinite(limit) && limit >= 0 ? limit : null;
};

const capQuantity = (quantity, availableStock) => {
  const limit = normalizeStockLimit(availableStock);
  return limit === null ? quantity : Math.min(quantity, limit);
};

/** Merge account cart with guest/local lines without dropping unique configured items. */
export function mergeCartItems(accountCart = [], localCart = []) {
  const merged = Array.isArray(accountCart) ? [...accountCart] : [];
  (Array.isArray(localCart) ? localCart : []).forEach((item) => {
    const existingIndex = merged.findIndex((entry) => isSameCartLine(entry, item.productId, item.variant, item.cartItemId));
    if (existingIndex >= 0) {
      const existing = merged[existingIndex];
      const guestHasImages = cartItemHasConfiguredImages(item);
      const accountHasImages = cartItemHasConfiguredImages(existing);
      const sameConfiguredLine = Boolean(item.cartItemId && existing.cartItemId === item.cartItemId);
      const keepGuestConfig = guestHasImages && (!accountHasImages || sameConfiguredLine);
      merged[existingIndex] = {
        ...existing,
        ...(keepGuestConfig ? {
          customFields: item.customFields,
          collageUploads: item.collageUploads,
          customizationPreview: item.customizationPreview,
          giftWrap: item.giftWrap,
          giftMessage: item.giftMessage,
          cartItemId: item.cartItemId || existing.cartItemId,
        } : {}),
        quantity: capQuantity(
          sameConfiguredLine
            ? Math.max(Number(existing.quantity || 0), Number(item.quantity || 1))
            : Number(existing.quantity || 0) + Number(item.quantity || 1),
          existing.availableStock ?? item.availableStock
        ),
      };
      return;
    }
    merged.push({ ...item, quantity: capQuantity(Number(item.quantity || 1), item.availableStock) });
  });
  return merged;
}

export function persistGuestCart(items) {
  if (typeof window === 'undefined') return;
  const snapshot = stripDisplayOnlyPreviewData(items || []);
  writeStorageJson(window.localStorage, snapshot);
  writeStorageJson(window.sessionStorage, snapshot);
}

export function removeGuestCart() {
  if (typeof window === 'undefined') return;
  clearStorageKey(window.localStorage);
  clearStorageKey(window.sessionStorage);
}

export function readGuestCart() {
  if (typeof window === 'undefined') return [];
  const fromLocal = readStorageJson(window.localStorage);
  const fromSession = readStorageJson(window.sessionStorage);
  const localClean = Array.isArray(fromLocal) ? stripDisplayOnlyPreviewData(fromLocal) : [];
  const sessionClean = Array.isArray(fromSession) ? stripDisplayOnlyPreviewData(fromSession) : [];
  if (localClean.length) return localClean;
  if (sessionClean.length) return sessionClean;
  return [];
}

export function cartItemHasConfiguredImages(item) {
  if (!item || typeof item !== 'object') return false;
  const fields = item.customFields;
  if (fields && typeof fields === 'object') {
    for (const [label, value] of Object.entries(fields)) {
      if (label === 'Customer Photos' && Array.isArray(value) && value.some((entry) => entry?.url)) return true;
      if (label === 'Variant Label Uploads' && value && typeof value === 'object') {
        if (Object.values(value).some((entry) => entry?.url)) return true;
      }
      if (value && typeof value === 'object' && value.url) return true;
    }
  }
  if (Array.isArray(item.collageUploads) && item.collageUploads.some((g) => (g?.images || []).some((img) => img?.url))) {
    return true;
  }
  if (Array.isArray(item.customizationPreview?.previews) && item.customizationPreview.previews.length > 0) {
    return true;
  }
  return false;
}
