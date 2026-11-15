import { formatLongIstDate } from '@/lib/businessCalendar';

export const getEstimateBaseText = (estimate = '') => String(estimate || '').split(' - expected by ')[0].trim();

export const isOrderOutOfTamilNadu = (order) => String(order?.shippingAddress?.state || '').trim().toLowerCase() !== 'tamil nadu';

export function getConfirmedScheduleDates(order) {
  const snap = order?.confirmationSchedule;
  if (!snap?.estimatedDeliveryDateIst) return null;
  const estimatedDeliveryDate = formatLongIstDate(snap.estimatedDeliveryDateIst);
  const expectedReadyDate = formatLongIstDate(snap.expectedReadyDateIst);
  if (!estimatedDeliveryDate) return null;
  return {
    expectedReadyDateIst: snap.expectedReadyDateIst || '',
    estimatedDeliveryDateIst: snap.estimatedDeliveryDateIst,
    expectedReadyDate,
    estimatedDeliveryDate,
    durationLabel: String(snap.shippingEstimateLabel || '').trim(),
  };
}

export function getOrderDeliveryEstimate(order, holidays = []) {
  const dates = getConfirmedScheduleDates(order);
  if (dates?.estimatedDeliveryDate) {
    const label = dates.durationLabel || getEstimateBaseText(order?.deliveryEstimate);
    return label
      ? `${label} - expected by ${dates.estimatedDeliveryDate} (Sundays and government/public holidays skipped)`
      : dates.estimatedDeliveryDate;
  }
  return order?.deliveryEstimate || null;
}
