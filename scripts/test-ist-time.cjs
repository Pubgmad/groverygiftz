const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../src/lib/istTime.js'), 'utf8')
  .replace(/export function /g, 'function ')
  .replace(/export const /g, 'const ');

const ctx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object };
vm.createContext(ctx);
vm.runInContext(`${src}
module.exports={formatIstDateTime,formatIstDate,istDayBounds,istRangeBounds,todayIstYmd,toDatetimeLocalIst,fromDatetimeLocalIst,toIstParts};
`, ctx);
const {
  formatIstDateTime,
  istDayBounds,
  fromDatetimeLocalIst,
  toDatetimeLocalIst,
  toIstParts,
} = ctx.module.exports;

{
  // 2024-01-01 00:30 IST = 2023-12-31 19:00 UTC
  const utc = new Date(Date.UTC(2023, 11, 31, 19, 0, 0));
  const parts = toIstParts(utc);
  assert.strictEqual(parts.year, 2024);
  assert.strictEqual(parts.month, 1);
  assert.strictEqual(parts.day, 1);
  assert.strictEqual(parts.hours, 0);
  assert.strictEqual(parts.minutes, 30);
  assert.ok(formatIstDateTime(utc).includes('01/01/2024'));
  assert.ok(formatIstDateTime(utc).includes('IST'));
}

{
  const bounds = istDayBounds('2024-11-05');
  assert.ok(bounds);
  assert.ok(bounds.start < bounds.end);
  // Start should be 2024-11-04 18:30 UTC
  assert.strictEqual(bounds.start.toISOString(), '2024-11-04T18:30:00.000Z');
  assert.strictEqual(bounds.end.toISOString(), '2024-11-05T18:29:59.999Z');
}

{
  const local = '2024-11-05T14:45';
  const date = fromDatetimeLocalIst(local);
  const back = toDatetimeLocalIst(date);
  assert.strictEqual(back, local);
}

{
  // Invalid / empty must NOT invent "now"
  assert.strictEqual(fromDatetimeLocalIst(''), null);
  assert.strictEqual(fromDatetimeLocalIst('not-a-date'), null);
  assert.strictEqual(fromDatetimeLocalIst(undefined), null);
}

console.log('IST time tests passed');
