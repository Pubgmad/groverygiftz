/**
 * Regression tests for cart image persistence + HEIC display resign.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || 'test-secret-for-cart-image-persist';

function loadModule(relativePath, exportNames) {
  let source = fs.readFileSync(path.join(__dirname, relativePath), 'utf8');
  source = source
    .replace(/^import\s+\{([^}]+)\}\s+from\s+'crypto';/m, "const {$1} = require('crypto');")
    .replace(/^import\s+\{([^}]+)\}\s+from\s+'@\/lib\/cartPersist';/m, '')
    .replace(/export /g, '');

  const context = {
    module: { exports: {} },
    exports: {},
    console,
    process,
    require,
    Buffer,
    URL,
    URLSearchParams,
  };
  vm.createContext(context);

  // cartPersist has no imports — load first when needed
  if (relativePath.includes('customerFileAccess')) {
    const persistSource = fs.readFileSync(path.join(__dirname, '../src/lib/cartPersist.js'), 'utf8')
      .replace(/export /g, '');
    vm.runInContext(`${persistSource}
globalThis.__cartPersist = { isEphemeralMediaUrl, durableUploadRef, stripDisplayOnlyPreviewData, cartItemHasConfiguredImages };
`, context);
  }

  const exportList = exportNames.join(', ');
  vm.runInContext(`${source}
module.exports = { ${exportList} };
`, context);
  return context.module.exports;
}

const cartPersistSource = fs.readFileSync(path.join(__dirname, '../src/lib/cartPersist.js'), 'utf8')
  .replace(/export /g, '');
const persistCtx = { module: { exports: {} }, exports: {}, console, process, require, Buffer };
vm.createContext(persistCtx);
vm.runInContext(`${cartPersistSource}
module.exports = { isEphemeralMediaUrl, durableUploadRef, stripDisplayOnlyPreviewData, cartItemHasConfiguredImages, mergeCartItems, isSameCartLine };
`, persistCtx);
const {
  isEphemeralMediaUrl,
  durableUploadRef,
  stripDisplayOnlyPreviewData,
  cartItemHasConfiguredImages,
  mergeCartItems,
} = persistCtx.module.exports;

assert.strictEqual(isEphemeralMediaUrl('blob:http://localhost/abc'), true);
assert.strictEqual(isEphemeralMediaUrl('data:image/jpeg;base64,aaa'), true);
assert.strictEqual(isEphemeralMediaUrl('/api/customization-upload/customer-file/customizations/a.jpg'), false);

const stripped = stripDisplayOnlyPreviewData({
  previewUrl: 'blob:http://x/1',
  finalPreviewDataUrl: 'blob:http://x/2',
  displayUrl: '/api/customization-upload/customer-file/customizations/a.jpg?exp=1&sig=x',
  url: '/api/customization-upload/original-file/customizations/a.jpg',
  nested: { previewUrl: 'blob:gone', keep: 'ok' },
  emptyBlob: 'blob:die',
});
assert.strictEqual(stripped.previewUrl, undefined);
assert.strictEqual(stripped.finalPreviewDataUrl, undefined);
assert.ok(stripped.displayUrl.includes('customer-file'));
assert.strictEqual(stripped.nested.previewUrl, undefined);
assert.strictEqual(stripped.nested.keep, 'ok');
assert.strictEqual(stripped.emptyBlob, undefined);

const durable = durableUploadRef({
  name: 'photo.heic',
  type: 'image/heic',
  url: '/api/customization-upload/original-file/customizations/a.heic',
  displayUrl: '/api/customization-upload/customer-file/customizations/previews/a.jpg?exp=1&sig=x',
  previewUrl: 'blob:http://local/preview',
  storagePath: 'customizations/a.heic',
  previewStoragePath: 'customizations/previews/a.jpg',
  size: 1234,
});
assert.ok(durable);
assert.strictEqual(durable.previewUrl, undefined);
assert.strictEqual(durable.previewStoragePath, 'customizations/previews/a.jpg');
assert.ok(!isEphemeralMediaUrl(durable.displayUrl));

assert.strictEqual(cartItemHasConfiguredImages({
  customFields: { 'Customer Photos': [{ url: '/api/x' }] },
}), true);
assert.strictEqual(cartItemHasConfiguredImages({ title: 'plain' }), false);

const access = loadModule('../src/lib/customerFileAccess.js', [
  'buildCustomerDisplayUrl',
  'extractCustomizationPathFromUrl',
  'resolveCustomerDisplayPath',
  'resignCustomerDisplayUrls',
]);

assert.strictEqual(
  access.extractCustomizationPathFromUrl('/media/customizations/abc-photo.jpg'),
  'customizations/abc-photo.jpg'
);

const heicAsset = {
  name: 'photo.heic',
  type: 'image/heic',
  url: '/api/customization-upload/original-file/customizations/a.heic?name=photo.heic',
  displayUrl: '/api/customization-upload/customer-file/customizations/a.heic',
  storagePath: 'customizations/a.heic',
  previewStoragePath: 'customizations/previews/a.jpg',
};
assert.strictEqual(access.resolveCustomerDisplayPath(heicAsset), 'customizations/previews/a.jpg');

const resigned = access.resignCustomerDisplayUrls([{
  customFields: { 'Customer Photos': [heicAsset] },
}]);
const resignedDisplay = resigned[0].customFields['Customer Photos'][0].displayUrl;
assert.ok(resignedDisplay.includes('customizations/previews/a.jpg'), `expected preview path in displayUrl, got ${resignedDisplay}`);
assert.ok(resignedDisplay.includes('sig='));

const jpegOnly = access.resignCustomerDisplayUrls([{
  customFields: {
    'Customer Photos': [{
      url: '/api/customization-upload/original-file/customizations/b.jpg',
      storagePath: 'customizations/b.jpg',
      displayUrl: '/api/customization-upload/customer-file/customizations/b.jpg',
    }],
  },
}]);
assert.ok(jpegOnly[0].customFields['Customer Photos'][0].displayUrl.includes('customizations/b.jpg'));

const configuredImagesSource = fs.readFileSync(path.join(__dirname, '../src/lib/configuredImages.js'), 'utf8');
assert.match(configuredImagesSource, /customerImageDisplaySrc/);
assert.match(configuredImagesSource, /previewStoragePath/);
assert.match(configuredImagesSource, /original-file/);
assert.doesNotMatch(
  configuredImagesSource.slice(configuredImagesSource.indexOf('const displayUrlFor'), configuredImagesSource.indexOf('export const customerImageDisplaySrc')),
  /\|\| String\(asset\?\.previewUrl/
);

const guestConfigured = {
  cartItemId: 'guest-1',
  productId: 'p1',
  variant: 'Size: 4*4 inch',
  quantity: 1,
  customFields: { 'Customer Photos': [{ url: '/api/customization-upload/customer-file/customizations/a.jpg' }] },
};
assert.equal(mergeCartItems([], [guestConfigured]).length, 1);
assert.equal(mergeCartItems([], [guestConfigured])[0].cartItemId, 'guest-1');
assert.equal(mergeCartItems([guestConfigured], [{ ...guestConfigured }]).length, 1);
assert.equal(mergeCartItems([guestConfigured], [{ ...guestConfigured, quantity: 1 }])[0].quantity, 1);
assert.equal(mergeCartItems([guestConfigured], [{ cartItemId: 'guest-2', productId: 'p2', quantity: 1 }]).length, 2);

const accountPlain = { productId: 'p3', variant: 'Color: Red', quantity: 1, customFields: {} };
const guestPhotos = { productId: 'p3', variant: 'Color: Red', quantity: 1, customFields: { 'Customer Photos': [{ url: '/api/x' }] } };
const filled = mergeCartItems([accountPlain], [guestPhotos]);
assert.equal(filled.length, 1);
assert.equal(filled[0].quantity, 2);
assert.ok(filled[0].customFields['Customer Photos'][0].url);

console.log('Cart image persist tests passed');
