const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const source = fs.readFileSync(path.join(__dirname, '../src/lib/makingCost.js'), 'utf8')
  .replace(/export const /g, 'const ')
  .replace(/export function /g, 'function ');
const context = { module: { exports: {} }, exports: {}, console };
vm.createContext(context);
vm.runInContext(`${source}\nmodule.exports = { backdateInauguralHistoryForAttribution };`, context);
const { backdateInauguralHistoryForAttribution } = context.module.exports;

const created = new Date('2025-01-01T00:00:00.000Z');
const today = new Date('2026-11-01T00:00:00.000+05:30');
const historyByProduct = {
  p1: [
    { variantKey: '', amount: 770.18, previousAmount: null, effectiveFrom: today },
    { variantKey: '', amount: 800, previousAmount: 770.18, effectiveFrom: new Date('2026-11-02T00:00:00.000+05:30') },
  ],
};
backdateInauguralHistoryForAttribution(historyByProduct, { p1: { createdAt: created } });
assert.strictEqual(new Date(historyByProduct.p1[0].effectiveFrom).toISOString(), created.toISOString());
assert.strictEqual(new Date(historyByProduct.p1[1].effectiveFrom).toISOString(), new Date('2026-11-02T00:00:00.000+05:30').toISOString());

console.log('Profit attribution helper tests passed');
