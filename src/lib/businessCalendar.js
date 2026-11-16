const TIME_ZONE = 'Asia/Kolkata';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** Continuous-queue calendar. Epoch is the recurrence boundary (s(epoch)=base(epoch)), not a backlog reset. */
export const CONFIRMATION_CALENDAR_VERSION = 'continuous-queue-v1';
export const CONTINUOUS_QUEUE_EPOCH_IST = '2026-11-15';

const pad2 = (value) => String(value).padStart(2, '0');

export function istYmd(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

export function parseYmd(value) {
  const text = String(value || '').trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const utc = Date.UTC(year, month - 1, day);
  const check = new Date(utc);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() + 1 !== month || check.getUTCDate() !== day) return null;
  return { year, month, day, ymd: text };
}

export function addCalendarDaysYmd(ymd, days) {
  const parsed = parseYmd(ymd);
  if (!parsed) return '';
  const next = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day + Number(days || 0)));
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

export function weekdayUtcYmd(ymd) {
  const parsed = parseYmd(ymd);
  if (!parsed) return -1;
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day)).getUTCDay();
}

export function isSundayYmd(ymd) {
  return weekdayUtcYmd(ymd) === 0;
}

export function holidayYmd(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (parseYmd(trimmed)) return trimmed;
    const [datePart] = trimmed.split('|');
    if (parseYmd(datePart?.trim())) return datePart.trim();
  }
  if (value instanceof Date) return istYmd(value);
  if (typeof value === 'object') return holidayYmd(value.date || value.value || value.day || '');
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? '' : istYmd(date);
}

export function holidayName(value) {
  if (!value || typeof value !== 'object' || value instanceof Date) return '';
  return String(value.name || value.description || value.label || '').trim();
}

export function normalizeHolidaySet(holidays = []) {
  return new Set((Array.isArray(holidays) ? holidays : []).map(holidayYmd).filter(Boolean));
}

export function isNonWorkingYmd(ymd, holidays = []) {
  if (!parseYmd(ymd)) return false;
  if (isSundayYmd(ymd)) return true;
  return normalizeHolidaySet(holidays).has(ymd);
}

export function addWorkingDaysFromOrderDate(orderDateYmd, workingDays, holidays = []) {
  const total = Number(workingDays);
  if (!parseYmd(orderDateYmd) || !Number.isInteger(total) || total < 1) return '';
  let current = orderDateYmd;
  let added = 0;
  while (added < total) {
    current = addCalendarDaysYmd(current, 1);
    if (!current) return '';
    if (!isNonWorkingYmd(current, holidays)) added += 1;
  }
  return current;
}

export function subtractWorkingDaysFromDate(ymd, workingDays, holidays = []) {
  const total = Number(workingDays);
  if (!parseYmd(ymd) || !Number.isInteger(total) || total < 1) return '';
  let current = ymd;
  let removed = 0;
  while (removed < total) {
    current = addCalendarDaysYmd(current, -1);
    if (!current) return '';
    if (!isNonWorkingYmd(current, holidays)) removed += 1;
  }
  return current;
}

export function parseMaxWorkingDays(estimateText) {
  const text = String(estimateText || '').trim().replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ');
  const match = /^(within )?([1-9]\d{0,2})(?:\s*-\s*([1-9]\d{0,2}))? (working )?days?$/i.exec(text);
  if (!match) return null;
  const min = Number(match[2]);
  const max = Number(match[3] || min);
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min || max > 365) return null;
  return max;
}

export function formatLongIstDate(ymd) {
  const parsed = parseYmd(ymd);
  if (!parsed) return '';
  return `${MONTHS[parsed.month - 1]} ${parsed.day}, ${parsed.year}`;
}

export function formatShortIstDate(ymd) {
  const parsed = parseYmd(ymd);
  if (!parsed) return '';
  const date = new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 6, 30));
  return new Intl.DateTimeFormat('en-IN', {
    timeZone: TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function baseDeliveryYmd(orderDateYmd, estimateWorkingDays, holidays = []) {
  const days = Number(estimateWorkingDays);
  if (!parseYmd(orderDateYmd) || !Number.isInteger(days) || days < 1) return '';
  const adjusted = days + (isNonWorkingYmd(orderDateYmd, holidays) ? 1 : 0);
  return addWorkingDaysFromOrderDate(orderDateYmd, adjusted, holidays);
}

/**
 * Continuous queue: every calendar order-date (including empty days) takes the next
 * eligible working delivery slot from CONTINUOUS_QUEUE_EPOCH_IST forward.
 * Dates before the epoch use base delivery only.
 */
export function continuousDeliveryYmd(orderDateYmd, estimateWorkingDays, holidays = [], epochYmd = CONTINUOUS_QUEUE_EPOCH_IST) {
  if (!parseYmd(orderDateYmd) || !parseYmd(epochYmd)) return '';
  if (orderDateYmd < epochYmd) {
    return baseDeliveryYmd(orderDateYmd, estimateWorkingDays, holidays);
  }

  let delivery = baseDeliveryYmd(epochYmd, estimateWorkingDays, holidays);
  if (!delivery) return '';
  if (orderDateYmd === epochYmd) return delivery;

  for (let current = addCalendarDaysYmd(epochYmd, 1); current && current <= orderDateYmd; current = addCalendarDaysYmd(current, 1)) {
    const base = baseDeliveryYmd(current, estimateWorkingDays, holidays);
    const nextSlot = addWorkingDaysFromOrderDate(delivery, 1, holidays);
    if (!base || !nextSlot) return '';
    delivery = base > nextSlot ? base : nextSlot;
  }
  return delivery;
}

function countWorkingDaysAfter(orderDateYmd, throughYmd, holidays = []) {
  if (!parseYmd(orderDateYmd) || !parseYmd(throughYmd) || throughYmd <= orderDateYmd) return 0;
  let count = 0;
  for (let current = addCalendarDaysYmd(orderDateYmd, 1); current && current <= throughYmd; current = addCalendarDaysYmd(current, 1)) {
    if (!isNonWorkingYmd(current, holidays)) count += 1;
  }
  return count;
}

export function computeConfirmationSchedule({
  placedAt,
  destinationState,
  tamilNaduEstimate,
  destinationEstimate,
  holidays = [],
  queueEpochIst = CONTINUOUS_QUEUE_EPOCH_IST,
} = {}) {
  const placedDate = placedAt instanceof Date ? placedAt : new Date(placedAt);
  const orderDateIst = istYmd(placedDate);
  if (!orderDateIst) return { ok: false, reason: 'invalid_order_date' };

  const tnLabel = String(tamilNaduEstimate || '').trim();
  const destLabel = String(destinationEstimate || '').trim();
  const tnDays = parseMaxWorkingDays(tnLabel);
  const destDays = parseMaxWorkingDays(destLabel);
  if (!tnDays || !destDays) return { ok: false, reason: 'missing_delivery_estimate' };

  const holidayAdjustmentApplied = isNonWorkingYmd(orderDateIst, holidays);
  const tamilNaduWorkingDays = tnDays + (holidayAdjustmentApplied ? 1 : 0);
  const deliveryWorkingDays = destDays + (holidayAdjustmentApplied ? 1 : 0);

  // Raw Admin TN span must leave room for dispatch = delivery − 2 working days.
  if (tnDays < 3) return { ok: false, reason: 'tn_dispatch_offset_invalid' };

  const tamilNaduDeliveryDateIst = continuousDeliveryYmd(orderDateIst, tnDays, holidays, queueEpochIst);
  const estimatedDeliveryDateIst = continuousDeliveryYmd(orderDateIst, destDays, holidays, queueEpochIst);
  if (!tamilNaduDeliveryDateIst || !estimatedDeliveryDateIst) {
    return { ok: false, reason: 'date_calculation_failed' };
  }

  const expectedReadyDateIst = subtractWorkingDaysFromDate(tamilNaduDeliveryDateIst, 2, holidays);
  if (!expectedReadyDateIst) return { ok: false, reason: 'date_calculation_failed' };

  if (isNonWorkingYmd(expectedReadyDateIst, holidays) || isNonWorkingYmd(estimatedDeliveryDateIst, holidays)) {
    return { ok: false, reason: 'landed_on_non_working_day' };
  }
  if (isNonWorkingYmd(tamilNaduDeliveryDateIst, holidays)) {
    return { ok: false, reason: 'landed_on_non_working_day' };
  }

  // Dispatch must fall strictly after the order date on a real production working day.
  if (expectedReadyDateIst <= orderDateIst) {
    return { ok: false, reason: 'dispatch_before_production' };
  }
  if (countWorkingDaysAfter(orderDateIst, expectedReadyDateIst, holidays) < 1) {
    return { ok: false, reason: 'dispatch_before_production' };
  }

  // Destination promise cannot precede shared dispatch.
  if (estimatedDeliveryDateIst < expectedReadyDateIst) {
    return { ok: false, reason: 'delivery_before_dispatch' };
  }

  // TN delivery must remain exactly two working days after shared dispatch.
  const tnFromReady = addWorkingDaysFromOrderDate(expectedReadyDateIst, 2, holidays);
  if (tnFromReady !== tamilNaduDeliveryDateIst) {
    return { ok: false, reason: 'dispatch_tn_inconsistent' };
  }

  return {
    ok: true,
    calendarVersion: CONFIRMATION_CALENDAR_VERSION,
    queueEpochIst,
    placedAt: placedDate,
    orderDateIst,
    destinationState: String(destinationState || '').trim(),
    shippingEstimateLabel: destLabel,
    deliveryWorkingDays,
    holidayAdjustmentApplied,
    tamilNaduEstimateLabel: tnLabel,
    tamilNaduWorkingDays,
    tamilNaduDeliveryDateIst,
    expectedReadyDateIst,
    estimatedDeliveryDateIst,
    computedAt: new Date(),
  };
}
