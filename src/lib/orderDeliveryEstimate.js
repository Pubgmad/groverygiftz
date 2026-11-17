import { formatLongIstDate, istYmd } from '@/lib/businessCalendar';

export const getEstimateBaseText = (estimate = '') => String(estimate || '').split(' - expected by ')[0].trim();

export const isOrderOutOfTamilNadu = (order) => String(order?.shippingAddress?.state || '').trim().toLowerCase() !== 'tamil nadu';

export function getConfirmedScheduleDates(order) {
  const snap = order?.confirmationSchedule;
  // Snapshot may have ready date without delivery date (manual WhatsApp path).
  if (!snap?.expectedReadyDateIst && !snap?.estimatedDeliveryDateIst) return null;
  const estimatedDeliveryDate = snap?.estimatedDeliveryDateIst
    ? formatLongIstDate(snap.estimatedDeliveryDateIst)
    : '';
  const expectedReadyDate = snap?.expectedReadyDateIst
    ? formatLongIstDate(snap.expectedReadyDateIst)
    : '';
  if (!expectedReadyDate && !estimatedDeliveryDate) return null;
  return {
    expectedReadyDateIst: snap.expectedReadyDateIst || '',
    estimatedDeliveryDateIst: snap.estimatedDeliveryDateIst || '',
    expectedReadyDate,
    estimatedDeliveryDate,
    durationLabel: String(snap.shippingEstimateLabel || '').trim(),
  };
}

/**
 * Authoritative Admin Dispatch / Expected Ready display value.
 * Prefer persisted confirmation snapshot, then API display string, then expectedDispatchDate.
 * Does not invent dates for orders that genuinely lack schedule data.
 */
export function resolveAdminDispatchDisplay(order) {
  const snapYmd = String(order?.confirmationSchedule?.expectedReadyDateIst || '').trim();
  if (snapYmd) {
    const label = formatLongIstDate(snapYmd);
    if (label) return { label, ymd: snapYmd, source: 'confirmationSchedule.expectedReadyDateIst' };
  }

  const readyLabel = String(order?.expectedReadyDate || '').trim();
  if (readyLabel) {
    return { label: readyLabel, source: 'expectedReadyDate' };
  }

  const expected = order?.expectedDispatchDate;
  if (expected) {
    const date = expected instanceof Date ? expected : new Date(expected);
    if (!Number.isNaN(date.getTime())) {
      const ymd = istYmd(date);
      const label = ymd ? formatLongIstDate(ymd) : '';
      if (label) return { label, ymd, date, source: 'expectedDispatchDate' };
    }
  }

  return { label: '', empty: true, source: 'none' };
}

export function getOrderDeliveryEstimate(order, holidays = []) {
  void holidays;
  const dates = getConfirmedScheduleDates(order);
  if (dates?.estimatedDeliveryDate) {
    const label = dates.durationLabel || getEstimateBaseText(order?.deliveryEstimate);
    return label
      ? `${label} - expected by ${dates.estimatedDeliveryDate} (Sundays and government/public holidays skipped)`
      : dates.estimatedDeliveryDate;
  }
  return order?.deliveryEstimate || null;
}
