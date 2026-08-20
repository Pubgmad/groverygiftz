const normalizeHolidayDate = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

export function normalizeDeliveryHolidays(holidays = []) {
  return new Set((Array.isArray(holidays) ? holidays : [])
    .map((holiday) => normalizeHolidayDate(typeof holiday === 'object' ? holiday.date : holiday))
    .filter(Boolean));
}

export function addWorkingDays(startDate, days, holidays = []) {
  const totalDays = Math.max(0, Number(days || 0));
  const date = new Date(startDate || Date.now());
  const holidayDates = normalizeDeliveryHolidays(holidays);
  let added = 0;
  while (added < totalDays) {
    date.setDate(date.getDate() + 1);
    const isSunday = date.getDay() === 0;
    const isHoliday = holidayDates.has(normalizeHolidayDate(date));
    if (!isSunday && !isHoliday) added += 1;
  }
  return date;
}

export const addDaysSkippingSundays = addWorkingDays;

export function extractMaxDays(text, fallbackDays = 8) {
  const matches = String(text || '').match(/\d+/g);
  if (!matches?.length) return fallbackDays;
  return Math.max(...matches.map(Number));
}

export function formatDeliveryDate(date) {
  return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

export function buildDeliveryEstimateText(baseEstimate, options = {}) {
  const fallbackDays = Number(options.fallbackDays || 8);
  const days = extractMaxDays(baseEstimate, fallbackDays);
  const holidays = options.holidays || options.deliveryHolidays || [];
  const date = addWorkingDays(options.startDate || Date.now(), days, holidays);
  const label = String(baseEstimate || '').trim() || (days + ' days');
  return label + ' - expected by ' + formatDeliveryDate(date) + ' (Sundays and holidays skipped)';
}