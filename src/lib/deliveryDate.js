import {
  addWorkingDaysFromOrderDate,
  continuousDeliveryYmd,
  formatLongIstDate,
  istYmd,
  parseMaxWorkingDays,
  parseYmd,
} from '@/lib/businessCalendar';

const DELIVERY_TIME_ZONE = 'Asia/Kolkata';

const getDateParts = (date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DELIVERY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return Object.fromEntries(parts.map((part) => [part.type, part.value]));
};

const toDeliveryDateKey = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const parts = getDateParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const normalizeHolidayDate = (value) => {
  if (!value) return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return toDeliveryDateKey(date);
};

const getHolidayValue = (holiday) => {
  if (!holiday || holiday instanceof Date) return holiday;
  if (typeof holiday === 'object') return holiday.date || holiday.value || holiday.day || '';
  return holiday;
};

export function normalizeDeliveryHolidays(holidays = []) {
  return new Set((Array.isArray(holidays) ? holidays : [])
    .map((holiday) => normalizeHolidayDate(getHolidayValue(holiday)))
    .filter(Boolean));
}

function ymdToIstNoonDate(ymd) {
  const parsed = parseYmd(ymd);
  if (!parsed) return new Date(NaN);
  return new Date(Date.UTC(parsed.year, parsed.month - 1, parsed.day, 6, 30));
}

export function addWorkingDays(startDate, days, holidays = []) {
  const totalDays = Math.max(0, Number(days || 0));
  const orderDateIst = istYmd(startDate || new Date());
  if (!orderDateIst) return new Date(startDate || Date.now());
  if (totalDays < 1) return ymdToIstNoonDate(orderDateIst);
  const ymd = addWorkingDaysFromOrderDate(orderDateIst, totalDays, holidays);
  return ymdToIstNoonDate(ymd);
}

export const addDaysSkippingSundays = addWorkingDays;

export function extractMaxDays(text, fallbackDays = 8) {
  const parsed = parseMaxWorkingDays(text);
  if (parsed) return parsed;
  const matches = String(text || '').match(/\d+/g);
  if (!matches?.length) return fallbackDays;
  return Math.max(...matches.map(Number));
}

export function formatDeliveryDate(date) {
  const ymd = date instanceof Date ? istYmd(date) : String(date || '');
  return formatLongIstDate(ymd) || new Intl.DateTimeFormat('en-IN', {
    timeZone: DELIVERY_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

export function buildDeliveryEstimateText(baseEstimate, options = {}) {
  const label = String(baseEstimate || '').trim();
  const maxDays = parseMaxWorkingDays(label);
  if (!maxDays) return label || 'Delivery estimate unavailable';
  const holidays = options.holidays || options.deliveryHolidays || [];
  const start = options.startDate || Date.now();
  const orderDateIst = istYmd(start);
  if (!orderDateIst) return label;
  const ymd = continuousDeliveryYmd(orderDateIst, maxDays, holidays);
  const expected = formatLongIstDate(ymd);
  if (!expected) return label;
  return `${label} - expected by ${expected} (Sundays and government/public holidays skipped)`;
}
