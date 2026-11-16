import {
  addWorkingDaysFromOrderDate,
  formatLongIstDate,
  isNonWorkingYmd,
  parseYmd,
} from '@/lib/businessCalendar';

/**
 * Manual WhatsApp orders: Expected Delivery = selected dispatch + 2 eligible working days.
 * Dispatch date is Day 0 (not counted). Sundays and Admin holidays are skipped.
 * Does not apply website continuous-queue / holiday-+1 placement rules.
 */
export function expectedDeliveryFromDispatchYmd(dispatchYmd, holidays = []) {
  const ymd = String(dispatchYmd || '').trim();
  if (!parseYmd(ymd)) return { ok: false, reason: 'invalid_dispatch_date' };
  if (isNonWorkingYmd(ymd, holidays)) {
    return { ok: false, reason: 'dispatch_on_non_working_day' };
  }
  const deliveryYmd = addWorkingDaysFromOrderDate(ymd, 2, holidays);
  if (!deliveryYmd || isNonWorkingYmd(deliveryYmd, holidays)) {
    return { ok: false, reason: 'delivery_calculation_failed' };
  }
  return {
    ok: true,
    dispatchYmd: ymd,
    deliveryYmd,
    dispatchLabel: formatLongIstDate(ymd),
    deliveryLabel: formatLongIstDate(deliveryYmd),
  };
}
