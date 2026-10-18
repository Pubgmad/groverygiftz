import { buildDeliveryEstimateText } from '@/lib/deliveryDate';

export const DELIVERY_ESTIMATE_KEYS = ['tamilNaduDeliveryEstimate', 'otherStateDeliveryEstimate'];
export const DEFAULT_DELIVERY_ESTIMATES = { tamilNaduDeliveryEstimate: 'Within 8 days', otherStateDeliveryEstimate: '10-15 days' };

export function validateDeliveryEstimate(value) {
  if (typeof value !== 'string' || value.length > 80) return null;
  const text = value.trim().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ');
  const match = /^(within )?([1-9]\d{0,2})(?:\s*-\s*([1-9]\d{0,2}))? (working )?days?$/i.exec(text);
  if (!match) return null;
  const min = Number(match[2]);
  const max = Number(match[3] || min);
  if (max < min || max > 365) return null;
  return `${match[1] ? 'Within ' : ''}${min}${match[3] ? `-${max}` : ''} ${match[4] ? 'working ' : ''}${max === 1 ? 'day' : 'days'}`;
}

export function withDeliveryEstimateDefaults(settings = {}) {
  return { ...settings, ...Object.fromEntries(DELIVERY_ESTIMATE_KEYS.map((key) => [key, validateDeliveryEstimate(settings?.[key]) || DEFAULT_DELIVERY_ESTIMATES[key]])) };
}

export function getCentralDeliveryEstimate(settings, state) {
  const normalized = String(state || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normalized) return '';
  const key = normalized === 'tamil nadu' || normalized === 'tamilnadu' ? 'tamilNaduDeliveryEstimate' : 'otherStateDeliveryEstimate';
  return validateDeliveryEstimate(settings?.[key]) || '';
}

export function buildCurrentDeliveryEstimate(settings, state, options = {}) {
  if (!String(state || '').trim()) return 'Select state to see delivery estimate';
  const estimate = getCentralDeliveryEstimate(settings, state);
  return estimate ? buildDeliveryEstimateText(estimate, { ...options, holidays: settings?.deliveryHolidays || [] }) : 'Delivery estimate unavailable';
}

export function centralizeTemplateRates(rates, settings) {
  return (Array.isArray(rates) ? rates : []).map((row) => ({ ...row, deliveryEstimate: getCentralDeliveryEstimate(settings, row.state) }));
}

export function centralizeProductDeliveryEstimates(product, settings) {
  if (product?.delivery) {
    product.delivery = {
      ...product.delivery,
      tamilNaduDeliveryEstimate: getCentralDeliveryEstimate(settings, 'Tamil Nadu'),
      otherStateDeliveryEstimate: getCentralDeliveryEstimate(settings, 'Kerala'),
      ...(Array.isArray(product.delivery.stateOverrides) ? { stateOverrides: centralizeTemplateRates(product.delivery.stateOverrides, settings) } : {}),
    };
  }
  for (const variant of product?.variants || []) {
    for (const option of variant.options || []) {
      if (Array.isArray(option.stateOverrides)) option.stateOverrides = centralizeTemplateRates(option.stateOverrides, settings);
    }
  }
  return product;
}
