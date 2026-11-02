const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createHmac } = require('crypto');

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-customer-file-access';

const source = fs.readFileSync(path.join(__dirname, '../src/lib/customerFileAccess.js'), 'utf8')
  .replace(/export /g, '')
  .replace(/import \{ createHmac, timingSafeEqual \} from 'crypto';/, "const { createHmac, timingSafeEqual } = require('crypto');");

const context = {
  module: { exports: {} },
  exports: {},
  console,
  process,
  require,
  Buffer,
};
vm.createContext(context);
vm.runInContext(`${source}
module.exports = { buildCustomerDisplayUrl, verifyCustomerDisplayAccess, extractCustomizationPathFromUrl, resignCustomerDisplayUrls };
`, context);

const {
  buildCustomerDisplayUrl,
  verifyCustomerDisplayAccess,
  extractCustomizationPathFromUrl,
  resignCustomerDisplayUrls,
} = context.module.exports;

const relativePath = 'customizations/123-abc-photo.jpg';
const displayUrl = buildCustomerDisplayUrl(relativePath);
assert.ok(displayUrl.includes('/api/customization-upload/customer-file/customizations/123-abc-photo.jpg'));
assert.ok(displayUrl.includes('sig='));
assert.ok(displayUrl.includes('exp='));

const url = new URL(displayUrl, 'https://example.com');
assert.strictEqual(verifyCustomerDisplayAccess(relativePath, url.searchParams), true);
assert.strictEqual(verifyCustomerDisplayAccess(relativePath, new URLSearchParams('exp=1&sig=bad')), false);

assert.strictEqual(
  extractCustomizationPathFromUrl('/api/customization-upload/original-file/customizations/123-abc-photo.jpg?name=a.jpg'),
  relativePath
);

const cart = resignCustomerDisplayUrls([{
  customFields: {
    'Customer Photos': [{
      name: 'photo.jpg',
      url: `/api/customization-upload/original-file/${relativePath}?name=photo.jpg`,
      displayUrl: `/api/customization-upload/customer-file/${relativePath}`,
      storagePath: relativePath,
    }],
  },
}]);
assert.ok(cart[0].customFields['Customer Photos'][0].displayUrl.includes('sig='));

console.log('Customer file access tests passed');
