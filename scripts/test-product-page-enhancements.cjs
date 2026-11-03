const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');
const { test } = require('node:test');

function loadModule(relPath, exportNames) {
  const source = fs.readFileSync(path.join(__dirname, '..', relPath), 'utf8').replace(/export /g, '');
  const context = {
    module: { exports: {} },
    exports: {},
    console,
    Buffer,
    URL,
    Set,
    Map,
    Math,
    Number,
    String,
    Array,
    Object,
    JSON,
  };
  vm.createContext(context);
  vm.runInContext(`${source}\nmodule.exports = { ${exportNames.join(', ')} };`, context);
  return context.module.exports;
}

test('sanitizeRichHtml strips scripts and unsafe hrefs', () => {
  const { sanitizeRichHtml, hasRichTextContent } = loadModule('src/lib/sanitizeRichHtml.js', ['sanitizeRichHtml', 'hasRichTextContent']);
  const cleaned = sanitizeRichHtml('<p>Hello <script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="/help">safe</a></p>');
  assert.equal(cleaned.includes('script'), false);
  assert.equal(cleaned.includes('javascript:'), false);
  assert.match(cleaned, /href="\/help"/);
  assert.equal(hasRichTextContent('<p>  </p>'), false);
  assert.equal(hasRichTextContent('<p>Hi</p>'), true);
});

test('stock alert uses admin threshold and real quantity', () => {
  const stockSource = fs.readFileSync('src/lib/stock.js', 'utf8').replace(/export /g, '');
  const alertSource = fs.readFileSync('src/lib/stockAlert.js', 'utf8')
    .replace(/import[\s\S]*?from ['"]@\/lib\/stock['"];?\s*/g, '')
    .replace(/export /g, '');
  const context = { module: { exports: {} }, exports: {}, console, Math, Number, String, Array, Object };
  vm.createContext(context);
  vm.runInContext(`${stockSource}\n${alertSource}\nmodule.exports = { resolveStockAlertState };`, context);
  const { resolveStockAlertState } = context.module.exports;

  const low = resolveStockAlertState({ stock: 3, stockAlert: { enabled: true, lowStockThreshold: 5 } });
  assert.equal(low.tone, 'low');
  assert.match(low.label, /3/);

  const hidden = resolveStockAlertState({ stock: 20, stockAlert: { enabled: false } });
  assert.equal(hidden, null);

  const out = resolveStockAlertState({ stock: 0, stockAlert: { enabled: true } });
  assert.equal(out.tone, 'out');
});

test('purchase activity formatter hides zero counts', () => {
  const source = fs.readFileSync('src/lib/purchaseActivity.js', 'utf8')
    .replace(/import[\s\S]*?from ['"][^'"]+['"];?\s*/g, '')
    .replace(/export /g, '');
  const context = { module: { exports: {} }, exports: {}, console, Math, Number, String, Array, Object };
  vm.createContext(context);
  vm.runInContext(`${source}\nmodule.exports = { formatPurchaseActivityMessage };`, context);
  const { formatPurchaseActivityMessage } = context.module.exports;
  assert.equal(formatPurchaseActivityMessage('', 0, 30), '');
  assert.equal(
    formatPurchaseActivityMessage('{count} customers in {days} days', 12, 30),
    '12 customers in 30 days'
  );
});

test('ProductDetail wires new trust sections after reviews', () => {
  const source = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
  assert.match(source, /StockAvailabilityAlert/);
  assert.match(source, /PurchaseActivityBadge/);
  assert.match(source, /ProductMakingVideos/);
  assert.match(source, /ProductTrustStats/);
  const reviewsAt = source.indexOf('Customer Submitted Reviews');
  const videosAt = source.indexOf('<ProductMakingVideos');
  assert.ok(reviewsAt > 0 && videosAt > reviewsAt);
});
