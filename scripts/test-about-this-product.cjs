const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('path');
const vm = require('node:vm');
const { test } = require('node:test');

test('unwanted promo statements are removed from ProductDetail', () => {
  const source = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
  assert.equal(source.includes('Free Delivery Across Tamil Nadu'), false);
  assert.equal(source.includes('100% Safe & Secure Payments'), false);
  assert.equal(source.includes('AboutThisProduct'), true);
  assert.equal(/dangerouslySetInnerHTML=\{\{\s*__html:\s*product\.description\s*\}\}/.test(source), false);
});

test('About This Product appears after How to buy and no longer duplicates delivery', () => {
  const detail = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
  const about = fs.readFileSync('src/components/product/AboutThisProduct.js', 'utf8');
  const howToBuyAt = detail.indexOf('How to buy this gift');
  const aboutAt = detail.indexOf('<AboutThisProduct');
  assert.ok(howToBuyAt > 0 && aboutAt > howToBuyAt, 'AboutThisProduct must render after How to buy');
  assert.equal(about.includes('Delivery Information'), false);
  assert.equal(about.includes('getDeliveryEstimateDisplay'), false);
  assert.match(about, /productFaqs/);
  assert.match(about, /sanitizeRichHtml/);
});

test('preview section no longer shows the long hardcoded guidance paragraph', () => {
  const source = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
  assert.equal(source.includes('Offer is Only for Normal'), false);
  assert.equal(source.includes('Your frame automatically switches between portrait and landscape'), false);
  assert.equal(source.includes('Customer photo areas'), false);
  assert.match(source, /shortGuidance|Upload \$\{requiredPhotoCount\} photo/);
});

test('aboutThisProduct accordion component exists and uses admin sources', () => {
  const source = fs.readFileSync('src/components/product/AboutThisProduct.js', 'utf8');
  assert.match(source, /About This Product/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /about\.instructions \|\| product\?\.customizationPreview\?\.instructions/);
  assert.match(source, /hideDescription/);
});

test('sanitizeProductPayload keeps aboutThisProduct and corrected PDP fields', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/lib/productPayload.js'), 'utf8').replace(/export /g, '');
  const context = { module: { exports: {} }, exports: {}, console };
  vm.createContext(context);
  vm.runInContext(`${source}\nmodule.exports = { sanitizeProductPayload };`, context);
  const { sanitizeProductPayload } = context.module.exports;
  const body = sanitizeProductPayload({
    regularPrice: '499',
    aboutThisProduct: {
      instructions: ' Upload clear photos ',
      deliveryNotes: 'Handle with care',
      hideDescription: 1,
      hideInstructions: 0,
      hideDelivery: 'yes',
    },
    stockAlert: { enabled: true, lowStockThreshold: '3', lowStockLabel: 'Only {count} left' },
    purchaseActivity: { enabled: 1, purchaseCount: '18', timeQuantity: '24', timeUnit: 'hours', labelTemplate: '' },
    customizationPreview: { shortGuidance: 'Upload and adjust', areas: [{ width: '8', height: '10' }] },
  });
  assert.equal(JSON.stringify(body.aboutThisProduct), JSON.stringify({
    instructions: ' Upload clear photos ',
    deliveryNotes: 'Handle with care',
    hideDescription: true,
    hideInstructions: false,
    hideDelivery: true,
  }));
  assert.equal(body.stockAlert.lowStockThreshold, 3);
  assert.equal(body.purchaseActivity.enabled, true);
  assert.equal(body.purchaseActivity.purchaseCount, 18);
  assert.equal(body.purchaseActivity.timeQuantity, 24);
  assert.equal(body.purchaseActivity.timeUnit, 'hours');
  assert.equal(body.customizationPreview.shortGuidance, 'Upload and adjust');
});
