const TIME_ZONE = 'Asia/Kolkata';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const CONFIRMATION_CALENDAR_VERSION = 'working-day-v1';

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

export function computeConfirmationSchedule({
  placedAt,
  destinationState,
  tamilNaduEstimate,
  destinationEstimate,
  holidays = [],
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
  const dispatchOffset = tamilNaduWorkingDays - 2;
  if (dispatchOffset < 1) return { ok: false, reason: 'tn_dispatch_offset_invalid' };

  const expectedReadyDateIst = addWorkingDaysFromOrderDate(orderDateIst, dispatchOffset, holidays);
  const estimatedDeliveryDateIst = addWorkingDaysFromOrderDate(orderDateIst, deliveryWorkingDays, holidays);
  if (!expectedReadyDateIst || !estimatedDeliveryDateIst) return { ok: false, reason: 'date_calculation_failed' };
  if (isNonWorkingYmd(expectedReadyDateIst, holidays) || isNonWorkingYmd(estimatedDeliveryDateIst, holidays)) {
    return { ok: false, reason: 'landed_on_non_working_day' };
  }

  return {
    ok: true,
    calendarVersion: CONFIRMATION_CALENDAR_VERSION,
    placedAt: placedDate,
    orderDateIst,
    destinationState: String(destinationState || '').trim(),
    shippingEstimateLabel: destLabel,
    deliveryWorkingDays,
    holidayAdjustmentApplied,
    tamilNaduEstimateLabel: tnLabel,
    tamilNaduWorkingDays,
    expectedReadyDateIst,
    estimatedDeliveryDateIst,
    computedAt: new Date(),
  };
}
