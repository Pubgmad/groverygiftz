const IST = 'Asia/Kolkata';
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function escapeRegex(value = '') {
  return String(value).split('').map((char) => ('\\^$*+?.()|{}[]'.includes(char) ? `\\${char}` : char)).join('');
}

export function boundedPageNumber(value, fallback = 1) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function boundedLimit(value, fallback = 10, max = 100) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), max);
}

export function formatIstDateInput(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function formatIstDateTime(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${new Intl.DateTimeFormat('en-IN', {
    timeZone: IST,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date)} IST`;
}

export function parseIstDay(value) {
  const dateStr = String(value || '').trim();
  if (!dateStr) return { dateStr: '' };
  if (!DATE_PATTERN.test(dateStr)) return { error: 'Enter dates as YYYY-MM-DD' };
  const probe = new Date(`${dateStr}T12:00:00.000+05:30`);
  if (Number.isNaN(probe.getTime()) || formatIstDateInput(probe) !== dateStr) {
    return { error: 'Enter a valid date' };
  }
  return { dateStr };
}

export function istDayStart(dateStr) {
  return new Date(`${dateStr}T00:00:00.000+05:30`);
}

export function istDayEnd(dateStr) {
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}

export function parseIstRange(fromValue, toValue) {
  const from = parseIstDay(fromValue);
  if (from.error) return from;
  const to = parseIstDay(toValue);
  if (to.error) return to;
  if (from.dateStr && to.dateStr && from.dateStr > to.dateStr) {
    return { error: 'From date cannot be after To date' };
  }
  return {
    fromStr: from.dateStr,
    toStr: to.dateStr,
    from: from.dateStr ? istDayStart(from.dateStr) : null,
    to: to.dateStr ? istDayEnd(to.dateStr) : null,
  };
}

export function csvFilename(prefix, fromStr, toStr, today = formatIstDateInput()) {
  const safePrefix = String(prefix || 'export').replace(/[^a-z0-9_-]/gi, '-');
  if (fromStr && toStr) return `${safePrefix}_${fromStr}_to_${toStr}.csv`;
  if (fromStr) return `${safePrefix}_from_${fromStr}.csv`;
  if (toStr) return `${safePrefix}_to_${toStr}.csv`;
  return `${safePrefix}_all_${today}.csv`;
}

export function paramValue(params, ...keys) {
  for (const key of keys) {
    const value = typeof params?.get === 'function' ? params.get(key) : params?.[key];
    if (value != null && String(value).trim() !== '') return String(value).trim();
  }
  return '';
}
