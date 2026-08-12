const hasUrl = (value) => value && typeof value === 'object' && typeof value.url === 'string' && value.url.trim();

export const isConfiguredImageAsset = (value) => hasUrl(value);

export const isImageAsset = (asset) => {
  const type = String(asset?.type || '').toLowerCase();
  const url = String(asset?.url || '').toLowerCase();
  return type.startsWith('image/') || /\.(png|jpe?g|webp|gif|avif|svg)(\?|#|$)/.test(url) || url.startsWith('data:image/');
};

const normalizeAsset = (asset, caption) => {
  if (!asset) return null;
  if (typeof asset === 'string') {
    return asset.trim() ? { url: asset, name: caption, caption, type: 'image' } : null;
  }
  if (!hasUrl(asset)) return null;
  return {
    url: asset.url,
    name: asset.name || caption,
    type: asset.type || '',
    caption,
  };
};

const pushSection = (sections, label, assets) => {
  const normalized = (assets || []).map((asset, index) => normalizeAsset(asset, asset?.caption || `${label} ${index + 1}`)).filter(Boolean);
  if (normalized.length > 0) sections.push({ label, items: normalized });
};

const collectCustomFieldSections = (sections, customFields) => {
  if (!customFields || typeof customFields !== 'object') return;

  Object.entries(customFields).forEach(([label, value]) => {
    if (label === 'Variant Label Uploads' && value && typeof value === 'object' && !Array.isArray(value)) {
      Object.entries(value).forEach(([variantLabel, upload]) => {
        const asset = normalizeAsset(upload, upload?.label || variantLabel);
        if (asset) pushSection(sections, `Variant: ${upload?.label || variantLabel}`, [asset]);
      });
      return;
    }

    if (Array.isArray(value)) {
      pushSection(sections, label, value);
      return;
    }

    if (isConfiguredImageAsset(value)) {
      pushSection(sections, label, [value]);
      return;
    }

    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([childLabel, childValue]) => {
        if (Array.isArray(childValue)) pushSection(sections, `${label}: ${childLabel}`, childValue);
        else if (isConfiguredImageAsset(childValue)) pushSection(sections, `${label}: ${childValue.label || childLabel}`, [childValue]);
      });
    }
  });
};

const collectPreviewSections = (sections, preview) => {
  const previews = Array.isArray(preview?.previews) ? preview.previews : [];

  if (isConfiguredImageAsset(preview?.uploadedFile)) {
    pushSection(sections, 'Uploaded photo', [{ ...preview.uploadedFile, caption: 'Original upload' }]);
  }

  previews.forEach((entry, index) => {
    const label = entry.areaLabel || `Preview ${index + 1}`;
    const assets = [];
    if (entry.uploadedFile?.url) assets.push({ ...entry.uploadedFile, caption: 'Original upload' });
    if (entry.finalPreviewImage?.url) assets.push({ ...entry.finalPreviewImage, caption: 'Final saved preview' });
    else if (entry.finalPreviewDataUrl) assets.push({ url: entry.finalPreviewDataUrl, type: 'image/jpeg', caption: 'Final saved preview', name: `${label} final preview` });
    pushSection(sections, `Preview: ${label}`, assets);
  });
};

export const getConfiguredImageSections = (item, { includeCollage = false, includeProductImages = true } = {}) => {
  const sections = [];

  collectCustomFieldSections(sections, item?.customFields);
  collectPreviewSections(sections, item?.customizationPreview);

  if (includeCollage && Array.isArray(item?.collageUploads)) {
    item.collageUploads.forEach((group) => pushSection(sections, `Collage: ${group.label || 'Photos'}`, group.images || []));
  }

  if (includeProductImages) {
    const productImages = Array.isArray(item?.images) && item.images.length > 0 ? item.images : [item?.image].filter(Boolean);
    pushSection(sections, 'Product images', productImages.map((url, index) => ({ url, type: 'image', caption: `Product image ${index + 1}` })));
  }

  return sections;
};
