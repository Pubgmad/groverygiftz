import ShippingTemplate from '@/models/ShippingTemplate';

const templateIdOf = (value) => {
  if (!value) return '';
  if (typeof value === 'object' && value._id) return String(value._id);
  return String(value);
};

const templateRatesToOverrides = (rates = []) => (Array.isArray(rates) ? rates : []).map((row) => ({
  state: row.state || '',
  shippingCost: Number(row.shippingCost || 0),
  deliveryEstimate: row.deliveryEstimate || '',
}));

const collectTemplateIds = (product) => {
  const ids = new Set();
  const productTemplateId = templateIdOf(product?.delivery?.shippingTemplate);
  if (productTemplateId) ids.add(productTemplateId);
  (product?.variants || []).forEach((variant) => {
    (variant?.options || []).forEach((option) => {
      const optionTemplateId = templateIdOf(option?.shippingTemplate);
      if (optionTemplateId) ids.add(optionTemplateId);
    });
  });
  return ids;
};

export async function hydrateProductShippingTemplates(products = []) {
  const list = Array.isArray(products) ? products : [products];
  const ids = [...list.reduce((set, product) => {
    collectTemplateIds(product).forEach((id) => set.add(id));
    return set;
  }, new Set())];

  if (!ids.length) return products;
  const templates = await ShippingTemplate.find({ _id: { $in: ids } }).lean();
  const templatesById = new Map(templates.map((template) => [String(template._id), templateRatesToOverrides(template.rates)]));

  list.forEach((product) => {
    const productTemplateId = templateIdOf(product?.delivery?.shippingTemplate);
    if (productTemplateId && templatesById.has(productTemplateId)) {
      product.delivery = {
        ...(product.delivery || {}),
        stateOverrides: templatesById.get(productTemplateId).map((row) => ({ ...row })),
      };
    }

    (product?.variants || []).forEach((variant) => {
      (variant?.options || []).forEach((option) => {
        const optionTemplateId = templateIdOf(option?.shippingTemplate);
        if (optionTemplateId && templatesById.has(optionTemplateId)) {
          option.stateOverrides = templatesById.get(optionTemplateId).map((row) => ({ ...row }));
        }
      });
    });
  });

  return products;
}