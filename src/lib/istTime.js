/** India Standard Time helpers for consistent admin date/time display and filters. */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export function toIstParts(input) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return {
    year: ist.getUTCFullYear(),
    month: ist.getUTCMonth() + 1,
    day: ist.getUTCDate(),
    hours: ist.getUTCHours(),
    minutes: ist.getUTCMinutes(),
    seconds: ist.getUTCSeconds(),
    date,
  };
}

export function formatIstDateTime(input, { withSeconds = false } = {}) {
  const parts = toIstParts(input);
  if (!parts) return '—';
  const dd = String(parts.day).padStart(2, '0');
  const mm = String(parts.month).padStart(2, '0');
  const yyyy = parts.year;
  const hh = String(parts.hours).padStart(2, '0');
  const min = String(parts.minutes).padStart(2, '0');
  const ss = String(parts.seconds).padStart(2, '0');
  return withSeconds
    ? `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss} IST`
    : `${dd}/${mm}/${yyyy}, ${hh}:${min} IST`;
}

export function formatIstDate(input) {
  const parts = toIstParts(input);
  if (!parts) return '—';
  return `${String(parts.day).padStart(2, '0')}/${String(parts.month).padStart(2, '0')}/${parts.year}`;
}

/** Start/end of an IST calendar day as UTC Date bounds for Mongo queries. */
export function istDayBounds(yyyyMmDd) {
  const text = String(yyyyMmDd || '').trim();
  const m = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const startUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0) - IST_OFFSET_MS;
  const endUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999) - IST_OFFSET_MS;
  return { start: new Date(startUtc), end: new Date(endUtc) };
}

export function istRangeBounds(fromYmd, toYmd) {
  const from = istDayBounds(fromYmd);
  const to = istDayBounds(toYmd || fromYmd);
  if (!from || !to) return null;
  return { start: from.start, end: to.end };
}

export function todayIstYmd() {
  const parts = toIstParts(new Date());
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Value for `<input type="datetime-local">` representing an IST wall-clock time. */
export function toDatetimeLocalIst(input = new Date()) {
  const parts = toIstParts(input);
  if (!parts) return '';
  return `${parts.year}-${pad2(parts.month)}-${pad2(parts.day)}T${pad2(parts.hours)}:${pad2(parts.minutes)}`;
}

/**
 * Parse datetime-local string as IST wall clock into a UTC Date.
 * Returns null when missing/invalid — never invents "now".
 */
export function fromDatetimeLocalIst(value) {
  const m = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const utcMs = Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6] || 0),
    0,
  ) - IST_OFFSET_MS;
  return new Date(utcMs);
}

/** Normalize from/to IST bounds; swap if inverted; null if either invalid. */
export function istRangeBoundsSafe(fromYmd, toYmd) {
  const bounds = istRangeBounds(fromYmd, toYmd);
  if (!bounds) return null;
  if (bounds.start.getTime() > bounds.end.getTime()) {
    return { start: bounds.end, end: bounds.start };
  }
  return bounds;
}
