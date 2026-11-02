/**
 * Shared customer-photo / collage / variant-upload requirement checks.
 * Uses admin product configuration only — no hardcoded counts.
 */

export class CustomizationRequirementError extends Error {
  constructor(message) {
    super(message);
    this.name = 'CustomizationRequirementError';
    this.status = 400;
  }
}

export function getPreviewAreas(product) {
  const previewConfig = product?.customizationPreview || {};
  if (!previewConfig.enabled) return [];
  if (Array.isArray(previewConfig.areas) && previewConfig.areas.length > 0) {
    return previewConfig.areas.filter((area) => area.requiresImageUpload !== false);
  }
  if (Number(previewConfig.requiredImageCount || 0) > 0 || Number(previewConfig.maxImageCount || 0) > 0) {
    return [{
      label: previewConfig.title || 'Photo 1',
      required: Number(previewConfig.requiredImageCount || 0) > 0,
      requiresImageUpload: true,
    }];
  }
  return [];
}

export function countFilledUploads(value) {
  if (Array.isArray(value)) return value.filter((entry) => entry && typeof entry === 'object' && String(entry.url || '').trim()).length;
  if (value && typeof value === 'object' && String(value.url || '').trim()) return 1;
  return 0;
}

export function assertCustomizationRequirements(orderItems = [], productsById = {}) {
  for (const item of orderItems) {
    const product = productsById[String(item.product || item.productId || '')];
    if (!product) continue;
    const title = product.title || 'Product';
    const customFields = item.customFields || {};
    const areas = getPreviewAreas(product);
    if (areas.length > 0) {
      const photos = Array.isArray(customFields['Customer Photos']) ? customFields['Customer Photos'] : [];
      const filled = photos.filter((photo) => photo && String(photo.url || '').trim());
      const requiredAreas = areas.filter((area) => area.required !== false);
      const requiredCount = requiredAreas.length || Number(product.customizationPreview?.requiredImageCount || 0);
      const maxCount = Math.max(requiredCount, areas.length || Number(product.customizationPreview?.maxImageCount || requiredCount || 0));

      if (filled.length > maxCount) {
        throw new CustomizationRequirementError(`${title}: upload no more than ${maxCount} customer photo${maxCount === 1 ? '' : 's'}`);
      }
      if (requiredCount > 0 && filled.length < requiredCount) {
        throw new CustomizationRequirementError(`${title}: please upload ${requiredCount} customer photo${requiredCount === 1 ? '' : 's'}`);
      }
      // Prefer per-slot required labels when areas exist and photos are sparse-aligned by index.
      if (areas.length > 0 && photos.length > 0) {
        for (let index = 0; index < areas.length; index += 1) {
          const area = areas[index];
          if (area.required === false) continue;
          if (!photos[index]?.url) {
            // Sparse arrays from cart may be compacted (filledPhotos). Fall back to total count already checked.
            // Only fail per-slot when the payload length matches slot count (aligned).
            if (photos.length === areas.length) {
              throw new CustomizationRequirementError(`${title}: please upload a photo for "${area.label || `Photo ${index + 1}`}"`);
            }
          }
        }
      }
    }

    const collageTemplates = product.collageEnabled
      ? (product.collageTemplates || []).filter((template) => template?.label && template.isActive !== false)
      : [];
    for (const template of collageTemplates) {
      const group = (item.collageUploads || []).find((entry) => entry.label === template.label);
      const images = group?.images || [];
      const min = Math.max(0, Number(template.minImages || 0));
      const max = Math.max(min, Number(template.maxImages || min || 0));
      if (images.length < min || (max > 0 && images.length > max)) {
        throw new CustomizationRequirementError(`${title}: ${template.label} requires between ${min} and ${max} images`);
      }
    }

    const selectedLabels = String(item.variant || '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const variantUploads = customFields['Variant Label Uploads'] || {};
    for (const variant of product.variants || []) {
      for (const option of variant.options || []) {
        if (!option?.requiresImageUpload) continue;
        const selected = selectedLabels.some((label) => label === option.label || label.endsWith(`: ${option.label}`) || label.includes(option.label));
        if (!selected) continue;
        const upload = variantUploads[option.label] || variantUploads[variant.name];
        if (!upload?.url) {
          throw new CustomizationRequirementError(`${title}: please upload image for ${option.label}`);
        }
      }
    }
  }
}
