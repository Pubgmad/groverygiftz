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

function dispatchDateFromReadyYmd(ymd) {
  const [year, month, day] = String(ymd || '').split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
}

function hasCompleteConfirmationSchedule(orderDoc) {
  return Boolean(
    orderDoc?.confirmationSchedule?.expectedReadyDateIst
    && orderDoc?.confirmationSchedule?.estimatedDeliveryDateIst,
  );
}

/**
 * Persist confirmation schedule onto an order document (in-memory).
 * @param {object} orderDoc
 * @param {object} settings
 * @param {{ allowHistorical?: boolean }} [opts] allowHistorical backfills older paid orders
 */
export async function persistOrderConfirmationSchedule(orderDoc, settings = {}, opts = {}) {
  if (!orderDoc) return { ok: false, reason: 'missing_order' };

  if (hasCompleteConfirmationSchedule(orderDoc)) {
    let touched = false;
    if (!orderDoc.expectedDispatchDate && orderDoc.confirmationSchedule.expectedReadyDateIst) {
      const dispatchDate = dispatchDateFromReadyYmd(orderDoc.confirmationSchedule.expectedReadyDateIst);
      if (dispatchDate) {
        orderDoc.expectedDispatchDate = dispatchDate;
        touched = true;
      }
    }
    return {
      ok: true,
      schedule: orderDoc.confirmationSchedule,
      persisted: touched,
      reason: touched ? 'filled_missing_dispatch_date' : 'already_complete',
    };
  }

  const paidAt = orderDoc.paidAt ? new Date(orderDoc.paidAt) : null;
  if (
    !opts.allowHistorical
    && paidAt
    && !Number.isNaN(paidAt.getTime())
    && Date.now() - paidAt.getTime() > 24 * 60 * 60 * 1000
  ) {
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
    tamilNaduDeliveryDateIst: schedule.tamilNaduDeliveryDateIst,
    expectedReadyDateIst: schedule.expectedReadyDateIst,
    estimatedDeliveryDateIst: schedule.estimatedDeliveryDateIst,
    calendarVersion: schedule.calendarVersion,
    queueEpochIst: schedule.queueEpochIst,
    computedAt: schedule.computedAt,
  };
  if (!orderDoc.expectedDispatchDate) {
    orderDoc.expectedDispatchDate = dispatchDateFromReadyYmd(schedule.expectedReadyDateIst);
  }
  return { ok: true, schedule: orderDoc.confirmationSchedule, persisted: true };
}

/**
 * Atomic schedule attach — avoids race wipes from concurrent full-document saves
 * during Cashfree webhook + verify finalization.
 */
export async function ensureOrderConfirmationScheduleById(OrderModel, orderId, settings = {}, opts = {}) {
  if (!OrderModel || !orderId) return { ok: false, reason: 'missing_order' };
  const fresh = await OrderModel.findById(orderId);
  if (!fresh) return { ok: false, reason: 'missing_order' };
  if (fresh.paymentStatus !== 'paid') return { ok: false, reason: 'not_paid' };

  const result = await persistOrderConfirmationSchedule(fresh, settings, opts);
  if (!result.ok) return result;
  if (!result.persisted) {
    return { ok: true, schedule: result.schedule, persisted: false, reason: result.reason || 'already_complete', order: fresh };
  }

  const setFields = {
    confirmationSchedule: fresh.confirmationSchedule,
  };
  if (fresh.expectedDispatchDate) setFields.expectedDispatchDate = fresh.expectedDispatchDate;

  await OrderModel.updateOne(
    { _id: orderId },
    { $set: setFields },
  );

  const updated = await OrderModel.findById(orderId);
  return {
    ok: true,
    schedule: updated?.confirmationSchedule || fresh.confirmationSchedule,
    persisted: true,
    order: updated || fresh,
  };
}
