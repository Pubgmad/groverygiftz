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

function buildFileFieldSlots(product) {
  const preview = product?.customizationPreview || {};
  const allowPreview = isProductPreviewEnabled(product);
  const fileFields = (product?.customFields || []).filter((f) => String(f?.type || '') === 'file');
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
      storageKind: 'file_field',
      storageLabel: field.label || `Photo ${index + 1}`,
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

/**
 * Product-level photo slots (preview areas when enabled + file customFields + count fallback).
 * Matches ProductDetail: areas only when customizationPreview.enabled; file fields always.
 */
export function buildProductLevelPhotoSlots(product) {
  if (!product) return [];
  const preview = product.customizationPreview || {};
  const allowPreview = isProductPreviewEnabled(product);
  const slots = [];

  // Storefront: areas only when preview.enabled
  if (preview.enabled) {
    let previewAreas = (Array.isArray(preview.areas) ? preview.areas : [])
      .map((area, index) => areaFromPreviewConfig(area, preview, index))
      .filter((area) => area.requiresImageUpload !== false);

    if (previewAreas.length === 0) {
      const legacy = legacyPreviewArea(preview);
      if (legacy) previewAreas = [legacy];
    }

    const requiredPhotoCount = Math.max(
      0,
      previewAreas.filter((a) => a.required !== false).length || Number(preview.requiredImageCount || 0),
    );
    const maxPhotoCount = Math.max(
      requiredPhotoCount,
      previewAreas.length || Number(preview.maxImageCount || requiredPhotoCount || 0),
    );
    const photoSlotCount = previewAreas.length > 0 ? previewAreas.length : maxPhotoCount;

    if (previewAreas.length > 0) {
      for (let index = 0; index < Math.max(photoSlotCount, previewAreas.length); index += 1) {
        const area = previewAreas[index] || previewAreas[previewAreas.length - 1];
        slots.push({
          slotKey: `product-area-${index}`,
          section: 'default',
          storageKind: 'customer',
          storageLabel: 'Customer Photos',
          label: area.label || `Photo ${index + 1}`,
          sizeLabel: formatFrameSizeLabel(area) || '',
          frameImage: area.frameImage || '',
          instructions: area.instructions || '',
          required: area.required !== false,
          allowPreview: allowPreview && preview.enabled !== false,
          area,
          photo: null,
          reference: null,
        });
      }
    } else if (photoSlotCount > 0 && isProductUploadEnabled(product)) {
      for (let index = 0; index < photoSlotCount; index += 1) {
        const area = {
          label: `Photo ${index + 1}`,
          width: Number(preview.width) || 1,
          height: Number(preview.height) || 1,
          unit: preview.unit || 'inch',
          frameImage: preview.frameImage || '',
          instructions: preview.instructions || preview.shortGuidance || '',
        };
        slots.push({
          slotKey: `product-count-${index}`,
          section: 'default',
          storageKind: 'customer',
          storageLabel: 'Customer Photos',
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
    }
  }

  // File custom fields always (alongside areas), matching ProductDetail
  slots.push(...buildFileFieldSlots(product));

  return slots;
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
    storageKind: 'variant',
    storageLabel: 'Variant Label Uploads',
    variantStorageKey: selected.label || '',
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
  return (product?.variants || []).flatMap((v) => (v.options || []).map((o) => {
    const optionLabel = String(o?.label || o?.name || '').trim();
    if (!optionLabel) return null;
    const variantName = String(v?.name || v?.type || 'Variant').trim() || 'Variant';
    return {
      value: `${variantName}: ${optionLabel}`,
      label: `${variantName}: ${optionLabel}`,
      variantName,
      optionLabel,
      optionId: o._id || o.sku || `${variantName}:${optionLabel}`,
      requiresImageUpload: Boolean(o.requiresImageUpload),
      previewWidth: o.previewWidth,
      previewHeight: o.previewHeight,
      previewUnit: o.previewUnit || 'inch',
      previewFrameImage: o.previewFrameImage || '',
      previewInstructions: o.previewInstructions || '',
      source: 'variants',
    };
  })).filter(Boolean);
}

/**
 * When product.variants is empty, some catalog products still expose size-like
 * dimensions on customizationPreview.areas (storefront uses them as slot labels,
 * not a Size picker). Surface those as selectable Additional Variant choices
 * without inventing website variant IDs.
 */
export function listAreaDerivedSizeOptions(product) {
  const preview = product?.customizationPreview || {};
  if (preview.enabled === false) return [];
  const areas = Array.isArray(preview.areas) ? preview.areas : [];
  const seen = new Set();
  const options = [];
  areas.forEach((area) => {
    const width = Number(area?.width) || 0;
    const height = Number(area?.height) || 0;
    const rawLabel = String(area?.label || '').trim();
    // Only treat as a selectable size when dimensions are real, or the label
    // itself looks like a size (e.g. "12x8"). Skip generic slot labels like "Front Photo".
    const hasRealDimensions = width > 1 && height > 1;
    const labelLooksLikeSize = /\d+\s*[x×*]\s*\d+/i.test(rawLabel);
    if (!hasRealDimensions && !labelLooksLikeSize) return;
    const sizeLabel = hasRealDimensions
      ? (formatFrameSizeLabel({
        width,
        height,
        unit: area?.unit || preview.unit || 'inch',
      }) || rawLabel)
      : rawLabel;
    if (!sizeLabel || !/\d/.test(sizeLabel)) return;
    const key = sizeLabel.toLowerCase().replace(/\s+/g, '');
    if (seen.has(key)) return;
    seen.add(key);
    options.push({
      value: `AreaSize: ${sizeLabel}`,
      label: sizeLabel,
      variantName: 'Size',
      optionLabel: sizeLabel,
      optionId: '',
      requiresImageUpload: false,
      previewWidth: width,
      previewHeight: height,
      previewUnit: area?.unit || preview.unit || 'inch',
      previewFrameImage: area?.frameImage || preview.frameImage || '',
      previewInstructions: area?.instructions || '',
      source: 'area_size',
      isAreaDerived: true,
    });
  });
  return options;
}

/**
 * Source of truth for Additional Variants dropdown:
 * 1) website product.variants (same as ProductDetail)
 * 2) else size-like preview area dimensions
 */
export function listAdditionalVariantChoices(product) {
  const fromVariants = listWebsiteVariantOptions(product);
  if (fromVariants.length) {
    return { choices: fromVariants, source: 'variants' };
  }
  const fromAreas = listAreaDerivedSizeOptions(product);
  if (fromAreas.length) {
    return { choices: fromAreas, source: 'area_sizes' };
  }
  return { choices: [], source: 'none' };
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
      groupKey: `collage:${template.label}`,
    }));
}

/**
 * Full plan for Select Product / Combo.
 * @param {object} product
 * @param {{ selectedVariantValue?: string }} [opts]
 */
export function resolveProductCustomizationPlan(product, opts = {}) {
  if (!product) {
    return {
      variantOptions: [],
      defaultVariantValue: '',
      selectedVariantValue: '',
      textCustomFields: [],
      collageTemplates: [],
      defaultPhotoSlots: [],
      hasProductLevelUploads: false,
      hasVariantOnlyUploads: false,
      hasCollage: false,
      previewEnabled: false,
    };
  }
  const variantOptions = listWebsiteVariantOptions(product);
  const productLevel = buildProductLevelPhotoSlots(product);
  const hasProductLevelUploads = productLevel.length > 0;
  const hasVariantUploads = variantOptions.some((option) => option.requiresImageUpload);
  const hasVariantOnlyUploads = !hasProductLevelUploads && hasVariantUploads;

  const requested = String(opts.selectedVariantValue || '').trim();
  let selectedVariantValue = requested;
  if (!selectedVariantValue) {
    if (hasVariantOnlyUploads) {
      selectedVariantValue = variantOptions.find((option) => option.requiresImageUpload)?.value
        || variantOptions[0]?.value
        || '';
    } else if (variantOptions.length) {
      // Match ProductDetail: auto-select first variant so size-specific rules can apply
      selectedVariantValue = variantOptions[0].value;
    }
  }

  const selected = findVariantOption(product, selectedVariantValue);
  const includeVariantUpload = Boolean(selected?.requiresImageUpload);

  let defaultPhotoSlots = [];
  if (hasProductLevelUploads || includeVariantUpload) {
    defaultPhotoSlots = buildWebsitePhotoSlotsForQuantity(product, 1, selectedVariantValue, {
      includeProductLevel: hasProductLevelUploads,
      includeVariantUpload,
    });
  }

  const collageTemplates = getCollageTemplates(product);

  return {
    variantOptions,
    defaultVariantValue: selectedVariantValue,
    selectedVariantValue,
    textCustomFields: getTextCustomFields(product),
    collageTemplates,
    defaultPhotoSlots,
    hasProductLevelUploads,
    hasVariantOnlyUploads,
    hasCollage: collageTemplates.length > 0,
    previewEnabled: isProductPreviewEnabled(product),
  };
}

export const ORDER_LOCAL_CUSTOM_VARIANT = '__custom_order_only__';

/**
 * Order-local custom variant slots.
 * Reuse product-level upload requirements × qty when present.
 * Do NOT invent a website preview model or crop ratio for the custom size.
 */
export function buildOrderLocalCustomVariantSlots(product, customLabel, quantity) {
  const label = String(customLabel || '').trim() || 'Custom';
  const qty = Math.max(1, Number(quantity) || 1);
  const productLevel = buildProductLevelPhotoSlots(product);
  if (productLevel.length > 0) {
    const base = buildWebsitePhotoSlotsForQuantity(product, qty, '', {
      includeProductLevel: true,
      includeVariantUpload: false,
    });
    return base.map((slot) => ({
      ...slot,
      // Keep product-level area/preview rules; only tag the order-local label
      variantLabel: label,
      sizeLabel: slot.sizeLabel || label,
      label: qty > 1
        ? `${label} — Unit ${slot.unitIndex || 1}${productLevel.length > 1 ? ` · ${slot.area?.label || slot.label}` : ''}`
        : (productLevel.length > 1 ? `${label} — ${slot.label}` : label),
      slotKey: `order-local-${label}-${slot.slotKey}`,
      isOrderLocalCustom: true,
    }));
  }
  // No product-level uploads configured — do not invent mandatory photo slots
  return [];
}

/** Slots for an Additional Variant / Combo size row. */
export function buildAdditionalVariantSlots(product, variantValue, quantity) {
  if (!variantValue || variantValue === ORDER_LOCAL_CUSTOM_VARIANT) {
    return [];
  }
  // Area-derived size choice (not a real website variant ID)
  if (String(variantValue).startsWith('AreaSize:')) {
    const sizeLabel = String(variantValue).replace(/^AreaSize:\s*/i, '').trim();
    return buildOrderLocalCustomVariantSlots(product, sizeLabel, quantity);
  }
  const selected = findVariantOption(product, variantValue);
  const hasVariantUpload = Boolean(selected?.requiresImageUpload);
  const productLevel = buildProductLevelPhotoSlots(product);
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
  // Fallback: one photo per unit when product has no explicit upload config but a catalog variant was chosen
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
      storageKind: 'variant',
      storageLabel: 'Variant Label Uploads',
      variantStorageKey: label,
      label: qty > 1 ? `${label} — Unit ${index + 1}` : label,
      sizeLabel: formatFrameSizeLabel(area) || label,
      frameImage: area.frameImage || '',
      instructions: area.instructions || '',
      required: true,
      allowPreview: isProductPreviewEnabled(product) && Boolean(variantAreaFromOption(selected)),
      area,
      variantLabel: label,
      unitIndex: index + 1,
      photo: null,
      reference: null,
    }));
  }
  return [];
}

/** Build ProductDetail-shaped collageUploads placeholders for order create. */
export function buildCollageUploadsPayload(collageTemplates = [], collageUploadsState = {}, excludedKeys = []) {
  return (collageTemplates || [])
    .filter((template) => !excludedKeys.includes(template.groupKey || `collage:${template.label}`))
    .map((template) => ({
      label: template.label,
      images: [],
      // Local files are uploaded after create; keep count for validation only
      _pendingCount: Array.isArray(collageUploadsState?.[template.label])
        ? collageUploadsState[template.label].length
        : 0,
    }));
}
