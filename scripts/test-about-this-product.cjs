const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

test('unwanted promo statements are removed from ProductDetail', () => {
  const source = fs.readFileSync('src/components/product/ProductDetail.js', 'utf8');
  assert.equal(source.includes('Free Delivery Across Tamil Nadu'), false);
  assert.equal(source.includes('100% Safe & Secure Payments'), false);
  assert.equal(source.includes('AboutThisProduct'), true);
  assert.equal(/dangerouslySetInnerHTML=\{\{\s*__html:\s*product\.description\s*\}\}/.test(source), false);
});

test('aboutThisProduct accordion component exists and uses admin/delivery sources', () => {
  const source = fs.readFileSync('src/components/product/AboutThisProduct.js', 'utf8');
  assert.match(source, /About This Product/);
  assert.match(source, /getDeliveryEstimateDisplay/);
  assert.match(source, /aria-expanded/);
  assert.match(source, /about\.instructions \|\| product\?\.customizationPreview\?\.instructions/);
  assert.match(source, /hideDescription/);
});

test('sanitizeProductPayload keeps aboutThisProduct admin fields', () => {
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
  });
  assert.equal(JSON.stringify(body.aboutThisProduct), JSON.stringify({
    instructions: ' Upload clear photos ',
    deliveryNotes: 'Handle with care',
    hideDescription: true,
    hideInstructions: false,
    hideDelivery: true,
  }));
});
