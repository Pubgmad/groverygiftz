const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

process.env.NEXTAUTH_SECRET = 'bench-secret';

const persistSrc = fs.readFileSync(path.join(__dirname, '../src/lib/cartPersist.js'), 'utf8').replace(/export /g, '');
const accessSrc = fs.readFileSync(path.join(__dirname, '../src/lib/customerFileAccess.js'), 'utf8')
  .replace(/import \{ createHmac, timingSafeEqual \} from 'crypto';/, "const { createHmac, timingSafeEqual } = require('crypto');")
  .replace(/export /g, '');

const ctx = { module: { exports: {} }, exports: {}, console, process, require, Buffer };
vm.createContext(ctx);
vm.runInContext(`${persistSrc}\n${accessSrc}\nmodule.exports = { stripDisplayOnlyPreviewData, resignCustomerDisplayUrls };`, ctx);
const { stripDisplayOnlyPreviewData, resignCustomerDisplayUrls } = ctx.module.exports;

const makeItem = (i) => ({
  productId: `p${i}`,
  cartItemId: `c${i}`,
  title: `Product ${i}`,
  quantity: 1,
  price: 499,
  customFields: {
    'Customer Photos': Array.from({ length: 4 }, (_, j) => ({
      name: `photo${j}.heic`,
      type: 'image/heic',
      url: `/api/customization-upload/original-file/customizations/${i}-${j}.heic`,
      displayUrl: `/api/customization-upload/customer-file/customizations/${i}-${j}.heic`,
      previewUrl: `blob:http://localhost/${i}-${j}`,
      storagePath: `customizations/${i}-${j}.heic`,
      previewStoragePath: `customizations/previews/${i}-${j}.jpg`,
    })),
  },
  customizationPreview: {
    previews: Array.from({ length: 4 }, (_, j) => ({
      areaLabel: `Photo ${j + 1}`,
      uploadedFile: {
        url: `/api/customization-upload/original-file/customizations/${i}-${j}.heic`,
        displayUrl: 'x',
        storagePath: `customizations/${i}-${j}.heic`,
        previewStoragePath: `customizations/previews/${i}-${j}.jpg`,
      },
      finalPreviewImage: {
        url: `/api/customization-upload/original-file/customizations/prev-${i}-${j}.jpg`,
        displayUrl: 'y',
        storagePath: `customizations/prev-${i}-${j}.jpg`,
      },
      finalPreviewDataUrl: 'blob:dead',
    })),
  },
});

const cart = Array.from({ length: 8 }, (_, i) => makeItem(i));
const t0 = performance.now();
const stripped = stripDisplayOnlyPreviewData(cart);
const t1 = performance.now();
const resigned = resignCustomerDisplayUrls(stripped);
const t2 = performance.now();
const json = JSON.stringify(stripped);
const t3 = performance.now();
const beforeSize = JSON.stringify(cart).length;
const afterSize = json.length;
const heicOk = resigned.every((item) => item.customFields['Customer Photos'].every((p) => p.displayUrl.includes('/previews/')));

console.log(JSON.stringify({
  stripMs: +(t1 - t0).toFixed(2),
  resignMs: +(t2 - t1).toFixed(2),
  stringifyMs: +(t3 - t2).toFixed(2),
  payloadBytesBefore: beforeSize,
  payloadBytesAfter: afterSize,
  payloadReductionPct: +(((beforeSize - afterSize) / beforeSize) * 100).toFixed(1),
  heicPreviewResignOk: heicOk,
  items: cart.length,
  photos: cart.length * 4,
}, null, 2));
