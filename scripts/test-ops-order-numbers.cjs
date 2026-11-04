/* Focused tests for GG vs G order number helpers (no DB writes if Counter unavailable). */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'src/lib/orderNumbers.js'), 'utf8')
  .replace(/import Counter from '@\/models\/Counter';/, 'const Counter = globalThis.__Counter;')
  .replace(/export async function /g, 'async function ')
  .replace(/export function /g, 'function ');

const calls = [];
const Counter = {
  async findOneAndUpdate(filter, update, options) {
    calls.push({ filter, update, options });
    if (filter.key === 'paidOrder') return { seq: 142 };
    if (filter.key === 'whatsappOrder') {
      if (options?.upsert === false && !globalThis.__waExists) return null;
      globalThis.__waExists = true;
      globalThis.__waSeq = (globalThis.__waSeq || 4745) + 1;
      return { seq: globalThis.__waSeq };
    }
    return { seq: 1 };
  },
  async create(doc) {
    calls.push({ create: doc });
    globalThis.__waExists = true;
    globalThis.__waSeq = doc.seq;
    return doc;
  },
};

const ctx = {
  globalThis: { __Counter: Counter, __waExists: false, __waSeq: 0 },
  console,
  process: { env: { WHATSAPP_ORDER_SEQ_START: '4745' } },
  module: { exports: {} },
  exports: {},
  Math,
  Number,
  String,
  Boolean,
  Object,
  Date,
};
ctx.globalThis.__Counter = Counter;
vm.createContext(ctx);
vm.runInContext(`${src}\nmodule.exports={getNextPaidOrderNumber,getNextWhatsAppOrderNumber,isFinalOrderNumber,isWebsiteFinalOrderNumber,isWhatsAppOrderNumber};`, ctx);
const {
  getNextPaidOrderNumber,
  getNextWhatsAppOrderNumber,
  isFinalOrderNumber,
  isWhatsAppOrderNumber,
} = ctx.module.exports;

(async () => {
  assert.strictEqual(await getNextPaidOrderNumber(), 'GG0142');
  assert.strictEqual(isFinalOrderNumber('GG0142'), true);
  assert.strictEqual(isFinalOrderNumber('G4746'), false);
  assert.strictEqual(isWhatsAppOrderNumber('G4746'), true);
  assert.strictEqual(isWhatsAppOrderNumber('GG4746'), false);

  const wa1 = await getNextWhatsAppOrderNumber();
  assert.strictEqual(wa1, 'G4746');
  const wa2 = await getNextWhatsAppOrderNumber();
  assert.strictEqual(wa2, 'G4747');
  console.log('Ops order number tests passed', { wa1, wa2 });
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
