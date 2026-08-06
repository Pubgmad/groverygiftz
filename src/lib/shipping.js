import { buildDeliveryEstimateText } from '@/lib/deliveryDate';

export const isTamilNadu = (state) => String(state || '').trim().toLowerCase() === 'tamil nadu';

export const getStateOverride = (delivery, state) => (delivery?.stateOverrides || []).find((row) => String(row.state || '').trim().toLowerCase() === String(state || '').trim().toLowerCase());

export function resolveItemDelivery(item, state, settings = {}) {
  const delivery = item?.delivery || {};
  if (!delivery.useCustomDelivery) return null;
  const override = getStateOverride(delivery, state);
  if (override?.state) return { cost: Number(override.shippingCost || 0), estimate: override.deliveryEstimate || '' };
  if (isTamilNadu(state)) return { cost: Number(delivery.tamilNaduShippingCost || 0), estimate: delivery.tamilNaduDeliveryEstimate || settings.tamilNaduDeliveryEstimate || 'Within 8 days' };
  return { cost: Number(delivery.otherStateShippingCost || 0), estimate: delivery.otherStateDeliveryEstimate || settings.otherStateDeliveryEstimate || '10-15 days' };
}

export function calculateCartShipping(items = [], state, settings = {}) {
  if (!state) return { cost: 0, estimate: 'Select state to see delivery estimate', hasCustomDelivery: false };
  let cost = 0;
  let hasStoreDefaultItem = false;
  let hasCustomDelivery = false;
  const estimates = [];

  items.forEach((item) => {
    const resolved = resolveItemDelivery(item, state, settings);
    if (resolved) {
      hasCustomDelivery = true;
      cost += resolved.cost * Number(item.quantity || 1);
      if (resolved.estimate) estimates.push(resolved.estimate);
    } else {
      hasStoreDefaultItem = true;
    }
  });

  if (hasStoreDefaultItem) {
    const storeCost = isTamilNadu(state) ? Number(settings.tamilNaduShippingCost || 0) : Number(settings.otherStateShippingCost || 0);
    cost += storeCost;
    estimates.push(isTamilNadu(state) ? settings.tamilNaduDeliveryEstimate : settings.otherStateDeliveryEstimate);
  }

  const uniqueEstimates = [...new Set(estimates.filter(Boolean))];
  const rawEstimate = uniqueEstimates.length > 1 ? uniqueEstimates.join(' / ') : (uniqueEstimates[0] || (isTamilNadu(state) ? 'Within 8 days' : '10-15 days'));
  return { cost, estimate: buildDeliveryEstimateText(rawEstimate, { fallbackDays: isTamilNadu(state) ? 8 : 15 }), hasCustomDelivery };
}
