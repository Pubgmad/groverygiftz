/**
 * WhatsApp Customized Combo — sizes come from the existing Website product variants
 * "Personalized Single Photo Frame, Premium Frame with Matte Finish"
 * (also matches British spelling "Personalised").
 */

export const COMBO_SOURCE_PRODUCT_TITLE_RX = /personal+i[sz]ed\s+single\s+photo\s+frame.*matte\s+finish/i;

export const REQUIRED_COMBO_SIZES = ['13×20', '13x20'];

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
  if (!sizeVariant) return { variantName: 'Size', options: [] };
  const options = (sizeVariant.options || [])
    .map((o) => ({
      label: String(o.label || o.name || '').trim(),
      sku: o.sku || '',
      stock: o.stock,
      price: o.price,
      salePrice: o.salePrice,
    }))
    .filter((o) => o.label);
  return { variantName: sizeVariant.name || 'Size', options };
}

export function hasSizeOption(options, wanted) {
  const target = normalizeSizeLabel(wanted);
  return (options || []).some((o) => normalizeSizeLabel(o.label) === target);
}

/**
 * Ensure 13×20 exists on the Size variant (mutates product doc for save).
 * Returns true if a variant option was added.
 */
export function ensureThirteenByTwenty(product) {
  if (!product) return false;
  if (!Array.isArray(product.variants)) product.variants = [];
  let sizeVariant = product.variants.find((v) => /^size$/i.test(String(v?.name || '').trim()));
  if (!sizeVariant) {
    sizeVariant = { name: 'Size', options: [] };
    product.variants.push(sizeVariant);
  }
  if (!Array.isArray(sizeVariant.options)) sizeVariant.options = [];
  if (hasSizeOption(sizeVariant.options, '13x20')) return false;
  sizeVariant.options.push({
    label: '13×20',
    sku: '',
    stock: 0,
  });
  return true;
}

/** Build line items for order create from combo size selections. */
export function buildComboLineItems(productId, selections = []) {
  return (selections || [])
    .filter((row) => row?.size && Number(row.quantity) > 0)
    .map((row) => ({
      productId,
      variant: `Size: ${row.size}`,
      quantity: Math.max(1, Number(row.quantity) || 1),
      customizationInstructions: row.instructions || '',
      isCustomizedCombo: true,
      comboSize: row.size,
    }));
}

/**
 * Expand size×qty into individual photo slots for the create modal.
 * One quantity = one frame = one photo slot.
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
