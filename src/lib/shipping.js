import { buildCurrentDeliveryEstimate, getCentralDeliveryEstimate } from '@/lib/centralDeliveryEstimates';

export const isTamilNadu = (state) => String(state || '').trim().toLowerCase() === 'tamil nadu';

export const getStateOverride = (delivery, state) => (delivery?.stateOverrides || []).find((row) => String(row.state || '').trim().toLowerCase() === String(state || '').trim().toLowerCase());

export function resolveItemDelivery(item, state, settings = {}) {
  const variantOverride = getStateOverride(item?.variantDelivery, state);
  if (variantOverride?.state) return { cost: Number(variantOverride.shippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
  const delivery = item?.delivery || {};
  if (!delivery.useCustomDelivery) return null;
  const override = getStateOverride(delivery, state);
  if (override?.state) return { cost: Number(override.shippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
  if (isTamilNadu(state)) return { cost: Number(delivery.tamilNaduShippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
  return { cost: Number(delivery.otherStateShippingCost || 0), estimate: getCentralDeliveryEstimate(settings, state) };
}

export function calculateCartShipping(items = [], state, settings = {}) {
  if (!state) return { cost: 0, estimate: 'Select state to see delivery estimate', hasCustomDelivery: false };
  let cost = 0;
  let hasStoreDefaultItem = false;
  let hasCustomDelivery = false;

  items.forEach((item) => {
    const resolved = resolveItemDelivery(item, state, settings);
    if (resolved) {
      hasCustomDelivery = true;
      cost += resolved.cost * Number(item.quantity || 1);
    } else {
      hasStoreDefaultItem = true;
    }
  });

  if (hasStoreDefaultItem) {
    const storeCost = isTamilNadu(state) ? Number(settings.tamilNaduShippingCost || 0) : Number(settings.otherStateShippingCost || 0);
    cost += storeCost;
  }

  return { cost, estimate: buildCurrentDeliveryEstimate(settings, state), hasCustomDelivery };
}
