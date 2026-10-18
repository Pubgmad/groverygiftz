import { buildDeliveryEstimateText } from '@/lib/deliveryDate';

export const getEstimateBaseText = (estimate = '') => String(estimate || '').split(' - expected by ')[0].trim();

export const isOrderOutOfTamilNadu = (order) => String(order?.shippingAddress?.state || '').trim().toLowerCase() !== 'tamil nadu';

export function getOrderDeliveryEstimate(order, holidays = []) {
  if (String(order?.deliveryEstimate || '').includes(' - expected by ')) return order.deliveryEstimate;
  const baseEstimate = getEstimateBaseText(order?.deliveryEstimate);
  if (!baseEstimate) return order?.deliveryEstimate || null;
  if (!/\d/.test(baseEstimate)) return baseEstimate;
  return buildDeliveryEstimateText(baseEstimate, {
    startDate: order.paidAt || order.createdAt,
    holidays,
  });
}
