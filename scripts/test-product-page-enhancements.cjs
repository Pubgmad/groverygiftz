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

test('low-stock alert only fires under threshold and uses real quantity', () => {
  const stockSource = fs.readFileSync('src/lib/stock.js', 'utf8').replace(/export /g, '');
  const alertSource = fs.readFileSync('src/lib/stockAlert.js', 'utf8')
    .replace(/import[\s\S]*?from ['"]@\/lib\/stock['"];?\s*/g, '')
    .replace(/export /g, '');
  const context = { module: { exports: {} }, exports: {}, console, Math, Number, String, Array, Object };
  vm.createContext(context);
  vm.runInContext(`${stockSource}\n${alertSource}\nmodule.exports = { resolveLowStockAlert };`, context);
  const { resolveLowStockAlert } = context.module.exports;

  const low = resolveLowStockAlert({ stock: 3, stockAlert: { enabled: true, lowStockThreshold: 5 } });
  assert.ok(low);
  assert.match(low.label, /3/);

  const hidden = resolveLowStockAlert({ stock: 20, stockAlert: { enabled: true, lowStockThreshold: 5 } });
  assert.equal(hidden, null);

  const disabled = resolveLowStockAlert({ stock: 2, stockAlert: { enabled: false } });
  assert.equal(disabled, null);
});

test('purchase activity uses manual admin values only', () => {
  const { formatPurchaseActivityMessage } = loadModule('src/lib/purchaseActivityMessage.js', ['formatPurchaseActivityMessage']);
  assert.equal(formatPurchaseActivityMessage({ enabled: true, purchaseCount: 0, timeQuantity: 24, timeUnit: 'hours' }), '');
  assert.equal(
    formatPurchaseActivityMessage({
      enabled: true,
      purchaseCount: 18,
      timeQuantity: 24,
      timeUnit: 'hours',
    }),
    '18 people purchased this product in the last 24 hours'
  );
  assert.equal(fs.existsSync('src/lib/purchaseActivity.js'), false);
  const page = fs.readFileSync('src/app/products/[slug]/page.js', 'utf8');
  assert.equal(page.includes('countProductPurchases'), false);
});

test('ProductDetail restores original stock display and keeps separate alert', () => {
  const source = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
  assert.match(source, /Almost gone/);
  assert.match(source, /selling fast/);
  assert.match(source, /StockAvailabilityAlert/);
  assert.equal(source.includes('Customer photo areas'), false);
  assert.match(source, /Upload \$\{requiredPhotoCount\} photo/);
  const about = fs.readFileSync('src/components/product/AboutThisProduct.js', 'utf8');
  assert.match(about, /settings\?\.productFaqs/);
});

test('global FAQ admin lives in settings, not product form', () => {
  const productAdmin = fs.readFileSync('src/app/account/manage/products/[id]/page.js', 'utf8');
  const settingsAdmin = fs.readFileSync('src/components/admin/AdminHomeGiftSettings.js', 'utf8');
  assert.equal(productAdmin.includes('ProductFaqEditor'), false);
  assert.match(settingsAdmin, /ProductFaqEditor/);
  assert.match(settingsAdmin, /productFaqs/);
});
