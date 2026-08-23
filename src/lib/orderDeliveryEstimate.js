import { buildDeliveryEstimateText } from '@/lib/deliveryDate';

export const getEstimateBaseText = (estimate = '') => String(estimate || '').split(' - expected by ')[0].trim();

export const isOrderOutOfTamilNadu = (order) => String(order?.shippingAddress?.state || '').trim().toLowerCase() !== 'tamil nadu';

export function getOrderDeliveryEstimate(order, holidays = []) {
  const baseEstimate = getEstimateBaseText(order?.deliveryEstimate);
  if (!baseEstimate) return order?.deliveryEstimate || null;
  return buildDeliveryEstimateText(baseEstimate, {
    startDate: order.paidAt || order.createdAt,
    fallbackDays: isOrderOutOfTamilNadu(order) ? 15 : 8,
    holidays,
  });
}
