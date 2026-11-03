const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/makingCost.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}\nmodule.exports = { backdateInauguralHistoryForAttribution, buildAttributedRows, summarizeAttributedItems, COST_SOURCE };`, context);
const {
  backdateInauguralHistoryForAttribution,
  buildAttributedRows,
  summarizeAttributedItems,
  COST_SOURCE,
} = context.module.exports;

const created = new Date('2025-01-01T00:00:00.000Z');
const today = new Date('2026-11-01T00:00:00.000+05:30');
const historyByProduct = {
  p1: [
    { variantKey: '', amount: 770.18, previousAmount: null, effectiveFrom: today, createdAt: today },
    { variantKey: '', amount: 800, previousAmount: 770.18, effectiveFrom: new Date('2026-11-02T00:00:00.000+05:30'), createdAt: new Date('2026-11-02T00:00:00.000+05:30') },
  ],
};
backdateInauguralHistoryForAttribution(historyByProduct, { p1: { createdAt: created } });
assert.strictEqual(new Date(historyByProduct.p1[0].effectiveFrom).toISOString(), created.toISOString());
assert.strictEqual(new Date(historyByProduct.p1[1].effectiveFrom).toISOString(), new Date('2026-11-02T00:00:00.000+05:30').toISOString());

// Legacy inaugural with previousAmount set + same-day later edits: earliest createdAt is backdated.
const sameDay = new Date('2026-11-01T18:30:00.000Z');
const legacy = {
  p2: [
    { variantKey: '', amount: 807.18, previousAmount: 807.18, effectiveFrom: sameDay, createdAt: new Date('2026-11-02T11:12:26.840Z') },
    { variantKey: '', amount: 770.18, previousAmount: 807.18, effectiveFrom: sameDay, createdAt: new Date('2026-11-02T11:17:15.410Z') },
    { variantKey: '', amount: 807.18, previousAmount: null, effectiveFrom: sameDay, createdAt: new Date('2026-11-02T11:12:13.941Z') },
  ],
};
backdateInauguralHistoryForAttribution(legacy, { p2: { createdAt: created } });
const backdated = legacy.p2.find((row) => new Date(row.effectiveFrom).getTime() === created.getTime());
assert.ok(backdated);
assert.strictEqual(backdated.amount, 807.18);
assert.strictEqual(backdated.previousAmount, null);
assert.ok(backdated.analyticsBackdatedFrom);

// Live MakingCost with no history must be tagged as backdated so strict coverage stays honest.
const synthetic = {
  p3: [{
    variantKey: '',
    amount: 500,
    effectiveFrom: created,
    analyticsBackdatedFrom: today,
    source: COST_SOURCE.historyBackdated,
  }],
};
const attributed = buildAttributedRows(
  [{ orderId: 'o1', product: 'p3', title: 'Frame', variant: '', quantity: 2, price: 999, eventAt: new Date('2025-06-01T12:00:00.000Z') }],
  { p3: { title: 'Frame', variants: [], createdAt: created } },
  synthetic,
);
assert.strictEqual(attributed[0].source, COST_SOURCE.historyBackdated);
const summary = summarizeAttributedItems(attributed);
assert.strictEqual(summary.strictCostCoveragePct, 0);
assert.strictEqual(summary.costCoveragePct, 100);
assert.strictEqual(summary.usesInauguralBackdate, true);

console.log('Profit attribution helper tests passed');
