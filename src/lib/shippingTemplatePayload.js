const toNumber = (value, fallback = 0) => (value === '' || value === null || value === undefined ? fallback : Number(value));

export function sanitizeShippingTemplatePayload(payload = {}) {
  return {
    name: String(payload.name || '').trim(),
    description: payload.description || '',
    rates: Array.isArray(payload.rates)
      ? payload.rates.map((row) => ({ ...row, shippingCost: toNumber(row.shippingCost, 0) }))
      : [],
    isActive: payload.isActive !== false,
  };
}