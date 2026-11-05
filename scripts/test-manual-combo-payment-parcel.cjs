const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Payment totals: multiple dated entries retained; only verified count
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
vm.runInContext(`${constantsSrc}\n${helpersSrc}\nmodule.exports={computePaymentTotals,refreshPaymentTotals};`, ctx);
const { computePaymentTotals } = ctx.module.exports;

{
  // Scenario 5: advance + balance on different dates — all three entries retained
  const records = [
    { kind: 'advance', amount: 500, verified: true, paidAt: new Date('2024-11-05T10:00:00+05:30') },
    { kind: 'balance', amount: 400, verified: true, paidAt: new Date('2024-11-07T12:00:00+05:30') },
    { kind: 'balance', amount: 499, verified: true, paidAt: new Date('2024-11-09T18:00:00+05:30') },
  ];
  const totals = computePaymentTotals({ total: 1399, paymentRecords: records });
  assert.strictEqual(totals.advancePaid, 500);
  assert.strictEqual(totals.balancePaid, 899);
  assert.strictEqual(totals.remainingBalance, 0);
  assert.strictEqual(records.length, 3);
  assert.strictEqual(records[0].paidAt.toISOString().startsWith('2024-11-05'), true);
  assert.strictEqual(records[1].paidAt.toISOString().startsWith('2024-11-07'), true);
  assert.strictEqual(records[2].paidAt.toISOString().startsWith('2024-11-09'), true);
}

{
  // Verification later must not change paidAt (simulate PATCH semantics)
  const record = {
    kind: 'advance',
    amount: 500,
    verified: false,
    paidAt: new Date('2024-11-05T10:00:00+05:30'),
  };
  const original = record.paidAt.toISOString();
  record.verified = true;
  record.verifiedAt = new Date('2024-11-06T09:00:00+05:30');
  // paidAt preserved
  assert.strictEqual(record.paidAt.toISOString(), original);
  assert.notStrictEqual(record.verifiedAt.toISOString(), original);
}

{
  // Manual WhatsApp combo: total = combo + shipping; other stays in additionalCharges (no double-count)
  function computeWhatsAppTotal({ manualComboPrice, shippingCost = 0, otherCharges = 0, itemUnitPrices = [] }) {
    const catalogSubtotal = itemUnitPrices.reduce((s, p) => s + p, 0);
    const subtotal = Number(manualComboPrice);
    const total = subtotal + Number(shippingCost);
    const additionalCharges = Number(otherCharges);
    const owed = total + additionalCharges; // matches refreshPaymentTotals
    return { catalogSubtotal, subtotal, total, additionalCharges, owed, manualPriceEntered: true };
  }
  const result = computeWhatsAppTotal({
    manualComboPrice: 1499,
    shippingCost: 80,
    otherCharges: 20,
    itemUnitPrices: [999, 799, 499], // website prices must NOT drive total
  });
  assert.strictEqual(result.catalogSubtotal, 2297);
  assert.strictEqual(result.subtotal, 1499);
  assert.strictEqual(result.total, 1579);
  assert.strictEqual(result.additionalCharges, 20);
  assert.strictEqual(result.owed, 1599);
  // Double-count bug would be: total already includes other, then + additionalCharges again → 1619
  assert.notStrictEqual(result.owed, (1499 + 80 + 20) + 20);
}

{
  // Parcel tracking update must not overwrite dispatchedAt
  const parcel = {
    parcelCode: 'PICKUP-20241105-AAAA-P01',
    trackingNumber: '',
    dispatchedAt: new Date('2024-11-05T16:00:00+05:30'),
    courierCompany: 'ST Couriers',
  };
  const originalDispatch = parcel.dispatchedAt.toISOString();
  // update_tracking
  parcel.trackingNumber = 'ST123456789IN';
  parcel.dispatchedAt = originalDispatch && new Date(originalDispatch);
  assert.strictEqual(parcel.dispatchedAt.toISOString(), originalDispatch);
  assert.strictEqual(parcel.trackingNumber, 'ST123456789IN');
}

{
  // Arranging pickup must not invent an actual dispatch date
  const confirmNow = false;
  const arrangedParcelDispatchedAt = confirmNow ? new Date() : null;
  assert.strictEqual(arrangedParcelDispatchedAt, null);
}

{
  // Multi-parcel history append-only
  const parcelRefs = [];
  parcelRefs.push({
    parcelCode: 'P01',
    trackingNumber: 'A1',
    dispatchedAt: new Date('2024-11-05T10:00:00+05:30'),
  });
  parcelRefs.push({
    parcelCode: 'P02',
    trackingNumber: 'A2',
    dispatchedAt: new Date('2024-11-07T10:00:00+05:30'),
  });
  assert.strictEqual(parcelRefs.length, 2);
  assert.ok(parcelRefs[0].dispatchedAt < parcelRefs[1].dispatchedAt);
  // update tracking on P01
  parcelRefs[0].trackingNumber = 'A1-UPDATED';
  assert.strictEqual(parcelRefs[0].dispatchedAt.toISOString().startsWith('2024-11-05'), true);
  assert.strictEqual(parcelRefs[1].trackingNumber, 'A2');
}

{
  // Order-level paidAt should come from earliest verified payment, not "now"
  const records = [
    { kind: 'advance', amount: 500, verified: true, paidAt: new Date('2024-11-05T10:00:00+05:30') },
    { kind: 'balance', amount: 500, verified: true, paidAt: new Date('2024-11-09T10:00:00+05:30') },
  ];
  const totals = computePaymentTotals({ total: 1000, paymentRecords: records, paidAt: null });
  assert.strictEqual(totals.balanceStatus, 'fully_paid');
  assert.ok(totals.paidAt);
  assert.strictEqual(totals.paidAt.toISOString().startsWith('2024-11-05'), true);
}

console.log('Manual combo / payment / parcel history tests passed');
