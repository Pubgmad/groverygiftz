const cleanTemplateId = (value) => (typeof value === 'string' && value.trim() ? value : value || undefined);

export function sanitizeProductPayload(payload = {}) {
  const body = { ...payload };

  if (body.delivery) {
    body.delivery = { ...body.delivery };
    if (!cleanTemplateId(body.delivery.shippingTemplate)) delete body.delivery.shippingTemplate;
  }

  if (Array.isArray(body.variants)) {
    body.variants = body.variants.map((variant) => ({
      ...variant,
      options: Array.isArray(variant.options)
        ? variant.options.map((option) => {
            const nextOption = { ...option };
            if (!cleanTemplateId(nextOption.shippingTemplate)) delete nextOption.shippingTemplate;
            return nextOption;
          })
        : [],
    }));
  }

  return body;
}
