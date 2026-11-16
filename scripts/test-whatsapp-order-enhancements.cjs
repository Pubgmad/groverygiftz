/**
 * Lightweight regression checks for Create WhatsApp Order enhancements.
 * Self-contained (no Next path aliases) so it runs with plain node.
 * Run: node scripts/test-whatsapp-order-enhancements.cjs
 */

const assert = require('assert');

function parseYmd(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) return null;
  return { year, month, day };
}

function isSundayYmd(ymd) {
  const p = parseYmd(ymd);
  if (!p) return false;
  return new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() === 0;
}

function holidayYmd(value) {
  if (!value) return '';
  if (typeof value === 'string') return parseYmd(value) ? value : '';
  if (value.date) return holidayYmd(value.date);
  if (value.ymd) return holidayYmd(value.ymd);
  return '';
}

function isNonWorkingYmd(ymd, holidays = []) {
  if (!parseYmd(ymd)) return false;
  if (isSundayYmd(ymd)) return true;
  const set = new Set((Array.isArray(holidays) ? holidays : []).map(holidayYmd).filter(Boolean));
  return set.has(ymd);
}

function addCalendarDaysYmd(ymd, days) {
  const p = parseYmd(ymd);
  if (!p) return '';
  const dt = new Date(Date.UTC(p.year, p.month - 1, p.day));
  dt.setUTCDate(dt.getUTCDate() + Number(days));
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
}

function addWorkingDaysFromOrderDate(orderDateYmd, workingDays, holidays = []) {
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

function expectedDeliveryFromDispatchYmd(dispatchYmd, holidays = []) {
  const ymd = String(dispatchYmd || '').trim();
  if (!parseYmd(ymd)) return { ok: false, reason: 'invalid_dispatch_date' };
  if (isNonWorkingYmd(ymd, holidays)) return { ok: false, reason: 'dispatch_on_non_working_day' };
  const deliveryYmd = addWorkingDaysFromOrderDate(ymd, 2, holidays);
  if (!deliveryYmd || isNonWorkingYmd(deliveryYmd, holidays)) {
    return { ok: false, reason: 'delivery_calculation_failed' };
  }
  return { ok: true, dispatchYmd: ymd, deliveryYmd };
}

function sanitizeDecimalInput(raw) {
  let s = String(raw ?? '');
  if (s === '') return '';
  s = s.replace(/[^\d.]/g, '');
  const firstDot = s.indexOf('.');
  if (firstDot !== -1) {
    s = `${s.slice(0, firstDot + 1)}${s.slice(firstDot + 1).replace(/\./g, '')}`;
  }
  const [intPart = '', decPart] = s.split('.');
  let intClean = intPart.replace(/^0+(?=\d)/, '');
  if (intClean === '' && (intPart.length > 0 || decPart !== undefined)) intClean = '0';
  if (decPart !== undefined) return `${intClean}.${decPart}`;
  return intClean;
}

function sanitizeIntegerInput(raw, { allowEmpty = true } = {}) {
  let s = String(raw ?? '').replace(/\D/g, '');
  if (s === '') return allowEmpty ? '' : '0';
  s = s.replace(/^0+(?=\d)/, '');
  return s === '' ? '0' : s;
}

// Example A
const a = expectedDeliveryFromDispatchYmd('2026-11-24', []);
assert.strictEqual(a.ok, true);
assert.strictEqual(a.deliveryYmd, '2026-11-26');

// Example B
const b = expectedDeliveryFromDispatchYmd('2026-11-24', [
  { date: '2026-11-25', name: 'Holiday A' },
  { date: '2026-11-26', name: 'Holiday B' },
]);
assert.strictEqual(b.ok, true);
assert.strictEqual(b.deliveryYmd, '2026-11-28');

const sunday = expectedDeliveryFromDispatchYmd('2026-11-22', []);
assert.strictEqual(sunday.ok, false);

const fri = expectedDeliveryFromDispatchYmd('2026-11-20', []);
assert.strictEqual(fri.ok, true);
assert.strictEqual(fri.deliveryYmd, '2026-11-23');

assert.strictEqual(sanitizeDecimalInput('080'), '80');
assert.strictEqual(sanitizeDecimalInput('80'), '80');
assert.strictEqual(sanitizeDecimalInput('0'), '0');
assert.strictEqual(sanitizeDecimalInput('0.5'), '0.5');
assert.strictEqual(sanitizeDecimalInput('12.'), '12.');
assert.strictEqual(sanitizeIntegerInput('080'), '80');
assert.strictEqual(sanitizeIntegerInput('0'), '0');
assert.strictEqual(sanitizeIntegerInput(''), '');

console.log('OK: whatsapp order date + numeric sanitize checks passed');
