const cleanTemplateId = (value) => (typeof value === 'string' && value.trim() ? value : value || undefined);
const toNumber = (value, fallback = 0) => (value === '' || value === null || value === undefined ? fallback : Number(value));
const normalizeOverrides = (rows = []) => Array.isArray(rows) ? rows.map((row) => ({ ...row, shippingCost: toNumber(row.shippingCost, 0) })) : [];

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
  if (Array.isArray(body.collageTemplates)) body.collageTemplates = body.collageTemplates.map((template) => ({ ...template, minImages: toNumber(template.minImages, 1), maxImages: toNumber(template.maxImages, 1) }));
  if (body.customizationPreview?.areas) body.customizationPreview = { ...body.customizationPreview, areas: body.customizationPreview.areas.map((area) => ({ ...area, width: toNumber(area.width, 0), height: toNumber(area.height, 0) })) };

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
