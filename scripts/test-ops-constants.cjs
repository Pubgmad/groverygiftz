const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../src/lib/opsConstants.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');
const ctx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, Set };
vm.createContext(ctx);
vm.runInContext(`${src}\nmodule.exports={canPrintDesign,isDelayedOrder,computeBalanceStatus,OPS_STATUSES};`, ctx);
const { canPrintDesign, isDelayedOrder, computeBalanceStatus, OPS_STATUSES } = ctx.module.exports;

assert.ok(OPS_STATUSES.includes('preview_waiting'));
assert.strictEqual(canPrintDesign({ currentDesignVersion: 1, previewRequired: false }), true);
assert.strictEqual(canPrintDesign({ currentDesignVersion: 1, previewRequired: true, designApprovalStatus: 'awaiting_approval', designApprovedVersion: 0 }), false);
assert.strictEqual(canPrintDesign({ currentDesignVersion: 2, previewRequired: true, designApprovalStatus: 'approved', designApprovedVersion: 2 }), true);
assert.strictEqual(canPrintDesign({ currentDesignVersion: 2, previewRequired: true, designApprovalStatus: 'approved', designApprovedVersion: 1 }), false);

assert.strictEqual(computeBalanceStatus({ total: 1000, advancePaid: 400 }), 'partially_paid');
assert.strictEqual(computeBalanceStatus({ total: 1000, advancePaid: 1000 }), 'fully_paid');

const overdue = isDelayedOrder({
  expectedDispatchDate: new Date(Date.now() - 86400000),
  status: 'ordered',
  opsStatus: 'editing_in_progress',
});
assert.strictEqual(overdue, true);
console.log('Ops constants tests passed');
