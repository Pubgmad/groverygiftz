import { computeConfirmationSchedule } from '@/lib/businessCalendar';
import { getCentralDeliveryEstimate } from '@/lib/centralDeliveryEstimates';

export function confirmationRecipientEmail(order = {}) {
  return String(order?.shippingAddress?.email || order?.guestEmail || '').trim().toLowerCase();
}

export function buildOrderConfirmationSchedule(order, settings = {}) {
  const placedAt = order?.paidAt || order?.createdAt;
  const destinationState = order?.shippingAddress?.state || '';
  return computeConfirmationSchedule({
    placedAt,
    destinationState,
    tamilNaduEstimate: getCentralDeliveryEstimate(settings, 'Tamil Nadu'),
    destinationEstimate: getCentralDeliveryEstimate(settings, destinationState),
    holidays: settings?.deliveryHolidays || [],
  });
}

export async function persistOrderConfirmationSchedule(orderDoc, settings = {}) {
  if (!orderDoc) return { ok: false, reason: 'missing_order' };
  if (orderDoc.confirmationSchedule?.expectedReadyDateIst && orderDoc.confirmationSchedule?.estimatedDeliveryDateIst) {
    return { ok: true, schedule: orderDoc.confirmationSchedule, persisted: false };
  }
  const paidAt = orderDoc.paidAt ? new Date(orderDoc.paidAt) : null;
  if (paidAt && !Number.isNaN(paidAt.getTime()) && Date.now() - paidAt.getTime() > 24 * 60 * 60 * 1000) {
    return { ok: false, reason: 'historical_order_without_snapshot' };
  }
  const schedule = buildOrderConfirmationSchedule(orderDoc, settings);
  if (!schedule.ok) return schedule;
  orderDoc.confirmationSchedule = {
    placedAt: schedule.placedAt,
    orderDateIst: schedule.orderDateIst,
    destinationState: schedule.destinationState,
    shippingEstimateLabel: schedule.shippingEstimateLabel,
    deliveryWorkingDays: schedule.deliveryWorkingDays,
    holidayAdjustmentApplied: schedule.holidayAdjustmentApplied,
    tamilNaduEstimateLabel: schedule.tamilNaduEstimateLabel,
    tamilNaduWorkingDays: schedule.tamilNaduWorkingDays,
    expectedReadyDateIst: schedule.expectedReadyDateIst,
    estimatedDeliveryDateIst: schedule.estimatedDeliveryDateIst,
    calendarVersion: schedule.calendarVersion,
    computedAt: schedule.computedAt,
  };
  if (!orderDoc.expectedDispatchDate) {
    const [year, month, day] = schedule.expectedReadyDateIst.split('-').map(Number);
    orderDoc.expectedDispatchDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
  }
  return { ok: true, schedule: orderDoc.confirmationSchedule, persisted: true };
}
