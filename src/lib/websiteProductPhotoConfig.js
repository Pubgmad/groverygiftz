/**
 * Shared website product → photo-slot / preview-area resolution.
 * Mirrors ProductDetail customizationPreview + variant preview fields so
 * Admin WhatsApp create uses the same aspect ratios, frames, and upload rules.
 */

import { formatFrameSizeLabel } from '@/lib/photoEditor';

export function isProductPreviewEnabled(product) {
  const preview = product?.customizationPreview || {};
  if (preview.enabled === false) return false;
  if (preview.previewEnabled === false) return false;
  return true;
}

export function isProductUploadEnabled(product) {
  const preview = product?.customizationPreview || {};
  if (preview.uploadEnabled === false && preview.enabled === false) return false;
  return true;
}

/** Resolve Size/variant option object from a "Name: Label" selection string. */
export function findVariantOption(product, variantValue = '') {
  const raw = String(variantValue || '').trim();
  if (!raw || !product) return null;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  for (const variant of variants) {
    const name = String(variant?.name || '').trim();
    for (const option of variant?.options || []) {
      const label = String(option?.label || option?.name || '').trim();
      if (!label) continue;
      if (raw === `${name}: ${label}` || raw === label || raw.toLowerCase() === `size: ${label}`.toLowerCase()) {
        return {
          variantName: name,
          label,
          option,
          requiresImageUpload: Boolean(option.requiresImageUpload),
          previewWidth: option.previewWidth,
          previewHeight: option.previewHeight,
          previewUnit: option.previewUnit || 'inch',
          previewFrameImage: option.previewFrameImage || '',
          previewInstructions: option.previewInstructions || '',
        };
      }
    }
  }
  return null;
}

/** Same shape ProductDetail.variantAreaFromSelected uses for PhotoAdjuster. */
export function variantAreaFromOption(selected) {
  if (!selected) return null;
  const width = Number(selected.previewWidth);
  const height = Number(selected.previewHeight);
  if (!(width > 0) && !(height > 0) && !selected.previewFrameImage) return null;
  return {
    label: selected.label || 'Photo',
    width: width > 0 ? width : 1,
    height: height > 0 ? height : 1,
    unit: selected.previewUnit || 'inch',
    frameImage: selected.previewFrameImage || '',
    instructions: selected.previewInstructions || '',
  };
}

function areaFromPreviewConfig(area = {}, preview = {}, index = 0) {
  return {
    label: area.label || `Photo ${index + 1}`,
    width: Number(area.width) > 0 ? Number(area.width) : 1,
    height: Number(area.height) > 0 ? Number(area.height) : 1,
    unit: area.unit || preview.unit || 'inch',
    frameImage: area.frameImage || preview.frameImage || '',
    instructions: area.instructions || preview.instructions || preview.shortGuidance || '',
    required: area.required !== false,
    requiresImageUpload: area.requiresImageUpload !== false,
  };
}

/**
 * Base per-unit slots from website product config (ProductDetail rules).
 * When a variant option carries preview dimensions / requiresImageUpload,
 * prefer that option's area (storefront selectedVariantUploadOptions path).
 */
export function buildWebsiteBasePhotoSlots(product, { variantValue = '' } = {}) {
  if (!product || !isProductUploadEnabled(product)) return [];
  const preview = product.customizationPreview || {};
  const allowPreview = isProductPreviewEnabled(product);
  const selected = findVariantOption(product, variantValue);
  const variantArea = variantAreaFromOption(selected);

  // Variant-driven upload (requiresImageUpload on the selected option)
  if (selected?.requiresImageUpload) {
    const area = variantArea || {
      label: selected.label || 'Photo',
      width: 1,
      height: 1,
      unit: 'inch',
      frameImage: preview.frameImage || '',
      instructions: selected.previewInstructions || preview.instructions || '',
    };
    return [{
      slotKey: `variant-${selected.label}`,
      label: selected.label || 'Photo',
      sizeLabel: formatFrameSizeLabel(area) || selected.label || '',
      frameImage: area.frameImage || '',
      instructions: area.instructions || '',
      required: true,
      allowPreview,
      area,
      variantLabel: selected.label || '',
      variantId: selected.option?._id || selected.option?.sku || '',
      photo: null,
      reference: null,
    }];
  }

  const rawAreas = Array.isArray(preview.areas) ? preview.areas : [];
  const previewAreas = rawAreas
    .map((area, index) => areaFromPreviewConfig(area, preview, index))
    .filter((area) => area.requiresImageUpload !== false);

  const requiredPhotoCount = Math.max(
    0,
    previewAreas.filter((a) => a.required !== false).length || Number(preview.requiredImageCount || 0),
  );
  const maxPhotoCount = Math.max(
    requiredPhotoCount,
    previewAreas.length || Number(preview.maxImageCount || requiredPhotoCount || 0),
  );
  const photoSlotCount = previewAreas.length > 0 ? previewAreas.length : maxPhotoCount;
  if (!photoSlotCount) return [];

  if (previewAreas.length > 0) {
    return Array.from({ length: photoSlotCount }, (_, index) => {
      const area = previewAreas[index] || previewAreas[previewAreas.length - 1];
      // Overlay variant frame/size when selected and area lacks its own frame
      const mergedArea = {
        ...area,
        frameImage: area.frameImage || variantArea?.frameImage || preview.frameImage || '',
        width: Number(area.width) > 1 || !variantArea ? area.width : variantArea.width,
        height: Number(area.height) > 1 || !variantArea ? area.height : variantArea.height,
        unit: area.unit || variantArea?.unit || 'inch',
      };
      return {
        slotKey: `catalog-area-${index}`,
        label: area.label || `Photo ${index + 1}`,
        sizeLabel: formatFrameSizeLabel(mergedArea) || '',
        frameImage: mergedArea.frameImage || '',
        instructions: mergedArea.instructions || '',
        required: area.required !== false,
        allowPreview,
        area: mergedArea,
        variantLabel: selected?.label || '',
        photo: null,
        reference: null,
      };
    });
  }

  const fileFields = (product.customFields || []).filter((f) => String(f?.type || '') === 'file');
  if (fileFields.length > 0) {
    const slots = fileFields.map((field, index) => {
      const area = {
        label: field.label || `Photo ${index + 1}`,
        width: variantArea?.width || 1,
        height: variantArea?.height || 1,
        unit: variantArea?.unit || 'inch',
        frameImage: variantArea?.frameImage || preview.frameImage || '',
        instructions: preview.shortGuidance || preview.instructions || '',
      };
      return {
        slotKey: `catalog-field-${index}`,
        label: field.label || `Photo ${index + 1}`,
        sizeLabel: formatFrameSizeLabel(area) || '',
        frameImage: area.frameImage,
        instructions: area.instructions,
        required: field.required === true,
        allowPreview,
        area,
        customFieldLabel: field.label,
        photo: null,
        reference: null,
      };
    });
    while (slots.length < photoSlotCount) {
      const index = slots.length;
      const area = {
        label: `Photo ${index + 1}`,
        width: variantArea?.width || 1,
        height: variantArea?.height || 1,
        unit: variantArea?.unit || 'inch',
        frameImage: variantArea?.frameImage || preview.frameImage || '',
        instructions: preview.instructions || '',
      };
      slots.push({
        slotKey: `catalog-extra-${index}`,
        label: area.label,
        sizeLabel: formatFrameSizeLabel(area) || '',
        frameImage: area.frameImage,
        instructions: area.instructions,
        required: index < requiredPhotoCount,
        allowPreview,
        area,
        photo: null,
        reference: null,
      });
    }
    return slots;
  }

  return Array.from({ length: photoSlotCount }, (_, index) => {
    const area = {
      label: `Photo ${index + 1}`,
      width: variantArea?.width || Number(preview.width) || 1,
      height: variantArea?.height || Number(preview.height) || 1,
      unit: variantArea?.unit || preview.unit || 'inch',
      frameImage: variantArea?.frameImage || preview.frameImage || '',
      instructions: preview.instructions || preview.shortGuidance || '',
    };
    return {
      slotKey: `catalog-${index}`,
      label: area.label,
      sizeLabel: formatFrameSizeLabel(area) || '',
      frameImage: area.frameImage,
      instructions: area.instructions,
      required: index < requiredPhotoCount,
      allowPreview,
      area,
      photo: null,
      reference: null,
    };
  });
}

/** Expand base slots × quantity (one unit may need multiple labeled photos). */
export function buildWebsitePhotoSlotsForQuantity(product, quantity, variantValue = '') {
  const base = buildWebsiteBasePhotoSlots(product, { variantValue });
  if (!base.length) return [];
  const qty = Math.max(1, Number(quantity) || 1);
  const variantLabel = findVariantOption(product, variantValue)?.label || variantValue || '';
  const slots = [];
  for (let unit = 1; unit <= qty; unit += 1) {
    base.forEach((slot) => {
      slots.push({
        ...slot,
        photo: null,
        reference: null,
        unitIndex: unit,
        variantLabel: slot.variantLabel || variantLabel,
        slotKey: `${slot.slotKey}-u${unit}`,
        label: qty > 1
          ? `${variantLabel ? `${variantLabel} — ` : ''}Frame ${unit}${base.length > 1 ? ` · ${slot.label}` : ''}`
          : (variantLabel && !String(slot.label || '').includes(variantLabel)
            ? `${variantLabel} — ${slot.label}`
            : slot.label),
        sizeLabel: slot.sizeLabel || variantLabel || '',
        area: slot.area
          ? { ...slot.area, label: qty > 1 ? `${variantLabel || slot.area.label} · ${unit}` : slot.area.label }
          : slot.area,
      });
    });
  }
  return slots;
}

export function mergeSlotsPreserveUploads(nextSlots = [], prevSlots = []) {
  const byKey = Object.fromEntries((prevSlots || []).map((s) => [s.slotKey, s]));
  return (nextSlots || []).map((slot) => {
    const prev = byKey[slot.slotKey];
    if (!prev) return slot;
    return {
      ...slot,
      photo: prev.photo || null,
      reference: prev.reference || null,
      file: prev.file || prev.photo?.file || null,
      previewUrl: prev.previewUrl || prev.photo?.previewUrl || '',
    };
  });
}

export function listWebsiteVariantOptions(product) {
  return (product?.variants || []).flatMap((v) => (v.options || []).map((o) => ({
    value: `${v.name}: ${o.label}`,
    label: `${v.name}: ${o.label}`,
    variantName: v.name || '',
    optionLabel: o.label || '',
    optionId: o._id || o.sku || `${v.name}:${o.label}`,
    requiresImageUpload: Boolean(o.requiresImageUpload),
    previewWidth: o.previewWidth,
    previewHeight: o.previewHeight,
    previewUnit: o.previewUnit || 'inch',
    previewFrameImage: o.previewFrameImage || '',
    previewInstructions: o.previewInstructions || '',
  })));
}
