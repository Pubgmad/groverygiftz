/**
 * Shared website product → photo-slot / customization resolution for
 * Create WhatsApp Order. Mirrors ProductDetail rules without embedding ProductDetail.
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
  // Match storefront: uploads from preview areas require enabled, but file customFields
  // and variant requiresImageUpload remain available independently.
  if (preview.uploadEnabled === false) return false;
  return true;
}

export function findVariantOption(product, variantValue = '') {
  const raw = String(variantValue || '').trim();
  if (!raw || !product) return null;
  const variants = Array.isArray(product.variants) ? product.variants : [];
  for (const variant of variants) {
    const name = String(variant?.name || '').trim();
    for (const option of variant?.options || []) {
      const label = String(option?.label || option?.name || '').trim();
      if (!label) continue;
      const optionId = String(option._id || option.sku || '').trim();
      if (
        raw === `${name}: ${label}`
        || raw === label
        || raw.toLowerCase() === `size: ${label}`.toLowerCase()
        || (optionId && raw === optionId)
      ) {
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

function legacyPreviewArea(preview = {}) {
  if (!preview?.enabled) return null;
  const ratio = String(preview.aspectRatio || '').match(/(\d+(?:\.\d+)?)\s*[:/x×]\s*(\d+(?:\.\d+)?)/i);
  return {
    label: preview.title || 'Photo',
    width: ratio ? Number(ratio[1]) : Number(preview.width) || 1,
    height: ratio ? Number(ratio[2]) : Number(preview.height) || 1,
    unit: preview.unit || 'ratio',
    frameImage: preview.frameImage || '',
    instructions: preview.instructions || preview.shortGuidance || '',
    required: true,
    requiresImageUpload: true,
  };
}

/** Product-level photo slots (areas / counts / file fields) — independent of variant selection. */
export function buildProductLevelPhotoSlots(product) {
  if (!product) return [];
  const preview = product.customizationPreview || {};
  const allowPreview = isProductPreviewEnabled(product);
  const rawAreas = Array.isArray(preview.areas) ? preview.areas : [];
  let previewAreas = rawAreas
    .map((area, index) => areaFromPreviewConfig(area, preview, index))
    .filter((area) => area.requiresImageUpload !== false);

  // Storefront uses areas only when customizationPreview.enabled; keep WA aligned when enabled.
  // When enabled with empty areas, use legacy single area like ProductDetail.
  if (preview.enabled && previewAreas.length === 0) {
    const legacy = legacyPreviewArea(preview);
    if (legacy) previewAreas = [legacy];
  }

  // If preview.enabled is false, still allow file customFields and requiredImageCount
  // for admin-configured uploads that do not use the live preview editor.
  const requiredPhotoCount = Math.max(
    0,
    previewAreas.filter((a) => a.required !== false).length || Number(preview.requiredImageCount || 0),
  );
  const maxPhotoCount = Math.max(
    requiredPhotoCount,
    previewAreas.length || Number(preview.maxImageCount || requiredPhotoCount || 0),
  );
  const photoSlotCount = previewAreas.length > 0 ? previewAreas.length : maxPhotoCount;

  if (previewAreas.length > 0 && (preview.enabled !== false || photoSlotCount > 0)) {
    return Array.from({ length: Math.max(photoSlotCount, previewAreas.length) }, (_, index) => {
      const area = previewAreas[index] || previewAreas[previewAreas.length - 1];
      return {
        slotKey: `product-area-${index}`,
        section: 'default',
        label: area.label || `Photo ${index + 1}`,
        sizeLabel: formatFrameSizeLabel(area) || '',
        frameImage: area.frameImage || '',
        instructions: area.instructions || '',
        required: area.required !== false,
        allowPreview: allowPreview && preview.enabled !== false,
        area,
        photo: null,
        reference: null,
      };
    });
  }

  const fileFields = (product.customFields || []).filter((f) => String(f?.type || '') === 'file');
  if (fileFields.length > 0) {
    return fileFields.map((field, index) => {
      const area = {
        label: field.label || `Photo ${index + 1}`,
        width: 1,
        height: 1,
        unit: 'inch',
        frameImage: preview.frameImage || '',
        instructions: preview.shortGuidance || preview.instructions || '',
      };
      return {
        slotKey: `product-field-${index}`,
        section: 'default',
        label: field.label || `Photo ${index + 1}`,
        sizeLabel: '',
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
  }

  if (photoSlotCount > 0 && isProductUploadEnabled(product)) {
    return Array.from({ length: photoSlotCount }, (_, index) => {
      const area = {
        label: `Photo ${index + 1}`,
        width: Number(preview.width) || 1,
        height: Number(preview.height) || 1,
        unit: preview.unit || 'inch',
        frameImage: preview.frameImage || '',
        instructions: preview.instructions || preview.shortGuidance || '',
      };
      return {
        slotKey: `product-count-${index}`,
        section: 'default',
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

  return [];
}

/** Variant option upload slot (requiresImageUpload on the selected option). */
export function buildVariantUploadSlots(product, variantValue = '') {
  if (!product || !variantValue) return [];
  const preview = product.customizationPreview || {};
  const allowPreview = isProductPreviewEnabled(product);
  const selected = findVariantOption(product, variantValue);
  if (!selected?.requiresImageUpload) return [];
  const variantArea = variantAreaFromOption(selected);
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
    section: 'variant',
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

/**
 * Base slots for a product line.
 * - includeProductLevel: areas / file fields / counts
 * - includeVariantUpload: selected option requiresImageUpload slot
 * Unlike the old path, product-level slots are NOT dropped when a variant upload exists.
 */
export function buildWebsiteBasePhotoSlots(product, {
  variantValue = '',
  includeProductLevel = true,
  includeVariantUpload = true,
} = {}) {
  if (!product) return [];
  const slots = [];
  if (includeVariantUpload) {
    slots.push(...buildVariantUploadSlots(product, variantValue));
  }
  if (includeProductLevel) {
    const productSlots = buildProductLevelPhotoSlots(product);
    // Overlay selected variant dimensions onto product areas when variant has preview size
    const selected = findVariantOption(product, variantValue);
    const variantArea = variantAreaFromOption(selected);
    if (variantArea) {
      slots.push(...productSlots.map((slot) => ({
        ...slot,
        sizeLabel: slot.sizeLabel || formatFrameSizeLabel(variantArea) || slot.sizeLabel,
        frameImage: slot.frameImage || variantArea.frameImage || '',
        variantLabel: selected?.label || '',
        area: {
          ...slot.area,
          width: Number(slot.area?.width) > 1 ? slot.area.width : variantArea.width,
          height: Number(slot.area?.height) > 1 ? slot.area.height : variantArea.height,
          unit: slot.area?.unit || variantArea.unit,
          frameImage: slot.area?.frameImage || variantArea.frameImage || '',
        },
      })));
    } else {
      slots.push(...productSlots);
    }
  }
  return slots;
}

/** Expand base slots × quantity (isolated unit indexes). */
export function buildWebsitePhotoSlotsForQuantity(product, quantity, variantValue = '', options = {}) {
  const base = buildWebsiteBasePhotoSlots(product, {
    variantValue,
    includeProductLevel: options.includeProductLevel !== false,
    includeVariantUpload: options.includeVariantUpload !== false,
  });
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
          ? `${variantLabel ? `${variantLabel} — ` : ''}Unit ${unit}${base.length > 1 ? ` · ${slot.label}` : ''}`
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

export function getTextCustomFields(product) {
  return (Array.isArray(product?.customFields) ? product.customFields : [])
    .filter((field) => field?.type !== 'file')
    .map((field) => ({
      label: field.label || '',
      type: field.type || 'text',
      required: field.required === true,
    }))
    .filter((field) => field.label);
}

export function getCollageTemplates(product) {
  if (!product?.collageEnabled) return [];
  return (product.collageTemplates || [])
    .filter((template) => template?.label && template.isActive !== false)
    .map((template) => ({
      label: template.label,
      minImages: Math.max(0, Number(template.minImages || 0)),
      maxImages: Math.max(0, Number(template.maxImages || template.minImages || 0)),
      instructions: template.instructions || '',
    }));
}

/**
 * Full plan for Select Product: defaults load immediately; optional auto-variant for variant-only products.
 */
export function resolveProductCustomizationPlan(product) {
  if (!product) {
    return {
      variantOptions: [],
      defaultVariantValue: '',
      textCustomFields: [],
      collageTemplates: [],
      defaultPhotoSlots: [],
      hasProductLevelUploads: false,
      hasVariantOnlyUploads: false,
      previewEnabled: false,
    };
  }
  const variantOptions = listWebsiteVariantOptions(product);
  const productLevel = buildProductLevelPhotoSlots(product);
  const hasProductLevelUploads = productLevel.length > 0;
  const hasVariantOnlyUploads = !hasProductLevelUploads
    && variantOptions.some((option) => option.requiresImageUpload);
  const defaultVariantValue = hasVariantOnlyUploads
    ? (variantOptions.find((option) => option.requiresImageUpload)?.value || variantOptions[0]?.value || '')
    : '';

  let defaultPhotoSlots = [];
  if (hasProductLevelUploads) {
    defaultPhotoSlots = buildWebsitePhotoSlotsForQuantity(product, 1, '', {
      includeProductLevel: true,
      includeVariantUpload: false,
    });
  } else if (hasVariantOnlyUploads && defaultVariantValue) {
    defaultPhotoSlots = buildWebsitePhotoSlotsForQuantity(product, 1, defaultVariantValue, {
      includeProductLevel: false,
      includeVariantUpload: true,
    });
  }

  return {
    variantOptions,
    defaultVariantValue,
    textCustomFields: getTextCustomFields(product),
    collageTemplates: getCollageTemplates(product),
    defaultPhotoSlots,
    hasProductLevelUploads,
    hasVariantOnlyUploads,
    previewEnabled: isProductPreviewEnabled(product),
  };
}

/** Slots for an Additional Variant / Combo size row. */
export function buildAdditionalVariantSlots(product, variantValue, quantity) {
  const selected = findVariantOption(product, variantValue);
  const hasVariantUpload = Boolean(selected?.requiresImageUpload);
  const productLevel = buildProductLevelPhotoSlots(product);
  // Prefer variant upload when configured; otherwise multiply product-level areas by qty with variant dims.
  if (hasVariantUpload) {
    return buildWebsitePhotoSlotsForQuantity(product, quantity, variantValue, {
      includeProductLevel: productLevel.length > 0,
      includeVariantUpload: true,
    });
  }
  if (productLevel.length > 0) {
    return buildWebsitePhotoSlotsForQuantity(product, quantity, variantValue, {
      includeProductLevel: true,
      includeVariantUpload: false,
    });
  }
  // Fallback: one photo per unit when product has no explicit upload config but a variant was chosen
  if (variantValue) {
    const qty = Math.max(1, Number(quantity) || 1);
    const label = selected?.label || variantValue;
    const area = variantAreaFromOption(selected) || {
      label,
      width: 1,
      height: 1,
      unit: 'inch',
      frameImage: product?.customizationPreview?.frameImage || '',
      instructions: '',
    };
    return Array.from({ length: qty }, (_, index) => ({
      slotKey: `fallback-${label}-u${index + 1}`,
      section: 'variant',
      label: qty > 1 ? `${label} — Unit ${index + 1}` : label,
      sizeLabel: formatFrameSizeLabel(area) || label,
      frameImage: area.frameImage || '',
      instructions: area.instructions || '',
      required: true,
      allowPreview: isProductPreviewEnabled(product),
      area,
      variantLabel: label,
      unitIndex: index + 1,
      photo: null,
      reference: null,
    }));
  }
  return [];
}
