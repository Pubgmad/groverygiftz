import { createRequire } from 'module';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import * as esbuild from 'esbuild';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const tmp = mkdtempSync(join(tmpdir(), 'cart-persist-'));
const outfile = join(tmp, 'bundle.cjs');

await esbuild.build({
  stdin: {
    contents: `export * from './src/lib/cartPersist.js';`,
    resolveDir: root,
    sourcefile: 'entry.js',
  },
  bundle: true,
  platform: 'node',
  format: 'cjs',
  outfile,
  alias: { '@': join(root, 'src') },
  logLevel: 'silent',
});

const require = createRequire(import.meta.url);
const m = require(outfile);

const guest = [{
  productId: 'p1',
  variant: '5 × 7',
  quantity: 1,
  cartItemId: 'guest-line',
  customFields: { 'Customer Photos': [{ url: '/api/customization-upload/customer-file/customizations/a.jpg' }] },
}];
const accountEmpty = [{ productId: 'p1', variant: '5 × 7', quantity: 1 }];
const merged = m.mergeGuestCartIntoAccount(accountEmpty, guest);
if (!merged.some((item) => m.cartItemHasConfiguredImages(item))) {
  throw new Error('guest customization must survive sign-in merge');
}
if (merged.length !== 1) {
  throw new Error('guest customization should replace the empty account line, not duplicate it');
}

const blobStripped = m.stripDisplayOnlyPreviewData({
  url: 'blob:http://localhost/x',
  previewUrl: 'blob:http://localhost/y',
  displayUrl: '/api/customization-upload/customer-file/customizations/a.jpg',
});
if (blobStripped.url || blobStripped.previewUrl) throw new Error('blob URLs must not persist');
if (!blobStripped.displayUrl) throw new Error('durable display URL must remain');

const paidLine = { productId: 'p1', variant: '5 × 7', cartItemId: 'guest-line' };
const leftover = { productId: 'p2', variant: 'Black', quantity: 1 };
const afterClear = [];
if (afterClear.some((item) => m.isSameCartLine(item, paidLine.productId, paidLine.variant, paidLine.cartItemId))) {
  throw new Error('paid line must not remain after cart clear');
}
if (m.isSameCartLine(leftover, paidLine.productId, paidLine.variant, paidLine.cartItemId)) {
  throw new Error('unrelated cart lines must not match the paid line');
}

if (m.cartItemHasConfiguredImages({ customizationPreview: { previews: [{ previewUrl: 'blob:http://local/x' }] } })) {
  throw new Error('hollow blob-only previews must not count as durable images');
}

console.log('cart persist helpers ok');
rmSync(tmp, { recursive: true, force: true });
