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
  let width = Number(selected.previewWidth);
  let height = Number(selected.previewHeight);
  let unit = selected.previewUnit || 'inch';
  // When Admin left preview dims empty, derive frame from the size label (e.g. 12*18).
  if (!(width > 0) || !(height > 0)) {
    const fromLabel = String(selected.label || selected.optionLabel || '').match(
      /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(inch(?:es)?|in|cm|mm)?/i,
    );
    if (fromLabel) {
      if (!(width > 0)) width = Number(fromLabel[1]) || 0;
      if (!(height > 0)) height = Number(fromLabel[2]) || 0;
      if (!selected.previewUnit && fromLabel[3]) {
        const unitRaw = String(fromLabel[3]).toLowerCase();
        unit = (unitRaw === 'inches' || unitRaw === 'in') ? 'inch' : unitRaw;
      }
    }
  }
  if (!(width > 0) && !(height > 0) && !selected.previewFrameImage) return null;
  return {
    label: selected.label || 'Photo',
    width: width > 0 ? width : 1,
    height: height > 0 ? height : 1,
    unit,
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
  // Match ProductDetail: variant size preview opens from option dims even when
  // product-level customizationPreview.enabled is false.
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
    allowPreview: Boolean(variantArea) || allowPreview,
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

/** True when a label is a website size (dimensions), not color/qty/accessory text. */
export function isWebsiteSizeLikeLabel(label) {
  const s = String(label || '').trim();
  if (!s) return false;
  if (/\d+\s*[x×*]\s*\d+/i.test(s)) return true;
  if (/\d+(?:\.\d+)?\s*(?:inch|inches|in|cm|mm)\b/i.test(s)) return true;
  return false;
}

/** Orphan / invalid size that must never appear in WA size dropdowns. */
export function isExcludedWebsiteSizeLabel(label) {
  const key = normalizeWebsiteSizeKey(label);
  return key === '13x20inch' || key === '13x20';
}

/**
 * Primary size options for catalog dropdowns.
 * Prefers "Size Varient(s)" groups over a leftover bare "Size" group (e.g. orphan 13×20).
 */
export function listPrimaryWebsiteSizeOptions(product) {
  const options = listWebsiteVariantOptions(product)
    .filter((opt) => isWebsiteSizeLikeLabel(opt.optionLabel || opt.label))
    .filter((opt) => !isExcludedWebsiteSizeLabel(opt.optionLabel || opt.label));
  if (!options.length) return [];
  const byName = new Map();
  options.forEach((opt) => {
    const name = String(opt.variantName || 'Size').trim() || 'Size';
    if (!byName.has(name)) byName.set(name, []);
    byName.get(name).push(opt);
  });
  if (byName.size === 1) return options;
  const preferred = [...byName.entries()]
    .filter(([name]) => /varient|variant/i.test(name));
  if (preferred.length) return preferred.flatMap(([, opts]) => opts);
  let best = [];
  byName.forEach((opts) => {
    if (opts.length > best.length) best = opts;
  });
  return best;
}

/**
 * Normalize equivalent size formatting to one key.
 * e.g. "12x18", "12 × 18", "12*18 inch" → "12x18inch"
 * Does NOT swap orientation (30x20 ≠ 20x30).
 */
export function normalizeWebsiteSizeKey(label) {
  const raw = String(label || '').trim().toLowerCase();
  if (!raw) return '';
  const match = raw.match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(inch(?:es)?|in|cm|mm)?/i);
  if (match) {
    const unitRaw = String(match[3] || 'inch').toLowerCase();
    const unit = (unitRaw === 'inches' || unitRaw === 'in') ? 'inch' : unitRaw;
    return `${match[1]}x${match[2]}${unit}`;
  }
  return raw
    .replace(/[×*]/g, 'x')
    .replace(/\s+/g, '')
    .replace(/inches\b/g, 'inch');
}

/** Prefer a stable human size label (keep unit when present). */
export function canonicalWebsiteSizeLabel(labels = []) {
  const list = (Array.isArray(labels) ? labels : [])
    .map((label) => String(label || '').trim())
    .filter(Boolean);
  if (!list.length) return '';
  const withUnit = list.find((label) => /\b(inch|inches|in|cm|mm)\b/i.test(label));
  const pick = withUnit || list[0];
  const match = String(pick).match(/(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(inch(?:es)?|in|cm|mm)?/i);
  if (!match) return pick;
  const unitRaw = String(match[3] || 'inch').toLowerCase();
  const unit = (unitRaw === 'inches' || unitRaw === 'in') ? 'inch' : unitRaw;
  return `${match[1]}×${match[2]} ${unit}`;
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
    const labelLooksLikeSize = isWebsiteSizeLikeLabel(rawLabel);
    if (!hasRealDimensions && !labelLooksLikeSize) return;
    // Prefer the website area label when it already names the size (e.g. "12*8 inch")
    // so catalog keys match storefront naming instead of width×height reordering.
    const sizeLabel = labelLooksLikeSize
      ? rawLabel
      : (formatFrameSizeLabel({
        width,
        height,
        unit: area?.unit || preview.unit || 'inch',
      }) || rawLabel);
    if (!sizeLabel || !/\d/.test(sizeLabel)) return;
    if (!isWebsiteSizeLikeLabel(sizeLabel)) return;
    const key = normalizeWebsiteSizeKey(sizeLabel);
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
 * Per-product size choices (variants first, else area-derived).
 * Prefer listWebsiteCatalogSizeChoices for Additional Variants / Combo.
 */
export function listAdditionalVariantChoices(product) {
  const fromVariants = listWebsiteVariantOptions(product)
    .filter((opt) => isWebsiteSizeLikeLabel(opt.optionLabel) || isWebsiteSizeLikeLabel(opt.label));
  if (fromVariants.length) {
    return { choices: fromVariants, source: 'variants' };
  }
  const fromAreas = listAreaDerivedSizeOptions(product);
  if (fromAreas.length) {
    return { choices: fromAreas, source: 'area_sizes' };
  }
  return { choices: [], source: 'none' };
}

/**
 * Catalog-wide website size dropdown for Additional Variants and Customized Combo.
 * Includes every size-like option from all active products (variants + area sizes).
 * Same size on different products stays as separate choices (different upload/preview rules).
 * Never hardcodes sizes — Admin catalog changes appear automatically.
 */
export function listWebsiteCatalogSizeChoices(products = []) {
  const list = Array.isArray(products) ? products : [];
  const choices = [];
  const seenValue = new Set();

  list.forEach((product) => {
    if (!product || product.isActive === false) return;
    const productId = String(product._id || '').trim();
    if (!productId) return;
    const productTitle = String(product.title || 'Product').trim() || 'Product';
    const sizeKeysOnProduct = new Set();

    listPrimaryWebsiteSizeOptions(product).forEach((opt) => {
      const sizeLabel = String(opt.optionLabel || opt.label || '').trim();
      if (!isWebsiteSizeLikeLabel(sizeLabel) || isExcludedWebsiteSizeLabel(sizeLabel)) return;
      const sizeKey = normalizeWebsiteSizeKey(sizeLabel);
      sizeKeysOnProduct.add(sizeKey);
      const value = `catalog:${productId}|variant|${opt.value}`;
      if (seenValue.has(value)) return;
      seenValue.add(value);
      choices.push({
        value,
        label: `${sizeLabel} — ${productTitle}`,
        shortLabel: sizeLabel,
        sizeLabel,
        sizeKey,
        productId,
        productTitle,
        variantValue: opt.value,
        variantId: opt.optionId || '',
        optionId: opt.optionId || '',
        optionLabel: opt.optionLabel,
        variantName: opt.variantName,
        source: 'variants',
        isAreaDerived: false,
        requiresImageUpload: Boolean(opt.requiresImageUpload),
        previewWidth: opt.previewWidth,
        previewHeight: opt.previewHeight,
        previewUnit: opt.previewUnit || 'inch',
        previewFrameImage: opt.previewFrameImage || '',
        previewInstructions: opt.previewInstructions || '',
      });
    });

    listAreaDerivedSizeOptions(product).forEach((opt) => {
      const sizeLabel = String(opt.optionLabel || opt.label || '').trim();
      if (isExcludedWebsiteSizeLabel(sizeLabel)) return;
      const sizeKey = normalizeWebsiteSizeKey(sizeLabel);
      // Prefer the real website variant when the same size already exists on this product.
      if (sizeKeysOnProduct.has(sizeKey)) return;
      sizeKeysOnProduct.add(sizeKey);
      const value = `catalog:${productId}|area|${opt.value}`;
      if (seenValue.has(value)) return;
      seenValue.add(value);
      choices.push({
        value,
        label: `${sizeLabel} — ${productTitle}`,
        shortLabel: sizeLabel,
        sizeLabel,
        sizeKey,
        productId,
        productTitle,
        variantValue: opt.value,
        variantId: '',
        optionId: '',
        optionLabel: opt.optionLabel,
        variantName: 'Size',
        source: 'area_size',
        isAreaDerived: true,
        requiresImageUpload: false,
        previewWidth: opt.previewWidth,
        previewHeight: opt.previewHeight,
        previewUnit: opt.previewUnit || 'inch',
        previewFrameImage: opt.previewFrameImage || '',
        previewInstructions: opt.previewInstructions || '',
      });
    });
  });

  choices.sort((a, b) => {
    const sizeCmp = String(a.sizeLabel).localeCompare(String(b.sizeLabel), undefined, {
      numeric: true,
      sensitivity: 'base',
    });
    if (sizeCmp) return sizeCmp;
    return String(a.productTitle).localeCompare(String(b.productTitle), undefined, { sensitivity: 'base' });
  });

  return { choices, source: 'catalog' };
}

export function findCatalogSizeChoice(choices, value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return (choices || []).find((choice) => choice.value === raw) || null;
}

export function groupCatalogSizeChoices(choices = []) {
  const groups = [];
  const bySize = new Map();
  (choices || []).forEach((choice) => {
    const key = choice.sizeKey || normalizeWebsiteSizeKey(choice.sizeLabel);
    if (!bySize.has(key)) {
      const group = {
        sizeKey: key,
        sizeLabel: choice.sizeLabel || choice.shortLabel || choice.label,
        choices: [],
      };
      bySize.set(key, group);
      groups.push(group);
    }
    bySize.get(key).choices.push(choice);
  });
  return groups;
}

/**
 * Unique size-only dropdown options for Create WhatsApp Order.
 * Labels are size names only (no product titles / IDs).
 * Underlying configs stay available for context-aware resolution.
 */
export function listUniqueWebsiteSizes(products = []) {
  const { choices } = listWebsiteCatalogSizeChoices(products);
  const byKey = new Map();
  choices.forEach((choice) => {
    const sizeKey = choice.sizeKey || normalizeWebsiteSizeKey(choice.sizeLabel);
    if (!sizeKey) return;
    if (!byKey.has(sizeKey)) {
      byKey.set(sizeKey, {
        sizeKey,
        sizeLabel: '',
        labels: [],
        configs: [],
      });
    }
    const entry = byKey.get(sizeKey);
    entry.configs.push(choice);
    if (choice.sizeLabel) entry.labels.push(choice.sizeLabel);
    if (choice.shortLabel) entry.labels.push(choice.shortLabel);
  });

  const sizes = [...byKey.values()].map((entry) => ({
    sizeKey: entry.sizeKey,
    sizeLabel: canonicalWebsiteSizeLabel(entry.labels) || entry.labels[0] || entry.sizeKey,
    configs: entry.configs,
    configCount: entry.configs.length,
  }));

  sizes.sort((a, b) => String(a.sizeLabel).localeCompare(String(b.sizeLabel), undefined, {
    numeric: true,
    sensitivity: 'base',
  }));

  return {
    sizes,
    uniqueCount: sizes.length,
    configCount: choices.length,
    source: 'catalog_unique',
  };
}

/**
 * Resolve a unique size to one product/variant configuration.
 * Prefer preferredProductIds (selected product / combo source) — never silent unrelated picks
 * when multiple products define the size with no preferred match.
 */
export function resolveWebsiteSizeConfig(sizeKeyOrLabel, {
  products = [],
  preferredProductIds = [],
  explicitProductId = '',
} = {}) {
  const sizeKey = normalizeWebsiteSizeKey(sizeKeyOrLabel);
  if (!sizeKey) {
    return { ok: false, reason: 'missing_size', ambiguous: false, config: null, candidates: [] };
  }
  const { sizes } = listUniqueWebsiteSizes(products);
  const entry = sizes.find((size) => size.sizeKey === sizeKey);
  if (!entry?.configs?.length) {
    return { ok: false, reason: 'unknown_size', ambiguous: false, config: null, candidates: [] };
  }

  const preferred = (Array.isArray(preferredProductIds) ? preferredProductIds : [])
    .map((id) => String(id || '').trim())
    .filter(Boolean);
  const explicit = String(explicitProductId || '').trim();

  if (explicit) {
    const match = entry.configs.find((config) => String(config.productId) === explicit);
    if (match) {
      return {
        ok: true,
        reason: 'explicit_product',
        ambiguous: false,
        config: match,
        candidates: entry.configs,
        sizeLabel: entry.sizeLabel,
        sizeKey: entry.sizeKey,
      };
    }
  }

  for (const productId of preferred) {
    const match = entry.configs.find((config) => String(config.productId) === productId);
    if (match) {
      return {
        ok: true,
        reason: 'preferred_product',
        ambiguous: false,
        config: match,
        candidates: entry.configs,
        sizeLabel: entry.sizeLabel,
        sizeKey: entry.sizeKey,
      };
    }
  }

  if (entry.configs.length === 1) {
    return {
      ok: true,
      reason: 'single_config',
      ambiguous: false,
      config: entry.configs[0],
      candidates: entry.configs,
      sizeLabel: entry.sizeLabel,
      sizeKey: entry.sizeKey,
    };
  }

  return {
    ok: false,
    reason: 'ambiguous_size',
    ambiguous: true,
    config: null,
    candidates: entry.configs,
    sizeLabel: entry.sizeLabel,
    sizeKey: entry.sizeKey,
  };
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
/**
 * Select Product plan:
 * - No variants → website defaults only (no size picker)
 * - Has variants → size comes from Personalized Single Photo Frame; product rules still apply
 */
export function buildCatalogSelectCustomizationPlan(product, sizeCatalogProduct, sizeKey = '', opts = {}) {
  const productOptionValue = String(opts.productOptionValue || '').trim();
  const empty = {
    textCustomFields: [],
    collageTemplates: [],
    defaultPhotoSlots: [],
    hasProductLevelUploads: false,
    hasVariantOnlyUploads: false,
    hasCollage: false,
    previewEnabled: false,
    nonSizeOptions: [],
    hasVariants: false,
    requiresSize: false,
    sizeKey: '',
    sizeLabel: '',
    orderVariantValue: '',
    orderVariantId: '',
    masterVariantValue: '',
    resolvedSize: null,
  };
  if (!product) return empty;

  const textCustomFields = getTextCustomFields(product);
  const collageTemplates = getCollageTemplates(product);
  const productLevel = buildProductLevelPhotoSlots(product);
  const variantOptions = listWebsiteVariantOptions(product);
  const hasVariants = variantOptions.length > 0;
  const requiresSize = hasVariants;
  const nonSizeOptions = variantOptions.filter(
    (opt) => !isWebsiteSizeLikeLabel(opt.optionLabel) && !isWebsiteSizeLikeLabel(opt.label),
  );
  const hasProductLevelUploads = productLevel.length > 0;
  const hasVariantUploads = variantOptions.some((option) => option.requiresImageUpload);
  const hasVariantOnlyUploads = !hasProductLevelUploads && hasVariantUploads;

  const resolved = resolveWebsiteSizeConfig(sizeKey, {
    products: sizeCatalogProduct ? [sizeCatalogProduct] : [],
    preferredProductIds: sizeCatalogProduct?._id ? [String(sizeCatalogProduct._id)] : [],
    explicitProductId: sizeCatalogProduct?._id ? String(sizeCatalogProduct._id) : '',
  });
  const sizeLabel = resolved.sizeLabel || resolved.config?.sizeLabel || '';
  const masterVariantValue = resolved.config?.variantValue || '';
  const masterSelected = masterVariantValue
    ? findVariantOption(sizeCatalogProduct, masterVariantValue)
    : null;
  const masterArea = variantAreaFromOption(masterSelected);

  const matchingProductOpt = sizeKey
    ? variantOptions.find((opt) => normalizeWebsiteSizeKey(opt.optionLabel || opt.label) === normalizeWebsiteSizeKey(sizeKey))
    : null;

  const templateProductOpt = matchingProductOpt
    || (hasVariantUploads
      ? variantOptions.find((option) => option.requiresImageUpload)
      : null);

  let defaultPhotoSlots = [];

  if (!requiresSize) {
    // No variants: load website-configured uploads/collage as-is.
    if (hasProductLevelUploads) {
      defaultPhotoSlots = buildWebsitePhotoSlotsForQuantity(product, 1, '', {
        includeProductLevel: true,
        includeVariantUpload: false,
      });
    }
  } else if (sizeKey) {
    if (matchingProductOpt?.requiresImageUpload || (hasProductLevelUploads && sizeKey)) {
      defaultPhotoSlots = buildWebsitePhotoSlotsForQuantity(
        product,
        1,
        matchingProductOpt?.value || '',
        {
          includeProductLevel: hasProductLevelUploads,
          includeVariantUpload: Boolean(matchingProductOpt?.requiresImageUpload),
        },
      );
    } else if (hasVariantOnlyUploads && templateProductOpt) {
      defaultPhotoSlots = buildWebsitePhotoSlotsForQuantity(product, 1, templateProductOpt.value, {
        includeProductLevel: false,
        includeVariantUpload: true,
      });
    } else if (resolved.config?.requiresImageUpload && sizeCatalogProduct && masterVariantValue) {
      defaultPhotoSlots = buildWebsitePhotoSlotsForQuantity(sizeCatalogProduct, 1, masterVariantValue, {
        includeProductLevel: false,
        includeVariantUpload: true,
      });
    }

    if (masterArea && defaultPhotoSlots.length) {
      const frameLabel = formatFrameSizeLabel(masterArea) || sizeLabel;
      defaultPhotoSlots = defaultPhotoSlots.map((slot) => ({
        ...slot,
        sizeLabel: frameLabel || slot.sizeLabel,
        frameImage: masterArea.frameImage || slot.frameImage || '',
        allowPreview: true,
        variantLabel: sizeLabel || slot.variantLabel || '',
        area: {
          ...(slot.area || {}),
          width: masterArea.width,
          height: masterArea.height,
          unit: masterArea.unit || slot.area?.unit || 'inch',
          frameImage: masterArea.frameImage || slot.area?.frameImage || '',
          label: frameLabel || slot.area?.label || slot.label,
        },
      }));
    }
  }

  const orderVariantValue = productOptionValue
    ? (sizeLabel ? `${productOptionValue} · Size: ${sizeLabel}` : productOptionValue)
    : (matchingProductOpt?.value || (sizeLabel ? `Size: ${sizeLabel}` : ''));
  const orderVariantId = matchingProductOpt?.optionId
    || resolved.config?.variantId
    || resolved.config?.optionId
    || '';

  return {
    textCustomFields,
    collageTemplates,
    defaultPhotoSlots,
    hasProductLevelUploads,
    hasVariantOnlyUploads,
    hasCollage: collageTemplates.length > 0,
    previewEnabled: isProductPreviewEnabled(product) || Boolean(masterArea),
    nonSizeOptions,
    hasVariants,
    requiresSize,
    sizeKey: resolved.sizeKey || normalizeWebsiteSizeKey(sizeKey) || '',
    sizeLabel,
    orderVariantValue,
    orderVariantId,
    masterVariantValue,
    resolvedSize: resolved.ok ? resolved : null,
  };
}

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

/**
 * Area-derived catalog size → upload slots for that size only.
 * Multi-size combo products (e.g. 12*8 + 8*6 areas) must not load unrelated sizes.
 */
export function buildAreaDerivedSizeSlots(product, sizeLabel, quantity) {
  const label = String(sizeLabel || '').trim();
  if (!label || !product) return [];
  const sizeKey = normalizeWebsiteSizeKey(label);
  const productLevel = buildProductLevelPhotoSlots(product);
  const matching = productLevel.filter((slot) => {
    const keys = [
      normalizeWebsiteSizeKey(slot?.area?.label),
      normalizeWebsiteSizeKey(slot?.label),
      normalizeWebsiteSizeKey(slot?.sizeLabel),
      normalizeWebsiteSizeKey(formatFrameSizeLabel(slot?.area || {})),
    ].filter(Boolean);
    return keys.includes(sizeKey);
  });
  const areaChoices = listAreaDerivedSizeOptions(product);
  // Single-size products with non-size area labels (e.g. "Upload Photo here") fall back
  // to all product-level slots. Multi-size products keep only matching areas.
  const useSlots = matching.length
    ? matching
    : (areaChoices.length <= 1 ? productLevel : []);
  if (!useSlots.length) return [];

  const qty = Math.max(1, Number(quantity) || 1);
  const expanded = [];
  for (let unit = 1; unit <= qty; unit += 1) {
    useSlots.forEach((slot, index) => {
      expanded.push({
        ...slot,
        unitIndex: unit,
        variantLabel: label,
        sizeLabel: slot.sizeLabel || label,
        label: qty > 1
          ? `${label} — Unit ${unit}${useSlots.length > 1 ? ` · ${slot.area?.label || slot.label}` : ''}`
          : (useSlots.length > 1 ? `${label} — ${slot.label}` : label),
        slotKey: `area-size-${sizeKey}-u${unit}-${slot.slotKey || index}`,
        isAreaDerivedSize: true,
      });
    });
  }
  return expanded;
}

/** Slots for an Additional Variant / Combo size row. */
export function buildAdditionalVariantSlots(product, variantValue, quantity) {
  if (!variantValue || variantValue === ORDER_LOCAL_CUSTOM_VARIANT) {
    return [];
  }
  // Area-derived size choice (not a real website variant ID)
  if (String(variantValue).startsWith('AreaSize:')) {
    const sizeLabel = String(variantValue).replace(/^AreaSize:\s*/i, '').trim();
    return buildAreaDerivedSizeSlots(product, sizeLabel, quantity);
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
      // Variant option dims drive the editor even when product-level preview is off.
      allowPreview: Boolean(variantAreaFromOption(selected)) || isProductPreviewEnabled(product),
      area,
      variantLabel: label,
      unitIndex: index + 1,
      photo: null,
      reference: null,
    }));
  }
  return [];
}

/**
 * Count-driven photo slots for WhatsApp "Collage Photos" (main / background).
 * Size + dims come from the Personalized Single Photo Frame catalog — same as Select Product.
 */
export function buildCollageRolePhotoSlots({
  sizeCatalogProduct = null,
  sizeKey = '',
  count = 0,
  role = 'main',
  roleLabel = 'Main photo',
} = {}) {
  const qty = Math.max(0, Math.min(50, Number(count) || 0));
  const key = String(sizeKey || '').trim();
  if (!qty || !key || !sizeCatalogProduct) return [];

  const resolved = resolveWebsiteSizeConfig(key, {
    products: [sizeCatalogProduct],
    preferredProductIds: sizeCatalogProduct?._id ? [String(sizeCatalogProduct._id)] : [],
    explicitProductId: sizeCatalogProduct?._id ? String(sizeCatalogProduct._id) : '',
  });
  const sizeLabel = resolved.sizeLabel || resolved.config?.sizeLabel || key;
  const variantValue = resolved.config?.variantValue || (sizeLabel ? `Size: ${sizeLabel}` : '');
  const selected = variantValue ? findVariantOption(sizeCatalogProduct, variantValue) : null;
  const area = variantAreaFromOption(selected) || {
    label: sizeLabel,
    width: 1,
    height: 1,
    unit: 'inch',
    frameImage: sizeCatalogProduct?.customizationPreview?.frameImage || '',
    instructions: '',
  };
  const roleKey = String(role || 'main').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'main';
  const heading = String(roleLabel || 'Photo').trim() || 'Photo';

  return Array.from({ length: qty }, (_, index) => ({
    slotKey: `collage-${roleKey}-${key}-u${index + 1}`,
    section: 'collage_photos',
    storageKind: 'customer',
    storageLabel: 'Customer Photos',
    customFieldLabel: 'Customer Photos',
    label: qty > 1 ? `${heading} ${index + 1}` : heading,
    sizeLabel: formatFrameSizeLabel(area) || sizeLabel,
    frameImage: area.frameImage || '',
    instructions: area.instructions || '',
    // Main / background sections are optional; uploads are not forced at create.
    required: false,
    allowPreview: Boolean(variantAreaFromOption(selected)) || isProductPreviewEnabled(sizeCatalogProduct),
    area,
    variantLabel: sizeLabel,
    unitIndex: index + 1,
    collageRole: roleKey,
    photo: null,
    reference: null,
  }));
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
