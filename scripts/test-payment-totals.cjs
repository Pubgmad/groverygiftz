const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const constantsSrc = fs.readFileSync(path.join(__dirname, '../src/lib/opsConstants.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');

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
module.exports = { computePaymentTotals, refreshPaymentTotals, ensureLegacyWebsitePaymentRecord, computeBalanceStatus, isPaymentSatisfiedForDispatch };
`, ctx);

const {
  computePaymentTotals,
  refreshPaymentTotals,
  ensureLegacyWebsitePaymentRecord,
  isPaymentSatisfiedForDispatch,
} = ctx.module.exports;

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

// Verified advance + balance → fully paid + earliest paidAt
{
  const early = new Date('2026-01-01T10:00:00.000Z');
  const late = new Date('2026-01-05T10:00:00.000Z');
  const totals = computePaymentTotals({
    total: 1000,
    paymentStatus: 'pending',
    paidAt: late,
    paymentRecords: [
      { kind: 'advance', amount: 400, verified: true, paidAt: early },
      { kind: 'balance', amount: 600, verified: true, paidAt: late },
    ],
  });
  assert.strictEqual(totals.advancePaid, 400);
  assert.strictEqual(totals.balancePaid, 600);
  assert.strictEqual(totals.remainingBalance, 0);
  assert.strictEqual(totals.balanceStatus, 'fully_paid');
  assert.strictEqual(totals.paymentStatus, 'paid');
  assert.strictEqual(new Date(totals.paidAt).toISOString(), early.toISOString());
}

// Mix: unverified must not count; demote sticky paid when verified totals insufficient
{
  const totals = computePaymentTotals({
    total: 1000,
    paymentStatus: 'paid',
    paidAt: new Date('2026-01-02'),
    paymentRecords: [
      { kind: 'advance', amount: 300, verified: true, paidAt: new Date('2026-01-01') },
      { kind: 'balance', amount: 700, verified: false, paidAt: new Date('2026-01-02') },
    ],
  });
  assert.strictEqual(totals.advancePaid, 300);
  assert.strictEqual(totals.balancePaid, 0);
  assert.strictEqual(totals.remainingBalance, 700);
  assert.strictEqual(totals.balanceStatus, 'verification_required');
  assert.strictEqual(totals.paymentStatus, 'pending');
  assert.strictEqual(totals.paidAt, null);
}

// Verified revision payments reduce remaining balance
{
  const totals = computePaymentTotals({
    total: 1000,
    revisionCharges: 200,
    paymentRecords: [
      { kind: 'advance', amount: 1000, verified: true, paidAt: new Date('2026-01-01') },
      { kind: 'revision', amount: 200, verified: true, paidAt: new Date('2026-01-02') },
    ],
  });
  assert.strictEqual(totals.remainingBalance, 0);
  assert.strictEqual(totals.balanceStatus, 'fully_paid');
  assert.strictEqual(totals.revisionCharges, 200);
  assert.strictEqual(totals.revisionPaymentVerified, true);
}

// Unverified revision does not reduce balance
{
  const totals = computePaymentTotals({
    total: 1000,
    revisionCharges: 200,
    paymentStatus: 'paid',
    paymentRecords: [
      { kind: 'advance', amount: 1000, verified: true, paidAt: new Date('2026-01-01') },
      { kind: 'revision', amount: 200, verified: false },
    ],
  });
  assert.strictEqual(totals.remainingBalance, 200);
  assert.strictEqual(totals.balanceStatus, 'verification_required');
  assert.strictEqual(totals.paymentStatus, 'pending');
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

// Legacy website Cashfree: empty records + paid must stay fully_paid (ops save safe)
{
  const paidAt = new Date('2026-02-01T05:00:00.000Z');
  const totals = computePaymentTotals({
    total: 1999,
    paymentStatus: 'paid',
    paidAt,
    paymentRecords: [],
  });
  assert.strictEqual(totals.balanceStatus, 'fully_paid');
  assert.strictEqual(totals.paymentStatus, 'paid');
  assert.strictEqual(totals.remainingBalance, 0);
  assert.strictEqual(totals.advancePaid, 1999);
  assert.strictEqual(totals.paidAt, paidAt);
}

// ensureLegacyWebsitePaymentRecord uses existing paidAt only — never invents
{
  const order = {
    paymentStatus: 'paid',
    total: 500,
    paidAt: new Date('2026-03-01T12:00:00.000Z'),
    paymentMethod: 'Cashfree',
    cashfreePaymentId: 'pay_1',
    paymentRecords: [],
  };
  assert.strictEqual(ensureLegacyWebsitePaymentRecord(order), true);
  assert.strictEqual(order.paymentRecords.length, 1);
  assert.strictEqual(order.paymentRecords[0].verified, true);
  assert.strictEqual(new Date(order.paymentRecords[0].paidAt).toISOString(), '2026-03-01T12:00:00.000Z');

  const noDate = { paymentStatus: 'paid', total: 500, paymentRecords: [] };
  assert.strictEqual(ensureLegacyWebsitePaymentRecord(noDate), false);
  assert.deepStrictEqual(noDate.paymentRecords, []);
}

// refreshPaymentTotals backfills legacy then keeps paid
{
  const order = {
    total: 500,
    paymentStatus: 'paid',
    paidAt: new Date('2026-03-01T12:00:00.000Z'),
    paymentMethod: 'Cashfree',
    paymentRecords: [],
  };
  refreshPaymentTotals(order);
  assert.strictEqual(order.remainingBalance, 0);
  assert.strictEqual(order.paymentStatus, 'paid');
  assert.strictEqual(order.balanceStatus, 'fully_paid');
  assert.ok(order.paymentRecords.length >= 1);
}

// Gates: sticky paid with records but not fully_paid is blocked; legacy empty OK
{
  assert.strictEqual(isPaymentSatisfiedForDispatch({
    paymentStatus: 'paid',
    balanceStatus: 'pending',
    paymentRecords: [],
  }), true);
  assert.strictEqual(isPaymentSatisfiedForDispatch({
    paymentStatus: 'paid',
    balanceStatus: 'verification_required',
    paymentRecords: [{ verified: true, amount: 100 }],
  }), false);
  assert.strictEqual(isPaymentSatisfiedForDispatch({
    balanceStatus: 'fully_paid',
    paymentRecords: [{ verified: true, amount: 100 }],
  }), true);
}

console.log('Payment totals tests passed');
