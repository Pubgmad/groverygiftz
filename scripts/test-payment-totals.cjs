const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const constantsSrc = fs.readFileSync(path.join(__dirname, '../src/lib/opsConstants.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');

// Strip ESM imports (including multi-line); inject helpers from constants sandbox below.
const helpersSrc = fs.readFileSync(path.join(__dirname, '../src/lib/opsOrderHelpers.js'), 'utf8')
  .replace(/^import[\s\S]*?from\s+['"][^'"]+['"];?\s*$/gm, '')
  .replace(/export function /g, 'function ')
  .replace(/export async function /g, 'async function ');

const ctx = {
  module: { exports: {} },
  exports: {},
  console,
  Math,
  Date,
  Number,
  String,
  Boolean,
  Array,
  Object,
  Set,
  Map,
  OpsNotification: { insertMany: async () => {} },
  Admin: { find: () => ({ select: () => ({ lean: async () => [] }) }) },
  Role: { find: () => ({ select: () => ({ lean: async () => [] }) }) },
};
vm.createContext(ctx);
vm.runInContext(`${constantsSrc}
${helpersSrc}
module.exports = { computePaymentTotals, refreshPaymentTotals, computeBalanceStatus };
`, ctx);

const { computePaymentTotals, refreshPaymentTotals } = ctx.module.exports;

// Unverified screenshots must NOT increase paid totals
{
  const totals = computePaymentTotals({
    total: 1000,
    paymentRecords: [
      { kind: 'advance', amount: 400, verified: false },
      { kind: 'balance', amount: 600, verified: false },
    ],
  });
  assert.strictEqual(totals.advancePaid, 0);
  assert.strictEqual(totals.balancePaid, 0);
  assert.strictEqual(totals.remainingBalance, 1000);
  assert.strictEqual(totals.balanceStatus, 'verification_required');
  assert.notStrictEqual(totals.paymentStatus, 'paid');
}

// Verified advance + balance → fully paid
{
  const totals = computePaymentTotals({
    total: 1000,
    paymentStatus: 'pending',
    paymentRecords: [
      { kind: 'advance', amount: 400, verified: true },
      { kind: 'balance', amount: 600, verified: true },
    ],
  });
  assert.strictEqual(totals.advancePaid, 400);
  assert.strictEqual(totals.balancePaid, 600);
  assert.strictEqual(totals.remainingBalance, 0);
  assert.strictEqual(totals.balanceStatus, 'fully_paid');
  assert.strictEqual(totals.paymentStatus, 'paid');
}

// Mix: unverified must not count; verification_required while unpaid remains
{
  const totals = computePaymentTotals({
    total: 1000,
    paymentRecords: [
      { kind: 'advance', amount: 300, verified: true },
      { kind: 'balance', amount: 700, verified: false },
    ],
  });
  assert.strictEqual(totals.advancePaid, 300);
  assert.strictEqual(totals.balancePaid, 0);
  assert.strictEqual(totals.remainingBalance, 700);
  assert.strictEqual(totals.balanceStatus, 'verification_required');
  assert.notStrictEqual(totals.paymentStatus, 'paid');
}

// Verified revision payments reduce remaining balance
{
  const totals = computePaymentTotals({
    total: 1000,
    revisionCharges: 200,
    paymentRecords: [
      { kind: 'advance', amount: 1000, verified: true },
      { kind: 'revision', amount: 200, verified: true },
    ],
  });
  assert.strictEqual(totals.remainingBalance, 0);
  assert.strictEqual(totals.balanceStatus, 'fully_paid');
  assert.strictEqual(totals.revisionCharges, 200);
  assert.strictEqual(totals.revisionPaymentVerified, true);
}

// Unverified revision does not reduce balance / does not mark paid
{
  const totals = computePaymentTotals({
    total: 1000,
    revisionCharges: 200,
    paymentStatus: 'paid',
    paymentRecords: [
      { kind: 'advance', amount: 1000, verified: true },
      { kind: 'revision', amount: 200, verified: false },
    ],
  });
  assert.strictEqual(totals.remainingBalance, 200);
  assert.strictEqual(totals.balanceStatus, 'verification_required');
}

// Insufficient verified → never set paymentStatus paid
{
  const totals = computePaymentTotals({
    total: 1000,
    paymentStatus: 'pending',
    paymentRecords: [{ kind: 'advance', amount: 1000, verified: false }],
  });
  assert.notStrictEqual(totals.paymentStatus, 'paid');
  assert.strictEqual(totals.balanceStatus, 'verification_required');
}

// refreshPaymentTotals mutates order in place
{
  const order = {
    total: 500,
    paymentStatus: 'pending',
    paymentRecords: [{ kind: 'advance', amount: 500, verified: true }],
  };
  refreshPaymentTotals(order);
  assert.strictEqual(order.remainingBalance, 0);
  assert.strictEqual(order.paymentStatus, 'paid');
  assert.strictEqual(order.balanceStatus, 'fully_paid');
}

console.log('Payment totals tests passed');
