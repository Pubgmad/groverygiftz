/**
 * WhatsApp Customized Combo — sizes come from a configured Website product's variants.
 * Prefer Settings.whatsappComboProductId; fall back to the historical title match.
 * Does NOT mutate product documents or invent sizes.
 */

export const COMBO_SOURCE_PRODUCT_TITLE_RX = /personal+i[sz]ed\s+single\s+photo\s+frame.*matte\s+finish/i;

/** Normalize size labels for comparison (× vs x, spaces). */
export function normalizeSizeLabel(label = '') {
  return String(label || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/×/g, 'x');
}

export function extractSizeOptionsFromProduct(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const sizeVariant = variants.find((v) => /^size$/i.test(String(v?.name || '').trim()))
    || variants.find((v) => (v.options || []).some((o) => /\d+\s*[x×]\s*\d+/i.test(String(o?.label || o?.name || ''))));
  if (!sizeVariant) {
    // Fall back to all variant options if no Size group exists
    const options = variants.flatMap((v) => (v.options || []).map((o) => ({
      label: String(o.label || o.name || '').trim(),
      sku: o.sku || '',
      stock: o.stock,
      price: o.price,
      salePrice: o.salePrice,
      optionId: o._id || o.sku || '',
      requiresImageUpload: Boolean(o.requiresImageUpload),
      previewWidth: o.previewWidth,
      previewHeight: o.previewHeight,
      previewUnit: o.previewUnit || 'inch',
      previewFrameImage: o.previewFrameImage || '',
      previewInstructions: o.previewInstructions || '',
      variantName: v.name || 'Variant',
    }))).filter((o) => o.label);
    return { variantName: 'Variant', options };
  }
  const options = (sizeVariant.options || [])
    .map((o) => ({
      label: String(o.label || o.name || '').trim(),
      sku: o.sku || '',
      stock: o.stock,
      price: o.price,
      salePrice: o.salePrice,
      optionId: o._id || o.sku || '',
      requiresImageUpload: Boolean(o.requiresImageUpload),
      previewWidth: o.previewWidth,
      previewHeight: o.previewHeight,
      previewUnit: o.previewUnit || 'inch',
      previewFrameImage: o.previewFrameImage || '',
      previewInstructions: o.previewInstructions || '',
      variantName: sizeVariant.name || 'Size',
    }))
    .filter((o) => o.label);
  return { variantName: sizeVariant.name || 'Size', options };
}

export function hasSizeOption(options, wanted) {
  const target = normalizeSizeLabel(wanted);
  return (options || []).some((o) => normalizeSizeLabel(o.label) === target);
}

/** @deprecated No longer used — kept only so old imports do not break. Does nothing. */
export function ensureThirteenByTwenty() {
  return false;
}

/** Build line items for order create from combo size selections. */
export function buildComboLineItems(productId, selections = []) {
  return (selections || [])
    .filter((row) => row?.size && Number(row.quantity) > 0)
    .map((row) => ({
      productId,
      variant: row.variantValue || `Size: ${row.size}`,
      quantity: Math.max(1, Number(row.quantity) || 1),
      customizationInstructions: row.instructions || '',
      isCustomizedCombo: true,
      comboSize: row.size,
      variantId: row.variantId || '',
    }));
}

/**
 * @deprecated Prefer buildAdditionalVariantSlots(comboProduct, variantValue, qty)
 * from websiteProductPhotoConfig. Kept for backward-compatible callers.
 */
export function buildComboPhotoSlots(selections = []) {
  const slots = [];
  (selections || []).forEach((row) => {
    const size = String(row?.size || '').trim();
    const qty = Math.max(0, Number(row?.quantity) || 0);
    if (!size || qty < 1) return;
    for (let i = 1; i <= qty; i += 1) {
      slots.push({
        size,
        frameIndex: i,
        label: `${size} — Photo ${i}`,
        slotKey: `combo-${normalizeSizeLabel(size)}-${i}`,
        file: null,
        previewUrl: '',
      });
    }
  });
  return slots;
}
