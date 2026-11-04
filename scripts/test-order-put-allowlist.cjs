const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/orderUpdateAllowlist.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');

const ctx = {
  module: { exports: {} },
  exports: {},
  console,
  Object,
  String,
  Array,
};
vm.createContext(ctx);
vm.runInContext(`${source}
module.exports = {
  ORDER_PUT_STATUSES,
  ORDER_PUT_STATUS_ALIASES,
  ORDER_PUT_ALLOWED_KEYS,
  parseOrderPutAllowlist,
};
`, ctx);

const {
  ORDER_PUT_STATUSES,
  parseOrderPutAllowlist,
} = ctx.module.exports;

assert.strictEqual(ORDER_PUT_STATUSES.join(','), 'ordered,on_process,dispatched,cancelled');

assert.strictEqual(parseOrderPutAllowlist(null).ok, false);
assert.strictEqual(parseOrderPutAllowlist({}).ok, false);

const rejectTotal = parseOrderPutAllowlist({ status: 'ordered', total: 99 });
assert.strictEqual(rejectTotal.ok, false);
assert.ok(String(rejectTotal.error).includes('total'));

const rejectPayment = parseOrderPutAllowlist({ paymentStatus: 'paid' });
assert.strictEqual(rejectPayment.ok, false);

const legacy = parseOrderPutAllowlist({ status: 'processing' });
assert.strictEqual(legacy.ok, true);
assert.strictEqual(legacy.patch.status, 'on_process');

const shipped = parseOrderPutAllowlist({ status: 'shipped' });
assert.strictEqual(shipped.patch.status, 'dispatched');

const pending = parseOrderPutAllowlist({ status: 'pending' });
assert.strictEqual(pending.patch.status, 'ordered');

const badStatus = parseOrderPutAllowlist({ status: 'refunded' });
assert.strictEqual(badStatus.ok, false);

const tracking = parseOrderPutAllowlist({
  trackingNumber: ' ST123 ',
  trackingUrl: ' https://track.example/1 ',
  courierCompany: ' ST Couriers ',
});
assert.strictEqual(tracking.ok, true);
assert.strictEqual(tracking.trackingTouched, true);
assert.strictEqual(tracking.patch.trackingNumber, 'ST123');
assert.strictEqual(tracking.patch.trackingUrl, 'https://track.example/1');
assert.strictEqual(tracking.patch.courierCompany, 'ST Couriers');

const statusOnly = parseOrderPutAllowlist({ status: 'cancelled' });
assert.strictEqual(statusOnly.trackingTouched, false);
assert.strictEqual(statusOnly.patch.status, 'cancelled');

console.log('Order PUT allowlist tests passed');
