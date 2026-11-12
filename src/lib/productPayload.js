import { normalizePreview3dConfig } from '@/lib/preview3d';

const cleanTemplateId = (value) => (typeof value === 'string' && value.trim() ? value : value || undefined);
const toNumber = (value, fallback = 0) => (value === '' || value === null || value === undefined ? fallback : Number(value));
const normalizeOverrides = (rows = []) => Array.isArray(rows) ? rows.map((row) => ({ ...row, shippingCost: toNumber(row.shippingCost, 0) })) : [];

function normalizeFaqs(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({
      question: String(row?.question || '').trim(),
      answer: String(row?.answer || ''),
      sortOrder: toNumber(row?.sortOrder, index),
      isActive: row?.isActive !== false,
    }))
    .filter((row) => row.question || String(row.answer || '').trim());
}

function normalizeMakingVideos(rows = []) {
  if (!Array.isArray(rows)) return [];
  return rows
    .map((row, index) => ({
      url: String(row?.url || '').trim(),
      name: String(row?.name || ''),
      poster: String(row?.poster || ''),
      title: String(row?.title || '').trim(),
      description: String(row?.description || '').trim(),
      sortOrder: toNumber(row?.sortOrder, index),
      isActive: row?.isActive !== false,
    }))
    .filter((row) => row.url);
}

export function sanitizeProductPayload(payload = {}) {
  const body = { ...payload };

  if (body.delivery) {
    body.delivery = { ...body.delivery };
    if (!cleanTemplateId(body.delivery.shippingTemplate)) delete body.delivery.shippingTemplate;
    body.delivery.tamilNaduShippingCost = toNumber(body.delivery.tamilNaduShippingCost, 0);
    body.delivery.otherStateShippingCost = toNumber(body.delivery.otherStateShippingCost, 0);
    body.delivery.stateOverrides = normalizeOverrides(body.delivery.stateOverrides);
  }

  body.regularPrice = toNumber(body.regularPrice, 0);
  body.salePrice = toNumber(body.salePrice, 0);
  body.stock = toNumber(body.stock, 0);
  if (body.giftWrap) body.giftWrap = { ...body.giftWrap, price: toNumber(body.giftWrap.price, 0) };
  body.customerNotesEnabled = body.customerNotesEnabled !== false;
  if (body.aboutThisProduct) {
    body.aboutThisProduct = {
      instructions: String(body.aboutThisProduct.instructions || ''),
      deliveryNotes: String(body.aboutThisProduct.deliveryNotes || ''),
      hideDescription: !!body.aboutThisProduct.hideDescription,
      hideInstructions: !!body.aboutThisProduct.hideInstructions,
      hideDelivery: !!body.aboutThisProduct.hideDelivery,
    };
  }
  if (body.faqs !== undefined) body.faqs = normalizeFaqs(body.faqs);
  if (body.makingVideos !== undefined) body.makingVideos = normalizeMakingVideos(body.makingVideos);
  if (body.makingVideosSection) {
    body.makingVideosSection = {
      enabled: body.makingVideosSection.enabled !== false,
      heading: String(body.makingVideosSection.heading || '').trim(),
    };
  }
  if (body.stockAlert) {
    const lowStockThreshold = Math.max(1, toNumber(body.stockAlert.lowStockThreshold, 5));
    const mediumStockThreshold = Math.max(
      lowStockThreshold + 1,
      toNumber(body.stockAlert.mediumStockThreshold, 20),
    );
    body.stockAlert = {
      enabled: body.stockAlert.enabled !== false,
      lowStockThreshold,
      mediumStockThreshold,
      lowStockLabel: String(body.stockAlert.lowStockLabel || ''),
      mediumStockLabel: String(body.stockAlert.mediumStockLabel || ''),
      highStockLabel: String(body.stockAlert.highStockLabel || ''),
      soldOutLabel: String(body.stockAlert.soldOutLabel || ''),
    };
  }
  if (body.purchaseActivity) {
    const unit = String(body.purchaseActivity.timeUnit || body.purchaseActivity.periodUnit || 'hours').toLowerCase() === 'days' ? 'days' : 'hours';
    body.purchaseActivity = {
      enabled: !!body.purchaseActivity.enabled,
      purchaseCount: Math.max(0, toNumber(body.purchaseActivity.purchaseCount, 0)),
      timeQuantity: Math.max(1, toNumber(body.purchaseActivity.timeQuantity ?? body.purchaseActivity.periodDays, unit === 'days' ? 1 : 24)),
      timeUnit: unit,
      labelTemplate: String(body.purchaseActivity.labelTemplate || ''),
    };
  }
  if (body.productInterest) {
    const minViews = Math.max(1, toNumber(body.productInterest.minViews, 250));
    const maxViews = Math.max(minViews + 1, toNumber(body.productInterest.maxViews, 1000));
    body.productInterest = {
      enabled: body.productInterest.enabled !== false,
      minViews,
      maxViews,
      labelTemplate: String(body.productInterest.labelTemplate || ''),
    };
  }
  if (body.preview3d) {
    const normalized = normalizePreview3dConfig(body.preview3d);
    body.preview3d = {
      ...normalized,
      profileId: normalized.profileId || null,
      assetId: normalized.assetId || null,
      retailReadiness: normalized.retailReadiness || 'prototype',
      camera: {
        minDistance: normalized.camera.minDistance,
        maxDistance: normalized.camera.maxDistance,
        autoRotate: normalized.camera.autoRotate === true,
        targetY: normalized.camera.targetY === null || normalized.camera.targetY === undefined
          ? null
          : Number(normalized.camera.targetY),
      },
      dimensions: {
        width: normalized.dimensions?.width ?? null,
        height: normalized.dimensions?.height ?? null,
        depth: normalized.dimensions?.depth ?? null,
        unit: normalized.dimensions?.unit || 'inch',
        modelScale: normalized.dimensions?.modelScale ?? null,
      },
      variantOverrides: Array.isArray(normalized.variantOverrides)
        ? normalized.variantOverrides.map((row) => ({
          ...row,
          assetId: row.assetId || null,
          profileId: row.profileId || null,
        }))
        : [],
      surfaces: Array.isArray(normalized.surfaces) ? normalized.surfaces : [],
      legacySequentialGlb: normalized.legacySequentialGlb === true,
    };
  }
  if (Array.isArray(body.collageTemplates)) body.collageTemplates = body.collageTemplates.map((template) => ({ ...template, minImages: toNumber(template.minImages, 1), maxImages: toNumber(template.maxImages, 1) }));
  if (body.customizationPreview) {
    const preview = { ...body.customizationPreview };
    preview.shortGuidance = String(preview.shortGuidance || '');
    if (Array.isArray(preview.areas)) {
      preview.areas = preview.areas.map((area) => ({ ...area, width: toNumber(area.width, 0), height: toNumber(area.height, 0) }));
    }
    body.customizationPreview = preview;
  }

  if (Array.isArray(body.variants)) {
    body.variants = body.variants.map((variant) => ({
      ...variant,
      options: Array.isArray(variant.options)
        ? variant.options.map((option) => {
            const nextOption = { ...option };
            if (!cleanTemplateId(nextOption.shippingTemplate)) delete nextOption.shippingTemplate;
            nextOption.priceAdjustment = toNumber(nextOption.priceAdjustment ?? nextOption.price, 0);
            nextOption.regularPrice = toNumber(nextOption.regularPrice, 0);
            nextOption.salePrice = toNumber(nextOption.salePrice, 0);
            if (nextOption.stock !== undefined) nextOption.stock = toNumber(nextOption.stock, 0);
            nextOption.previewWidth = toNumber(nextOption.previewWidth, 0);
            nextOption.previewHeight = toNumber(nextOption.previewHeight, 0);
            nextOption.stateOverrides = normalizeOverrides(nextOption.stateOverrides);
            return nextOption;
          })
        : [],
    }));
  }

  return body;
}
