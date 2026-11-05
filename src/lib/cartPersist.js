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
