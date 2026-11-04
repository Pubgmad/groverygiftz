const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '../src/lib/opsConstants.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');
const ctx = { module: { exports: {} }, exports: {}, console, Math, Date, Number, String, Boolean, Array, Object, Set };
vm.createContext(ctx);
vm.runInContext(`${src}
module.exports={
  canTransitionOpsStatus,allowedOpsStatusesFor,requiresPaidRevisionGate,canPrintDesign,OPS_STATUSES,isPaymentSatisfiedForDispatch
};`, ctx);
const {
  canTransitionOpsStatus,
  allowedOpsStatusesFor,
  requiresPaidRevisionGate,
  canPrintDesign,
  OPS_STATUSES,
  isPaymentSatisfiedForDispatch,
} = ctx.module.exports;

assert.ok(OPS_STATUSES.includes('printing_assigned'));
assert.ok(OPS_STATUSES.includes('manufacturing'));
assert.ok(OPS_STATUSES.includes('assembly'));
assert.ok(OPS_STATUSES.includes('finishing'));

assert.strictEqual(canTransitionOpsStatus('new_order', 'new_order'), true);
assert.strictEqual(canTransitionOpsStatus('new_order', 'editing_in_progress'), true);
assert.strictEqual(canTransitionOpsStatus('new_order', 'completed'), false);
assert.strictEqual(canTransitionOpsStatus('approved_printing_pending', 'printing_assigned'), true);
assert.strictEqual(canTransitionOpsStatus('printing_completed', 'completed'), false);
assert.strictEqual(canTransitionOpsStatus('printing_completed', 'production_pending'), true);
assert.strictEqual(canTransitionOpsStatus('printing_completed', 'manufacturing'), true);

assert.strictEqual(requiresPaidRevisionGate({ freeRevisionUsed: true, designRevisionCount: 1, revisionPaymentVerified: false }), false);
assert.strictEqual(requiresPaidRevisionGate({ freeRevisionUsed: true, designRevisionCount: 2, revisionPaymentVerified: false }), true);
assert.strictEqual(requiresPaidRevisionGate({ freeRevisionUsed: true, designRevisionCount: 2, revisionPaymentVerified: true }), false);

assert.strictEqual(canPrintDesign({
  currentDesignVersion: 1,
  previewRequired: true,
  designApprovalStatus: 'awaiting_approval',
  designApprovedVersion: 0,
}), false);

assert.strictEqual(isPaymentSatisfiedForDispatch({ paymentStatus: 'paid' }), true);
assert.strictEqual(isPaymentSatisfiedForDispatch({ balanceStatus: 'fully_paid' }), true);
assert.strictEqual(isPaymentSatisfiedForDispatch({ paymentException: true }), true);
assert.strictEqual(isPaymentSatisfiedForDispatch({ paymentStatus: 'pending' }), false);

const allowed = allowedOpsStatusesFor('approved_printing_pending');
assert.ok(allowed.includes('approved_printing_pending'));
assert.ok(allowed.includes('printing_assigned'));
assert.ok(!allowed.includes('completed'));
assert.strictEqual(JSON.stringify(allowedOpsStatusesFor('completed')), JSON.stringify(['completed']));

console.log('Ops transitions tests passed');
