const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createHmac, timingSafeEqual } = require('crypto');

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-production-video';

const source = fs.readFileSync(path.join(__dirname, '../src/lib/productionVideoToken.js'), 'utf8')
  .replace(/export /g, '')
  .replace(/import \{ createHmac, timingSafeEqual \} from 'crypto';/, '');

const ctx = {
  module: { exports: {} },
  exports: {},
  console,
  process,
  Buffer,
  Date,
  Math,
  Number,
  String,
  createHmac,
  timingSafeEqual,
};
vm.createContext(ctx);
vm.runInContext(`${source}
module.exports = {
  createProductionVideoShareToken,
  verifyProductionVideoShareToken,
  buildProductionVideoShareUrl,
  buildWhatsAppVideoShareUrl,
};
`, ctx);

const {
  createProductionVideoShareToken,
  verifyProductionVideoShareToken,
  buildWhatsAppVideoShareUrl,
} = ctx.module.exports;

const rel = 'production-videos/123-demo.mp4';
const token = createProductionVideoShareToken(rel);
assert.ok(token);
const verified = verifyProductionVideoShareToken(token);
assert.ok(verified);
assert.strictEqual(verified.relativePath, rel);

assert.strictEqual(verifyProductionVideoShareToken('bad.token.here'), null);
assert.strictEqual(createProductionVideoShareToken('uploads/x.mp4'), '');

const wa = buildWhatsAppVideoShareUrl('9876543210', 'Your video is ready');
assert.ok(wa.startsWith('https://wa.me/919876543210?text='));

console.log('Production video token tests passed');
